import axios from "axios";
import * as cheerio from "cheerio";
import { parseSitemap, discoverSitemap } from "./sitemap-parser";
import { canonicalizeUrl, shouldCrawlUrl, type NormalizeOptions } from "./url-normalizer";

const TIMEOUT = 15000; // 15 seconds per page
const MAX_CONCURRENT = 5; // Limit concurrent requests
const DEFAULT_MAX_PAGES = 200; // Default limit for production sites (increased from 50)

interface CrawlOptions {
  maxPages?: number;
  maxConcurrent?: number;
  timeout?: number;
  debug?: boolean; // Enable detailed logging
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
 * WHY: Security measure to prevent server-side request forgery attacks
 */
function isSafeUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  
  // Block localhost and loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("127.") ||
    hostname.startsWith("0.0.0.0")
  ) {
    return false;
  }

  // Block private IP ranges
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
 * Extracts all links from HTML content (comprehensive extraction)
 * WHY: Modern sites have links in various places - we need to catch them all
 */
function extractLinksFromHtml(html: string, baseUrl: URL, normalizeOptions: NormalizeOptions, debug: boolean = false): Set<string> {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  // Store original base URL hostname for shouldCrawlUrl checks
  // WHY: We need to check against the original site's hostname, not the base tag's hostname
  const originalBaseHostname = normalizeOptions.baseUrl.hostname;

  // Get base tag href if present (affects relative URL resolution)
  // WHY: <base> tag changes how relative URLs are resolved
  const baseTag = $("base[href]").first();
  let baseHref: URL | null = null;
  if (baseTag.length > 0) {
    try {
      const baseHrefAttr = baseTag.attr("href");
      if (baseHrefAttr) {
        // Resolve base href relative to current page URL
        baseHref = new URL(baseHrefAttr, baseUrl);
        if (debug) {
          console.log(`[LinkExtraction] Found <base> tag: ${baseHrefAttr} -> ${baseHref.href}`);
        }
        // Create new normalizeOptions for URL resolution, but keep original baseUrl for hostname checks
        normalizeOptions = { ...normalizeOptions, baseUrl: baseHref };
      }
    } catch (error) {
      if (debug) {
        console.warn(`[LinkExtraction] Invalid base tag: ${baseTag.attr("href")}`, error);
      }
      // Invalid base tag, ignore
    }
  }
  const effectiveBaseUrl = baseHref || baseUrl;

  // Extract from ALL anchor tags
  // WHY: Using "a[href]" gets all links
  let anchorCount = 0;
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.trim() === "") return;
    anchorCount++;

      // Resolve relative URLs using effective base URL
      try {
        const resolvedUrl = new URL(href, effectiveBaseUrl).href;
        // Use original base hostname for shouldCrawlUrl check, not base tag hostname
        if (shouldCrawlUrl(resolvedUrl, originalBaseHostname, normalizeOptions, debug)) {
        const normalized = canonicalizeUrl(resolvedUrl, normalizeOptions);
        if (normalized) {
          links.add(normalized);
          if (debug && links.size <= 5) {
            console.log(`[LinkExtraction] Added link from <a>: ${href} -> ${normalized}`);
          }
        } else if (debug) {
          console.warn(`[LinkExtraction] Failed to normalize URL from <a>: ${href}`);
        }
      } else if (debug && links.size < 10) {
        console.log(`[LinkExtraction] Rejected link from <a> (not crawlable): ${href}`);
      }
    } catch (error) {
      if (debug) {
        console.warn(`[LinkExtraction] Invalid URL from <a>: ${href}`, error);
      }
      // Invalid URL, skip
    }
  });
  if (debug) {
    console.log(`[LinkExtraction] Found ${anchorCount} anchor tags, extracted ${links.size} unique links so far`);
  }

  // Extract from <area> tags in image maps
  // WHY: Image maps can contain clickable links
  $("area[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.trim() === "") return;

    try {
      const resolvedUrl = new URL(href, effectiveBaseUrl).href;
      if (shouldCrawlUrl(resolvedUrl, originalBaseHostname, normalizeOptions)) {
        const normalized = canonicalizeUrl(resolvedUrl, normalizeOptions);
        if (normalized) {
          links.add(normalized);
        }
      }
    } catch {
      // Invalid URL, skip
    }
  });

  // Extract from <link> tags (canonical, alternate, etc.)
  // WHY: Link tags can point to alternate versions or canonical URLs
  $('link[rel][href]').each((_, element) => {
    const rel = $(element).attr("rel");
    const href = $(element).attr("href");
    
    // Extract from various link types that might contain URLs
    if (href && (rel === "canonical" || rel === "alternate" || rel === "next" || rel === "prev")) {
      try {
        const resolvedUrl = new URL(href, effectiveBaseUrl).href;
        if (shouldCrawlUrl(resolvedUrl, originalBaseHostname, normalizeOptions)) {
          const normalized = canonicalizeUrl(resolvedUrl, normalizeOptions);
          if (normalized) {
            links.add(normalized);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  // Extract from <form> action attributes
  // WHY: Forms can submit to different pages
  $("form[action]").each((_, element) => {
    const action = $(element).attr("action");
    if (!action || action.trim() === "") return;

    try {
      const resolvedUrl = new URL(action, effectiveBaseUrl).href;
      if (shouldCrawlUrl(resolvedUrl, originalBaseHostname, normalizeOptions)) {
        const normalized = canonicalizeUrl(resolvedUrl, normalizeOptions);
        if (normalized) {
          links.add(normalized);
        }
      }
    } catch {
      // Invalid URL, skip
    }
  });

  // Extract from meta refresh redirects
  // WHY: Some sites use meta refresh for redirects
  $('meta[http-equiv="refresh"]').each((_, element) => {
    const content = $(element).attr("content");
    if (content) {
      // Format: "0;url=https://example.com" or "5; URL=https://example.com"
      const urlMatch = content.match(/url\s*=\s*([^;,\s]+)/i);
      if (urlMatch) {
        const href = urlMatch[1].trim();
        try {
          const resolvedUrl = new URL(href, effectiveBaseUrl).href;
          if (shouldCrawlUrl(resolvedUrl, originalBaseHostname, normalizeOptions)) {
            const normalized = canonicalizeUrl(resolvedUrl, normalizeOptions);
            if (normalized) {
              links.add(normalized);
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    }
  });

  // Extract from JavaScript-rendered navigation (enhanced patterns for SPAs)
  // WHY: Some sites have URLs in JavaScript that might be rendered client-side
  // This is a basic extraction - full JS parsing would require a browser
  const jsUrlPatterns = [
    // Standard href assignments
    /href\s*[:=]\s*["']([^"']+)["']/gi,
    /url\s*[:=]\s*["']([^"']+)["']/gi,
    /path\s*[:=]\s*["']([^"']+)["']/gi,
    /route\s*[:=]\s*["']([^"']+)["']/gi,
    // Location assignments
    /location\.href\s*=\s*["']([^"']+)["']/gi,
    /window\.location\s*=\s*["']([^"']+)["']/gi,
    /location\.replace\s*\(\s*["']([^"']+)["']/gi,
    /location\.assign\s*\(\s*["']([^"']+)["']/gi,
    /location\.pathname\s*=\s*["']([^"']+)["']/gi,
    // Router patterns (React Router, Vue Router, Next.js, etc.)
    /router\.(push|replace)\s*\(\s*["']([^"']+)["']/gi,
    /router\.(push|replace)\s*\(\s*\{[^}]*path\s*[:=]\s*["']([^"']+)["']/gi,
    /navigate\s*\(\s*["']([^"']+)["']/gi,
    /navigate\s*\(\s*\{[^}]*to\s*[:=]\s*["']([^"']+)["']/gi,
    /history\.(push|replace)\s*\(\s*["']([^"']+)["']/gi,
    /history\.(push|replace)\s*\(\s*\{[^}]*pathname\s*[:=]\s*["']([^"']+)["']/gi,
    // Next.js specific patterns
    /Link\s+.*href\s*=\s*["']([^"']+)["']/gi,
    /useRouter\(\)\.push\s*\(\s*["']([^"']+)["']/gi,
    // React Router specific
    /<Link[^>]+to\s*=\s*["']([^"']+)["']/gi,
    /<NavLink[^>]+to\s*=\s*["']([^"']+)["']/gi,
    // Vue Router specific
    /this\.\$router\.(push|replace)\s*\(\s*["']([^"']+)["']/gi,
    /router-link.*to\s*=\s*["']([^"']+)["']/gi,
    // URL patterns in data attributes (already handled separately, but include for completeness)
    /data-[\w-]+-url\s*=\s*["']([^"']+)["']/gi,
    /data-[\w-]+-href\s*=\s*["']([^"']+)["']/gi,
    /data-[\w-]+-path\s*=\s*["']([^"']+)["']/gi,
    // JSON data structures (routes, navigation, etc.)
    /["']url["']\s*:\s*["']([^"']+)["']/gi,
    /["']href["']\s*:\s*["']([^"']+)["']/gi,
    /["']link["']\s*:\s*["']([^"']+)["']/gi,
    /["']path["']\s*:\s*["']([^"']+)["']/gi,
    /["']route["']\s*:\s*["']([^"']+)["']/gi,
    /["']pathname["']\s*:\s*["']([^"']+)["']/gi,
    /["']to["']\s*:\s*["']([^"']+)["']/gi,
    // Array of routes
    /\[[^\]]*\{[^}]*path\s*[:=]\s*["']([^"']+)["']/gi,
    /\[[^\]]*\{[^}]*url\s*[:=]\s*["']([^"']+)["']/gi,
  ];

  $("script").each((_, element) => {
    const scriptContent = $(element).html() || "";
    jsUrlPatterns.forEach(pattern => {
      let match;
      // Reset regex lastIndex to avoid issues with global regex
      pattern.lastIndex = 0;
      while ((match = pattern.exec(scriptContent)) !== null) {
        // Extract URL from match (could be in different capture groups)
        const href = match[match.length - 1]; // Get last capture group
        if (href && 
            !href.startsWith("javascript:") && 
            !href.startsWith("#") &&
            !href.startsWith("mailto:") &&
            !href.startsWith("tel:") &&
            href.length > 1) {
          try {
            const resolvedUrl = new URL(href, effectiveBaseUrl).href;
            if (shouldCrawlUrl(resolvedUrl, normalizeOptions.baseUrl.hostname, normalizeOptions)) {
              const normalized = canonicalizeUrl(resolvedUrl, normalizeOptions);
              if (normalized) {
                links.add(normalized);
              }
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    });
  });

  // Extract from data attributes that might contain URLs
  // WHY: Some frameworks store URLs in data attributes (React, Vue, etc.)
  const dataAttrSelectors = [
    "[data-url]", "[data-href]", "[data-link]", "[data-path]",
    "[data-route]", "[data-to]", "[data-navigate]", "[data-navigation]",
    "[data-page]", "[data-page-url]", "[data-page-path]",
  ];
  
  dataAttrSelectors.forEach(selector => {
    $(selector).each((_, element) => {
      const urlAttr = $(element).attr("data-url") || 
                      $(element).attr("data-href") || 
                      $(element).attr("data-link") ||
                      $(element).attr("data-path") ||
                      $(element).attr("data-route") ||
                      $(element).attr("data-to") ||
                      $(element).attr("data-navigate") ||
                      $(element).attr("data-navigation") ||
                      $(element).attr("data-page") ||
                      $(element).attr("data-page-url") ||
                      $(element).attr("data-page-path");
      if (urlAttr && urlAttr.trim()) {
        try {
          const resolvedUrl = new URL(urlAttr, effectiveBaseUrl).href;
          if (shouldCrawlUrl(resolvedUrl, originalBaseHostname, normalizeOptions)) {
            const normalized = canonicalizeUrl(resolvedUrl, normalizeOptions);
            if (normalized) {
              links.add(normalized);
              if (debug && links.size <= 10) {
                console.log(`[LinkExtraction] Added link from data attribute: ${urlAttr} -> ${normalized}`);
              }
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });
  });

  if (debug) {
    console.log(`[LinkExtraction] Total unique links extracted: ${links.size}`);
  }
  return links;
}

const MAX_FETCH_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Base delay in milliseconds

/**
 * Fetches a single page with timeout, retry logic, and error handling
 * WHY: Individual page failures shouldn't stop the entire crawl, but we should retry transient failures
 */
async function fetchPage(url: string, timeout: number, retries: number = MAX_FETCH_RETRIES): Promise<CrawledPage | null> {
  let lastError: any = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout,
        maxRedirects: 10, // Increased to handle complex redirect chains
        validateStatus: (status) => status < 500, // Accept 4xx but not 5xx
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
        // Handle compressed responses
        decompress: true,
      });

      // Get final URL after redirects
      const finalUrl = response.request?.res?.responseUrl || 
                       response.request?.responseURL || 
                       response.config?.url || 
                       url;

      // Validate response is HTML (or at least text)
      const contentType = response.headers["content-type"] || "";
      const isHtml = contentType.includes("text/html") || 
                     contentType.includes("application/xhtml") ||
                     (typeof response.data === "string" && response.data.trim().startsWith("<"));

      if (!isHtml && response.status < 400) {
        // Not HTML content, skip but don't treat as error
        return null;
      }

      return {
        url: finalUrl,
        html: typeof response.data === "string" ? response.data : String(response.data),
        statusCode: response.status,
      };
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on client errors (4xx) except 408 (Request Timeout) and 429 (Too Many Requests)
      if (error.response) {
        const status = error.response.status;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          // Client error that won't be fixed by retrying
          return null;
        }
      }
      
      // Don't retry on network errors if it's the last attempt
      if (attempt === retries - 1) {
        return null;
      }
      
      // Exponential backoff with jitter
      const delay = RETRY_DELAY_BASE * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  return null;
}

/**
 * Multi-source crawler: Sitemap-first with HTML fallback
 * WHY: Modern production sites expose pages via sitemap.xml which is more reliable than HTML crawling
 */
export async function crawlWebsite(
  rootUrl: string,
  options: CrawlOptions = {}
): Promise<{ pages: CrawledPage[]; statistics: CrawlStatistics }> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxConcurrent = options.maxConcurrent ?? MAX_CONCURRENT;
  const timeout = options.timeout ?? TIMEOUT;
  const debug = options.debug ?? false;

  // Initialize statistics tracking
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
    // Ensure URL has protocol
    let normalizedRoot = rootUrl.trim();
    if (!normalizedRoot.startsWith("http://") && !normalizedRoot.startsWith("https://")) {
      normalizedRoot = `https://${normalizedRoot}`;
    }
    
    baseUrl = new URL(normalizedRoot);
    
    // Force HTTPS for consistency
    // WHY: http:// and https:// should be treated as the same for crawling
    if (baseUrl.protocol === "http:") {
      baseUrl.protocol = "https:";
    }
    
    if (!isSafeUrl(baseUrl)) {
      throw new Error("Root URL is not safe to crawl (SSRF protection)");
    }
  } catch (error: any) {
    throw new Error(`Invalid root URL: ${error.message}`);
  }

  // Prepare normalization options based on base URL
  // WHY: We need consistent URL normalization throughout the crawl
  const normalizeOptions: NormalizeOptions = {
    baseUrl,
    forceHttps: true,
    // Preserve www/non-www based on input URL
    preserveWww: baseUrl.hostname.startsWith("www."),
  };

  // Canonicalize base URL
  const canonicalBase = canonicalizeUrl(baseUrl, normalizeOptions);
  if (!canonicalBase) {
    throw new Error("Failed to canonicalize base URL");
  }

  const visited = new Set<string>();
  const urlQueue: string[] = [];
  const results: CrawledPage[] = [];
  const hostname = baseUrl.hostname.toLowerCase();

  // STEP 1: Try to fetch sitemap.xml (PRIMARY SOURCE)
  // WHY: Sitemaps are the most reliable way to discover all pages on modern sites
  if (debug) console.log(`[Crawler] Discovering sitemap for ${baseUrl.hostname}...`);
  const sitemapUrl = await discoverSitemap(baseUrl, debug);
  
  if (sitemapUrl) {
    statistics.sitemapFound = true;
    statistics.sitemapUrl = sitemapUrl;
    if (debug) console.log(`[Crawler] ✓ Found sitemap: ${sitemapUrl}`);
    
    try {
      if (debug) console.log(`[Crawler] Parsing sitemap: ${sitemapUrl}`);
      const sitemapUrls = await parseSitemap(sitemapUrl, debug);
      statistics.sitemapUrlCount = sitemapUrls.length;
      if (debug) {
        console.log(`[Crawler] ✓ Extracted ${sitemapUrls.length} URLs from sitemap`);
        if (sitemapUrls.length > 0 && sitemapUrls.length <= 10) {
          console.log(`[Crawler] Sample sitemap URLs:`, sitemapUrls.slice(0, 5));
        }
      }
      
      // Add sitemap URLs to queue (PRIORITIZED)
      // WHY: Sitemap URLs are pre-validated and represent all pages the site wants indexed
      // We prioritize sitemap URLs over HTML-discovered URLs
      let addedFromSitemap = 0;
      const sitemapUrlsToAdd: string[] = [];
      
      let sitemapUrlsFiltered = 0;
      for (const url of sitemapUrls) {
        if (shouldCrawlUrl(url, hostname, normalizeOptions, debug)) {
          const normalized = canonicalizeUrl(url, normalizeOptions);
          if (normalized && !visited.has(normalized)) {
            sitemapUrlsToAdd.push(normalized);
            visited.add(normalized);
            if (debug && sitemapUrlsToAdd.length <= 5) {
              console.log(`[Crawler] Added sitemap URL: ${url} -> ${normalized}`);
            }
          } else {
            if (debug && sitemapUrlsFiltered < 5) {
              console.log(`[Crawler] Skipped sitemap URL (already visited or failed normalization): ${url}`);
            }
            sitemapUrlsFiltered++;
          }
        } else {
          if (debug && sitemapUrlsFiltered < 5) {
            console.log(`[Crawler] Filtered sitemap URL (not crawlable): ${url}`);
          }
          sitemapUrlsFiltered++;
        }
      }
      if (debug && sitemapUrlsFiltered > 0) {
        console.log(`[Crawler] Filtered ${sitemapUrlsFiltered} sitemap URLs (not crawlable or duplicates)`);
      }
      
      // Limit sitemap URLs to maxPages, but prioritize them
      const sitemapLimit = Math.min(sitemapUrlsToAdd.length, maxPages);
      for (let i = 0; i < sitemapLimit; i++) {
        urlQueue.push(sitemapUrlsToAdd[i]);
        addedFromSitemap++;
      }
      
      if (debug) {
        console.log(`[Crawler] ✓ Added ${addedFromSitemap} URLs from sitemap to queue (${sitemapUrlsToAdd.length} total valid, ${sitemapUrls.length} total in sitemap)`);
        if (sitemapUrlsToAdd.length > maxPages) {
          console.log(`[Crawler] ⚠ Limited sitemap URLs to ${maxPages} due to page limit`);
        }
        console.log(`[Crawler] Queue size after sitemap: ${urlQueue.length}, Results: ${results.length}`);
      }
    } catch (error: any) {
      // Fail gracefully - continue with HTML crawling if sitemap fails
      const errorMsg = `Failed to parse sitemap: ${error.message}`;
      statistics.crawlErrors.push(errorMsg);
      if (debug) console.warn(`[Crawler] ${errorMsg}`);
    }
  } else {
    if (debug) console.log(`[Crawler] No sitemap found, will use HTML crawling only`);
  }

  // STEP 2: Add root URL if not already in queue (but only if we have room)
  // WHY: Always crawl the root page, even if not in sitemap
  const canonicalRoot = canonicalizeUrl(baseUrl, normalizeOptions);
  if (canonicalRoot && !visited.has(canonicalRoot) && urlQueue.length + results.length < maxPages) {
    // Prepend root URL to prioritize it
    urlQueue.unshift(canonicalRoot);
    visited.add(canonicalRoot);
    if (debug) {
      console.log(`[Crawler] ✓ Added root URL to queue: ${canonicalRoot}`);
    }
  } else if (debug) {
    if (visited.has(canonicalRoot)) {
      console.log(`[Crawler] Root URL already in queue/visited: ${canonicalRoot}`);
    } else {
      console.log(`[Crawler] Skipped root URL - would exceed page limit`);
    }
  }

  // STEP 3: Crawl pages (breadth-first)
  // WHY: Breadth-first ensures we discover pages level by level
  let iteration = 0;
  while (urlQueue.length > 0 && results.length < maxPages) {
    iteration++;
    // Process a batch of URLs concurrently
    const batchSize = Math.min(maxConcurrent, urlQueue.length, maxPages - results.length);
    const batch = urlQueue.splice(0, batchSize);
    
    if (debug) {
      console.log(`[Crawler] Iteration ${iteration}: Processing batch of ${batch.length} URLs (Queue: ${urlQueue.length}, Results: ${results.length}/${maxPages})`);
    }
    
    // Use Promise.allSettled to handle partial batch failures gracefully
    const batchPromises = batch.map(url => fetchPage(url, timeout));
    const batchResults = await Promise.allSettled(batchPromises);

    for (let i = 0; i < batchResults.length; i++) {
      const result = batchResults[i];
      const originalUrl = batch[i];
      
      if (result.status === "rejected") {
        const errorMsg = `Failed to fetch ${originalUrl}: ${result.reason?.message || "Unknown error"}`;
        statistics.crawlErrors.push(errorMsg);
        if (debug) console.warn(`[Crawler] ✗ ${errorMsg}`);
        continue;
      }

      const page = result.value;
      if (!page) {
        // Page fetch returned null (non-HTML content, client error, etc.)
        if (debug) {
          console.log(`[Crawler] Skipped ${originalUrl} - fetch returned null (non-HTML or error)`);
        }
        continue;
      }
      
      if (debug) {
        console.log(`[Crawler] ✓ Fetched ${originalUrl} -> ${page.url} (status: ${page.statusCode})`);
      }

      // Canonicalize the final URL (after redirects)
      const canonicalUrl = canonicalizeUrl(page.url, normalizeOptions);
      if (!canonicalUrl) {
        const errorMsg = `Failed to canonicalize URL: ${page.url}`;
        statistics.crawlErrors.push(errorMsg);
        if (debug) console.warn(`[Crawler] ${errorMsg}`);
        continue;
      }

      // Only add if we haven't seen this canonical URL and haven't exceeded limit
      if (!visited.has(canonicalUrl) && results.length < maxPages) {
        visited.add(canonicalUrl);
        results.push({
          url: canonicalUrl,
          html: page.html,
          statusCode: page.statusCode,
        });
        statistics.totalCrawled++;

        // STEP 4: Extract additional links from HTML (SECONDARY SOURCE)
        // WHY: Some pages might not be in sitemap, or sitemap might be incomplete
        if (results.length < maxPages && urlQueue.length + results.length < maxPages) {
          try {
            const pageUrl = new URL(canonicalUrl);
            const htmlLinks = extractLinksFromHtml(page.html, pageUrl, normalizeOptions, debug);
            const newLinksCount = htmlLinks.size;
            statistics.htmlDiscoveredCount += newLinksCount;

            if (debug && newLinksCount > 0) {
              console.log(`[Crawler] Found ${newLinksCount} links in ${canonicalUrl}`);
            }

            let addedFromHtml = 0;
            let skippedFromHtml = 0;
            const remainingSlots = maxPages - results.length - urlQueue.length;
            
            // Prioritize adding links if we have room
            // Note: Links from extractLinksFromHtml are already normalized, so we don't need to normalize again
            for (const link of Array.from(htmlLinks)) {
              if (addedFromHtml >= remainingSlots) {
                if (debug) {
                  console.log(`[Crawler] Stopped adding HTML links - reached remaining slots limit (${remainingSlots})`);
                }
                break; // Stop if we've filled available slots
              }
              
              // Link is already normalized from extractLinksFromHtml, so use it directly
              if (!visited.has(link) && !urlQueue.includes(link)) {
                urlQueue.push(link);
                addedFromHtml++;
                if (debug && addedFromHtml <= 5) {
                  console.log(`[Crawler] Added HTML link to queue: ${link}`);
                }
              } else {
                skippedFromHtml++;
              }
            }
            
            if (debug) {
              console.log(`[Crawler] Added ${addedFromHtml} new URLs from HTML to queue (${skippedFromHtml} skipped - already visited/queued)`);
            }
          } catch (error: any) {
            // Continue crawling even if link extraction fails
            // WHY: One page's link extraction failure shouldn't stop the entire crawl
            const errorMsg = `Failed to extract links from ${canonicalUrl}: ${error.message || "Unknown error"}`;
            statistics.crawlErrors.push(errorMsg);
            if (debug) console.warn(`[Crawler] ${errorMsg}`);
          }
        }
      }
    }

    // Stop if we've reached the limit
    if (results.length >= maxPages) {
      if (debug) console.log(`[Crawler] Reached max pages limit (${maxPages})`);
      break;
    }
    
    // Prevent infinite loops if queue keeps growing
    if (urlQueue.length > maxPages * 2) {
      if (debug) console.warn(`[Crawler] Queue size (${urlQueue.length}) exceeds safe limit, truncating`);
      urlQueue.splice(maxPages);
    }
  }

  // Calculate final statistics
  statistics.totalDiscovered = visited.size;
  
  if (debug) {
    console.log(`[Crawler] Completed crawl:`);
    console.log(`  - Total pages discovered: ${statistics.totalDiscovered}`);
    console.log(`  - Total pages crawled: ${statistics.totalCrawled}`);
    console.log(`  - Sitemap URLs: ${statistics.sitemapUrlCount}`);
    console.log(`  - HTML discovered: ${statistics.htmlDiscoveredCount}`);
    console.log(`  - Errors: ${statistics.crawlErrors.length}`);
  }

  return { pages: results, statistics };
}
