import axios from "axios";
import * as cheerio from "cheerio";

const SITEMAP_TIMEOUT = 15000; // 15 seconds for sitemap requests
const MAX_SITEMAP_DEPTH = 10; // Prevent infinite recursion in nested sitemap indexes
const MAX_RETRIES = 3; // Retry failed sitemap fetches

/**
 * Parses a sitemap XML file and extracts all URLs
 * WHY: Modern sites expose all pages via sitemap.xml, which is more reliable than HTML crawling
 */
export async function parseSitemap(sitemapUrl: string, debug: boolean = false): Promise<string[]> {
  const urls: string[] = [];
  const visitedSitemaps = new Set<string>();

  async function fetchSitemap(url: string, depth: number = 0): Promise<string[]> {
    // Prevent infinite loops and excessive depth in sitemap index files
    if (visitedSitemaps.has(url)) {
      if (debug) console.log(`[Sitemap] Skipping already visited sitemap: ${url}`);
      return [];
    }
    if (depth > MAX_SITEMAP_DEPTH) {
      if (debug) console.warn(`[Sitemap] Max depth (${MAX_SITEMAP_DEPTH}) reached for: ${url}`);
      return [];
    }
    visitedSitemaps.add(url);
    if (debug) console.log(`[Sitemap] Fetching sitemap (depth ${depth}): ${url}`);

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Normalize sitemap URL protocol (http vs https)
        // WHY: Some sitemaps may be listed with http but redirect to https
        let normalizedUrl = url;
        if (normalizedUrl.startsWith("http://")) {
          // Try https first, fallback to http
          try {
            const httpsUrl = normalizedUrl.replace("http://", "https://");
            const testResponse = await axios.head(httpsUrl, {
              timeout: 5000,
              validateStatus: () => true,
              maxRedirects: 3,
            });
            if (testResponse.status === 200) {
              normalizedUrl = httpsUrl;
            }
          } catch {
            // Continue with original URL
          }
        }

        const response = await axios.get(normalizedUrl, {
          timeout: SITEMAP_TIMEOUT,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
            "Accept": "application/xml, text/xml, application/gzip, */*",
            "Accept-Encoding": "gzip, deflate, br",
          },
          // Handle gzipped sitemaps
          decompress: true,
          validateStatus: (status) => status === 200,
          maxRedirects: 5,
        });

        // Validate that we got XML content
        const contentType = response.headers["content-type"] || "";
        const contentText = typeof response.data === "string" 
          ? response.data 
          : response.data.toString();
        
        // Check for XML content (handle various content types)
        const isXml = contentType.includes("xml") || 
                      contentType.includes("text/plain") ||
                      contentText.trim().startsWith("<") ||
                      contentText.trim().startsWith("<?xml");

        if (!isXml) {
          throw new Error(`Invalid sitemap content type: ${contentType}`);
        }

        // Parse XML - strip namespaces first to avoid cheerio/css-select issues
        // WHY: Cheerio's css-select doesn't support namespaced tag names
        // We'll remove namespace prefixes from tag names before parsing
        const contentWithoutNamespaces = contentText.replace(/<(\/?)([a-zA-Z]+):([a-zA-Z]+)/g, '<$1$3');
        const $ = cheerio.load(contentWithoutNamespaces, { 
          xmlMode: true,
        });

        const foundUrls: string[] = [];

        // Check if this is a sitemap index file
        // WHY: Sites often use sitemap index files that reference multiple child sitemaps
        const sitemapIndexEntries = $("sitemapindex > sitemap > loc, sitemap > loc");
        
        if (sitemapIndexEntries.length > 0) {
          // This is a sitemap index - recursively fetch child sitemaps
          // WHY: Large sites split sitemaps into multiple files for better organization
          if (debug) console.log(`[Sitemap] Found sitemap index with ${sitemapIndexEntries.length} child sitemaps`);
          const childSitemapPromises: Promise<string[]>[] = [];
          
          sitemapIndexEntries.each((_, element) => {
            const childSitemapUrl = $(element).text().trim();
            if (childSitemapUrl) {
              // Normalize child sitemap URL (handle relative URLs)
              try {
                const absoluteUrl = new URL(childSitemapUrl, normalizedUrl).href;
                if (debug) console.log(`[Sitemap] Adding child sitemap: ${absoluteUrl}`);
                childSitemapPromises.push(fetchSitemap(absoluteUrl, depth + 1));
              } catch (error) {
                // Skip invalid URLs but log for debugging
                if (debug) console.warn(`[Sitemap] Invalid child sitemap URL: ${childSitemapUrl}`, error);
              }
            }
          });

          // Use Promise.allSettled to handle partial failures gracefully
          const childResults = await Promise.allSettled(childSitemapPromises);
          const successfulResults: string[][] = [];
          
          for (const result of childResults) {
            if (result.status === "fulfilled") {
              successfulResults.push(result.value);
            } else {
              console.warn(`[Sitemap] Failed to fetch child sitemap: ${result.reason}`);
            }
          }
          
          return successfulResults.flat();
        }

        // Regular sitemap - extract all <loc> URLs
        // WHY: Standard sitemap format uses <loc> tags to list page URLs
        const urlEntries = $("urlset > url > loc, url > loc");
        urlEntries.each((_, element) => {
          const urlText = $(element).text().trim();
          if (urlText) {
            foundUrls.push(urlText);
          }
        });

        // If no URLs found with standard selectors, try more aggressive parsing
        if (foundUrls.length === 0) {
          if (debug) console.log(`[Sitemap] No URLs found with standard selectors, trying aggressive parsing`);
          // Try finding any <loc> tag anywhere in the document
          $("loc").each((_, element) => {
            const urlText = $(element).text().trim();
            if (urlText && (urlText.startsWith("http://") || urlText.startsWith("https://"))) {
              foundUrls.push(urlText);
            }
          });
        }

        if (debug) {
          console.log(`[Sitemap] Extracted ${foundUrls.length} URLs from ${normalizedUrl}`);
          if (foundUrls.length > 0 && foundUrls.length <= 5) {
            console.log(`[Sitemap] Sample URLs:`, foundUrls.slice(0, 3));
          }
        }

        return foundUrls;
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on 404 or 403 errors
        if (error.response && [404, 403].includes(error.response.status)) {
          throw error;
        }
        
        // Exponential backoff for retries
        if (attempt < MAX_RETRIES - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // If all retries failed, throw the last error
    let errorMessage = "Unknown error";
    if (lastError) {
      if ('response' in lastError && lastError.response) {
        const axiosError = lastError as any;
        errorMessage = `HTTP ${axiosError.response.status}: ${axiosError.message}`;
      } else {
        errorMessage = lastError.message || "Unknown error";
      }
    }
    throw new Error(`Failed to fetch/parse sitemap ${url} after ${MAX_RETRIES} attempts: ${errorMessage}`);
  }

  return await fetchSitemap(sitemapUrl);
}

