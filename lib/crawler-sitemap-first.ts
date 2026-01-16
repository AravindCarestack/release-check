import axios from "axios";
import { parseSitemap, discoverSitemap } from "./sitemap-parser";
import { canonicalizeUrl, shouldCrawlUrl, type NormalizeOptions } from "./url-normalizer";

const TIMEOUT = 15000; // 15 seconds per page
const DEFAULT_MAX_PAGES = 200;

interface CrawlOptions {
  maxPages?: number;
  timeout?: number;
  debug?: boolean;
}

interface CrawledPage {
  url: string;
  html: string;
  statusCode: number;
}

export interface CrawlStatistics {
  sitemapFound: boolean;
  sitemapUrl: string | null;
  sitemapUrlCount: number;
  htmlDiscoveredCount: number;
  totalDiscovered: number;
  totalCrawled: number;
  crawlErrors: string[];
}

/**
 * Checks if a URL is safe to crawl (prevents SSRF attacks)
 */
function isSafeUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("0.0.0.0")
  ) {
    return false;
  }

  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
  ];

  for (const range of privateRanges) {
    if (range.test(hostname)) {
      return false;
    }
  }

  return true;
}

/**
 * Sitemap-first crawler: Uses sitemap URLs directly via HTTP
 * This is the most reliable approach for production sites
 */
export async function crawlWebsite(
  rootUrl: string,
  options: CrawlOptions = {}
): Promise<{ pages: CrawledPage[]; statistics: CrawlStatistics }> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const timeout = options.timeout ?? TIMEOUT;
  const debug = options.debug ?? false;

  // Initialize statistics
  const statistics: CrawlStatistics = {
    sitemapFound: false,
    sitemapUrl: null,
    sitemapUrlCount: 0,
    htmlDiscoveredCount: 0,
    totalDiscovered: 0,
    totalCrawled: 0,
    crawlErrors: [],
  };

  // Normalize and validate root URL
  let baseUrl: URL;
  try {
    let normalizedRoot = rootUrl.trim();
    if (!normalizedRoot.startsWith("http://") && !normalizedRoot.startsWith("https://")) {
      normalizedRoot = `https://${normalizedRoot}`;
    }
    
    baseUrl = new URL(normalizedRoot);
    
    if (baseUrl.protocol === "http:") {
      baseUrl.protocol = "https:";
    }
    
    if (!isSafeUrl(baseUrl)) {
      throw new Error("Root URL is not safe to crawl (SSRF protection)");
    }
  } catch (error: any) {
    throw new Error(`Invalid root URL: ${error.message}`);
  }

  // Prepare normalization options
  const normalizeOptions: NormalizeOptions = {
    baseUrl,
    forceHttps: true,
    preserveWww: baseUrl.hostname.startsWith("www."),
  };

  const canonicalBase = canonicalizeUrl(baseUrl, normalizeOptions);
  if (!canonicalBase) {
    throw new Error("Failed to canonicalize base URL");
  }

  const visited = new Set<string>();
  const results: CrawledPage[] = [];
  const hostname = baseUrl.hostname.toLowerCase();
  
  if (debug) {
    console.log(`[SitemapCrawler] Base URL: ${baseUrl.href}`);
    console.log(`[SitemapCrawler] Canonical base: ${canonicalBase}`);
    console.log(`[SitemapCrawler] Hostname: ${hostname}`);
    console.log(`[SitemapCrawler] Normalize options:`, normalizeOptions);
  }

  // STEP 1: Discover and parse sitemap (PRIMARY SOURCE)
  if (debug) console.log(`[SitemapCrawler] Discovering sitemap for ${baseUrl.hostname}...`);
  const sitemapUrl = await discoverSitemap(baseUrl, debug);
  
  if (sitemapUrl) {
    statistics.sitemapFound = true;
    statistics.sitemapUrl = sitemapUrl;
    if (debug) console.log(`[SitemapCrawler] ✓ Found sitemap: ${sitemapUrl}`);
    
    try {
      const sitemapUrls = await parseSitemap(sitemapUrl, debug);
      statistics.sitemapUrlCount = sitemapUrls.length;
      if (debug) {
        console.log(`[SitemapCrawler] ✓ Extracted ${sitemapUrls.length} URLs from sitemap`);
        if (sitemapUrls.length > 0 && sitemapUrls.length <= 10) {
          console.log(`[SitemapCrawler] Sample URLs:`, sitemapUrls.slice(0, 5));
        }
      }
      
      if (sitemapUrls.length > 0) {
        // Filter and normalize sitemap URLs
        const urlsToCrawl: string[] = [];
        let filtered = 0;
        const baseHostnameNoWww = hostname.replace(/^www\./, "");
        
        if (debug) {
          console.log(`[SitemapCrawler] Processing ${sitemapUrls.length} URLs from sitemap`);
          console.log(`[SitemapCrawler] Base hostname: ${hostname} (no-www: ${baseHostnameNoWww})`);
        }
        
        for (const url of sitemapUrls) {
          try {
            // Normalize first to handle www vs non-www
            const normalized = canonicalizeUrl(url, normalizeOptions);
            if (!normalized) {
              if (debug && filtered < 10) {
                console.log(`[SitemapCrawler] ✗ Filtered (failed normalization): ${url}`);
              }
              filtered++;
              continue;
            }
            
            // Check if it's the same domain (after normalization, www is handled)
            const normalizedUrl = new URL(normalized);
            const normalizedHostname = normalizedUrl.hostname.toLowerCase();
            const urlHostnameNoWww = normalizedHostname.replace(/^www\./, "");
            
            // Must be same domain (ignoring www)
            if (baseHostnameNoWww !== urlHostnameNoWww) {
              if (debug && filtered < 10) {
                console.log(`[SitemapCrawler] ✗ Filtered (different domain): ${url} (hostname: ${normalizedHostname}, no-www: ${urlHostnameNoWww})`);
              }
              filtered++;
              continue;
            }
            
            // Check file extensions
            const lowerPath = normalizedUrl.pathname.toLowerCase();
            const skipExtensions = [
              ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico",
              ".zip", ".exe", ".dmg", ".css", ".js", ".json", ".xml", ".txt",
              ".mp4", ".mp3", ".avi", ".mov", ".wmv", ".flv", ".webm",
              ".woff", ".woff2", ".ttf", ".eot", ".otf",
            ];
            
            if (skipExtensions.some(ext => lowerPath.endsWith(ext))) {
              if (debug && filtered < 10) {
                console.log(`[SitemapCrawler] ✗ Filtered (file extension): ${url}`);
              }
              filtered++;
              continue;
            }
            
            // Add to crawl list (don't add to visited yet - we'll do that after fetching)
            // Check for duplicates in urlsToCrawl instead
            if (!urlsToCrawl.includes(normalized)) {
              urlsToCrawl.push(normalized);
              if (debug && urlsToCrawl.length <= 20) {
                console.log(`[SitemapCrawler] ✓ [${urlsToCrawl.length}] Added: ${url} -> ${normalized}`);
              }
            } else {
              if (debug && filtered < 10) {
                console.log(`[SitemapCrawler] ✗ Filtered (duplicate in queue): ${url} -> ${normalized}`);
              }
              filtered++;
            }
          } catch (error: any) {
            if (debug && filtered < 10) {
              console.log(`[SitemapCrawler] ✗ Filtered (error): ${url} - ${error.message}`);
            }
            filtered++;
          }
        }
        
        // Limit to maxPages
        const urlsToFetch = urlsToCrawl.slice(0, maxPages);
        
        if (debug) {
          console.log(`[SitemapCrawler] Summary: ${urlsToFetch.length} URLs to fetch, ${filtered} filtered out`);
          if (urlsToFetch.length === 0 && sitemapUrls.length > 0) {
            console.error(`[SitemapCrawler] ⚠ ERROR: All ${sitemapUrls.length} sitemap URLs were filtered out!`);
            console.error(`[SitemapCrawler] Base hostname: ${hostname} (no-www: ${baseHostnameNoWww})`);
            console.error(`[SitemapCrawler] Sample raw sitemap URLs:`, sitemapUrls.slice(0, 5));
            // Show what happens to first few URLs
            sitemapUrls.slice(0, 5).forEach(url => {
              const normalized = canonicalizeUrl(url, normalizeOptions);
              if (normalized) {
                const urlObj = new URL(normalized);
                const urlHostnameNoWww = urlObj.hostname.toLowerCase().replace(/^www\./, "");
                console.error(`  - ${url} -> ${normalized} (hostname: ${urlObj.hostname}, no-www: ${urlHostnameNoWww}, match: ${baseHostnameNoWww === urlHostnameNoWww})`);
              } else {
                console.error(`  - ${url} -> FAILED TO NORMALIZE`);
              }
            });
          } else if (urlsToFetch.length > 0) {
            console.log(`[SitemapCrawler] ✓ Successfully prepared ${urlsToFetch.length} URLs for crawling`);
          }
        }
        
        // Fetch all pages from sitemap
        for (let i = 0; i < urlsToFetch.length; i++) {
          const url = urlsToFetch[i];
          
          if (debug && (i < 5 || i % 10 === 0)) {
            console.log(`[SitemapCrawler] [${i + 1}/${urlsToFetch.length}] Fetching: ${url}`);
          }
          
          try {
            const response = await axios.get(url, {
              timeout,
              maxRedirects: 5,
              validateStatus: (status) => status < 500,
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              },
            });
            
            const contentType = response.headers["content-type"] || "";
            if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
              const finalUrl = response.request?.res?.responseURL || response.config?.url || url;
              const canonicalUrl = canonicalizeUrl(finalUrl, normalizeOptions);
              
              if (canonicalUrl) {
                // Only add if not already in results (handle redirects that change URL)
                const alreadyInResults = results.some(r => r.url === canonicalUrl);
                if (!alreadyInResults) {
                  visited.add(canonicalUrl);
                  results.push({
                    url: canonicalUrl,
                    html: typeof response.data === "string" ? response.data : String(response.data),
                    statusCode: response.status,
                  });
                  statistics.totalCrawled++;
                  
                  if (debug && results.length <= 10) {
                    console.log(`[SitemapCrawler] ✓ [${results.length}] Fetched: ${canonicalUrl} (status: ${response.status})`);
                  }
                } else if (debug && i < 5) {
                  console.log(`[SitemapCrawler] Skipped duplicate result: ${canonicalUrl}`);
                }
              } else if (debug && i < 5) {
                console.warn(`[SitemapCrawler] Failed to canonicalize final URL: ${finalUrl}`);
              }
            } else if (debug && i < 5) {
              console.log(`[SitemapCrawler] Skipped non-HTML content: ${url} (${contentType})`);
            }
          } catch (error: any) {
            const errorMsg = `Failed to fetch ${url}: ${error.message || "Unknown error"}`;
            statistics.crawlErrors.push(errorMsg);
            if (debug && i < 5) {
              console.warn(`[SitemapCrawler] ✗ ${errorMsg}`);
            }
          }
        }
        
        if (debug) {
          console.log(`[SitemapCrawler] ✓ Successfully fetched ${results.length} pages from sitemap`);
        }
      } else {
        if (debug) console.warn(`[SitemapCrawler] ⚠ Sitemap found but contains no URLs`);
      }
    } catch (error: any) {
      const errorMsg = `Failed to parse sitemap: ${error.message}`;
      statistics.crawlErrors.push(errorMsg);
      if (debug) console.error(`[SitemapCrawler] ✗ ${errorMsg}`);
    }
  } else {
    if (debug) console.log(`[SitemapCrawler] No sitemap found`);
  }

  // STEP 2: Always ensure root page is included
  if (!visited.has(canonicalBase)) {
    if (debug) console.log(`[SitemapCrawler] Fetching root page: ${canonicalBase}`);
    try {
      const response = await axios.get(canonicalBase, {
        timeout,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      
      const contentType = response.headers["content-type"] || "";
      if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
        const finalUrl = response.request?.res?.responseURL || response.config?.url || canonicalBase;
        const canonicalUrl = canonicalizeUrl(finalUrl, normalizeOptions);
        
        if (canonicalUrl && !visited.has(canonicalUrl)) {
          visited.add(canonicalUrl);
          results.unshift({ // Add to front
            url: canonicalUrl,
            html: typeof response.data === "string" ? response.data : String(response.data),
            statusCode: response.status,
          });
          statistics.totalCrawled++;
          if (debug) console.log(`[SitemapCrawler] ✓ Added root page`);
        }
      }
    } catch (error: any) {
      const errorMsg = `Failed to fetch root page: ${error.message || "Unknown error"}`;
      statistics.crawlErrors.push(errorMsg);
      if (debug) console.warn(`[SitemapCrawler] ✗ ${errorMsg}`);
    }
  }

  // Calculate final statistics
  statistics.totalDiscovered = visited.size;
  
  if (debug) {
    console.log(`[SitemapCrawler] Completed crawl:`);
    console.log(`  - Total pages discovered: ${statistics.totalDiscovered}`);
    console.log(`  - Total pages crawled: ${statistics.totalCrawled}`);
    console.log(`  - Sitemap URLs: ${statistics.sitemapUrlCount}`);
    console.log(`  - Errors: ${statistics.crawlErrors.length}`);
    if (results.length === 0) {
      console.warn(`[SitemapCrawler] ⚠ WARNING: No pages were successfully crawled!`);
    } else {
      console.log(`[SitemapCrawler] ✓ Successfully crawled ${results.length} pages`);
    }
  }

  return { pages: results, statistics };
}