/**
 * Discovers sitemap URLs by directly checking common sitemap.xml locations
 * WHY: Directly fetching sitemap.xml is faster and more reliable than checking robots.txt first
 */
export async function discoverSitemap(baseUrl: URL, debug: boolean = false): Promise<string | null> {
  // Common sitemap paths, ordered by likelihood
  // Start with /sitemap.xml as it's the most common location
  const commonPaths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/sitemap1.xml",
    "/sitemap_1.xml",
    "/sitemaps.xml",
  ];

  // Check common sitemap locations concurrently for faster discovery
  // WHY: Directly checking sitemap.xml is faster than parsing robots.txt first
  if (debug) console.log(`[SitemapDiscovery] Directly checking common sitemap paths: ${commonPaths.join(", ")}`);
  const checkPromises = commonPaths.map(async (path) => {
    try {
      const sitemapUrl = new URL(path, baseUrl).href;
      
      // Try HEAD first (faster), then GET if HEAD fails
      for (const method of ["head", "get"] as const) {
        try {
          const response = method === "head"
            ? await axios.head(sitemapUrl, {
                timeout: 8000,
                validateStatus: () => true,
                maxRedirects: 3,
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
                },
              })
            : await axios.get(sitemapUrl, {
                timeout: 8000,
                validateStatus: (status) => status === 200,
                maxRedirects: 3,
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
                  "Accept": "application/xml, text/xml, */*",
                },
              });
          
          if (response.status === 200) {
            if (debug) console.log(`[SitemapDiscovery] ✓ Found sitemap at: ${sitemapUrl}`);
            return sitemapUrl;
          }
        } catch {
          if (method === "get") {
            return null;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Return the first sitemap found
  const results = await Promise.allSettled(checkPromises);
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      return result.value;
    }
  }

  // Fallback: Check robots.txt only if direct paths failed
  // WHY: Some sites may only declare sitemap in robots.txt
  if (debug) console.log(`[SitemapDiscovery] No sitemap found at common paths, checking robots.txt as fallback`);
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const robotsResponse = await axios.get(robotsUrl, {
      timeout: 8000,
      validateStatus: () => true,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
      },
      maxRedirects: 3,
    });

    if (robotsResponse.status === 200) {
      const robotsText = typeof robotsResponse.data === "string" 
        ? robotsResponse.data 
        : robotsResponse.data.toString();
      
      // Match sitemap declarations
      const sitemapMatches = Array.from(robotsText.matchAll(/Sitemap:\s*(.+)/gi));
      
      // Try each sitemap URL found in robots.txt
      for (const match of sitemapMatches) {
        const sitemapUrl = (match as RegExpMatchArray)[1].trim();
        const cleanUrl = sitemapUrl.split("#")[0].trim();
        if (!cleanUrl) continue;
        
        try {
          const absoluteSitemapUrl = new URL(cleanUrl, baseUrl).href;
          
          // Verify it exists
          for (const method of ["head", "get"] as const) {
            try {
              const testResponse = method === "head"
                ? await axios.head(absoluteSitemapUrl, {
                    timeout: 8000,
                    validateStatus: () => true,
                    maxRedirects: 3,
                  })
                : await axios.get(absoluteSitemapUrl, {
                    timeout: 8000,
                    validateStatus: (status) => status === 200,
                    maxRedirects: 3,
                    headers: {
                      "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
                      "Accept": "application/xml, text/xml, */*",
                    },
                  });
              
              if (testResponse.status === 200) {
                if (debug) console.log(`[SitemapDiscovery] ✓ Found sitemap in robots.txt: ${absoluteSitemapUrl}`);
                return absoluteSitemapUrl;
              }
            } catch {
              if (method === "get") {
                break; // Try next sitemap from robots.txt
              }
            }
          }
        } catch {
          // Invalid URL, continue to next match
          continue;
        }
      }
    }
  } catch (error: any) {
    // robots.txt check failed, continue
    if (debug) console.log(`[SitemapDiscovery] robots.txt check failed or not found`);
  }

  if (debug) console.log(`[SitemapDiscovery] ✗ No sitemap found for ${baseUrl.hostname}`);
  return null;
}
