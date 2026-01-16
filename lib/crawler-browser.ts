import puppeteer, { Browser, Page } from "puppeteer";
import { parseSitemap, discoverSitemap } from "./sitemap-parser";
import { canonicalizeUrl, shouldCrawlUrl, type NormalizeOptions } from "./url-normalizer";

const TIMEOUT = 30000; // 30 seconds per page (longer for browser)
const DEFAULT_MAX_PAGES = 200;
const NETWORK_IDLE_TIMEOUT = 2000; // Wait 2 seconds after network is idle

interface CrawlOptions {
  maxPages?: number;
  timeout?: number;
  debug?: boolean;
  headless?: boolean; // Set to false to see browser
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
 * Extracts all internal links from a fully rendered page
 * Uses browser's DOM API to get all links after JavaScript execution
 */
async function extractLinksFromPage(page: Page, baseHostname: string, normalizeOptions: NormalizeOptions, debug: boolean = false): Promise<Set<string>> {
  const links = new Set<string>();

  try {
    // Extract links using browser's DOM API
    const extractedLinks = await page.evaluate((baseHostname) => {
      const foundLinks = new Set<string>();
      const baseHostnameNoWww = baseHostname.replace(/^www\./, "");
      const currentOrigin = window.location.origin;
      const currentHostname = window.location.hostname;
      const currentHostnameNoWww = currentHostname.replace(/^www\./, "");

      // Helper to check if URL is internal
      const isInternal = (url: URL) => {
        const urlHostnameNoWww = url.hostname.replace(/^www\./, "");
        return urlHostnameNoWww === baseHostnameNoWww || 
               urlHostnameNoWww === currentHostnameNoWww ||
               url.origin === currentOrigin ||
               url.hostname === ""; // Relative URLs
      };

      // Get all anchor tags
      document.querySelectorAll("a[href]").forEach((anchor) => {
        const hrefAttr = anchor.getAttribute("href");
        if (!hrefAttr || hrefAttr.trim() === "" || hrefAttr.startsWith("#") || hrefAttr.startsWith("javascript:") || hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) {
          return;
        }
        
        try {
          // Use anchor.href to get fully resolved URL
          const href = (anchor as HTMLAnchorElement).href;
          if (href) {
            const url = new URL(href);
            if (isInternal(url)) {
              foundLinks.add(href);
            }
          }
        } catch {
          // Invalid URL, skip
        }
      });

      // Get all area tags (image maps)
      document.querySelectorAll("area[href]").forEach((area) => {
        const hrefAttr = area.getAttribute("href");
        if (!hrefAttr || hrefAttr.trim() === "" || hrefAttr.startsWith("#") || hrefAttr.startsWith("javascript:")) {
          return;
        }
        try {
          const href = (area as HTMLAreaElement).href;
          if (href) {
            const url = new URL(href);
            if (isInternal(url)) {
              foundLinks.add(href);
            }
          }
        } catch {
          // Invalid URL, skip
        }
      });

      // Get form actions
      document.querySelectorAll("form[action]").forEach((form) => {
        const actionAttr = form.getAttribute("action");
        if (!actionAttr || actionAttr.trim() === "" || actionAttr.startsWith("javascript:")) {
          return;
        }
        try {
          const action = (form as HTMLFormElement).action;
          if (action) {
            const url = new URL(action);
            if (isInternal(url)) {
              foundLinks.add(action);
            }
          }
        } catch {
          // Invalid URL, skip
        }
      });

      // Get link tags (canonical, alternate, etc.)
      document.querySelectorAll('link[rel="canonical"], link[rel="alternate"][href], link[rel="next"][href], link[rel="prev"][href]').forEach((link) => {
        const href = (link as HTMLLinkElement).href;
        if (href) {
          try {
            const url = new URL(href);
            if (isInternal(url)) {
              foundLinks.add(href);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      });
      
      // Also check data attributes that might contain URLs (for SPAs)
      document.querySelectorAll("[data-href], [data-url], [data-link], [data-path], [data-to], [data-route]").forEach((element) => {
        const href = element.getAttribute("data-href") || 
                     element.getAttribute("data-url") || 
                     element.getAttribute("data-link") ||
                     element.getAttribute("data-path") ||
                     element.getAttribute("data-to") ||
                     element.getAttribute("data-route");
        if (href && href.trim() && !href.startsWith("#") && !href.startsWith("javascript:")) {
          try {
            // Resolve relative URLs
            const url = new URL(href, window.location.href);
            if (isInternal(url)) {
              foundLinks.add(url.href);
            }
          } catch {
            // Invalid URL, skip
          }
        }
      });

      return Array.from(foundLinks);
    }, baseHostname);

    // Normalize and filter links
    for (const link of extractedLinks) {
      if (shouldCrawlUrl(link, baseHostname, normalizeOptions, debug)) {
        const normalized = canonicalizeUrl(link, normalizeOptions);
        if (normalized) {
          links.add(normalized);
        }
      }
    }

    if (debug) {
      console.log(`[BrowserCrawler] Extracted ${extractedLinks.length} raw links from DOM`);
      if (extractedLinks.length > 0 && extractedLinks.length <= 10) {
        console.log(`[BrowserCrawler] Sample raw links:`, extractedLinks.slice(0, 5));
      }
      console.log(`[BrowserCrawler] After normalization/filtering: ${links.size} valid internal links`);
      if (links.size > 0 && links.size <= 10) {
        console.log(`[BrowserCrawler] Sample normalized links:`, Array.from(links).slice(0, 5));
      }
    }
  } catch (error: any) {
    if (debug) {
      console.warn(`[BrowserCrawler] Error extracting links: ${error.message}`);
    }
  }

  return links;
}

/**
 * Loads a page in the browser, waits for network idle, and extracts content
 */
async function loadPageInBrowser(
  page: Page,
  url: string,
  timeout: number,
  debug: boolean = false
): Promise<CrawledPage | null> {
  try {
    if (debug) {
      console.log(`[BrowserCrawler] Loading page: ${url}`);
    }

    // Navigate to page
    const response = await page.goto(url, {
      waitUntil: "networkidle2", // Wait for network to be idle (no more than 2 network connections for at least 500ms)
      timeout,
    });

    if (!response) {
      if (debug) console.warn(`[BrowserCrawler] No response for ${url}`);
      return null;
    }

    const statusCode = response.status();
    
    // Only process successful HTML responses
    if (statusCode >= 400) {
      if (debug) console.warn(`[BrowserCrawler] Status ${statusCode} for ${url}`);
      return null;
    }

    const contentType = response.headers()["content-type"] || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      if (debug) console.warn(`[BrowserCrawler] Non-HTML content type: ${contentType} for ${url}`);
      return null;
    }

    // Wait a bit more for any late-loading content
    await new Promise(resolve => setTimeout(resolve, NETWORK_IDLE_TIMEOUT));

    // Get final URL after redirects
    const finalUrl = page.url();

    // Get HTML content
    const html = await page.content();

    if (debug) {
      console.log(`[BrowserCrawler] ✓ Loaded ${finalUrl} (status: ${statusCode}, HTML size: ${html.length} bytes)`);
    }

    return {
      url: finalUrl,
      html,
      statusCode,
    };
  } catch (error: any) {
    if (debug) {
      console.warn(`[BrowserCrawler] ✗ Failed to load ${url}: ${error.message}`);
    }
    return null;
  }
}

/**
 * Browser-based crawler: Uses headless Chromium to fully render pages
 * Architecture:
 *   1. Launch Chromium (headless)
 *   2. Load page fully
 *   3. Wait for network idle
 *   4. Extract all internal links
 *   5. Queue links
 *   6. Repeat for each page
 */
export async function crawlWebsite(
  rootUrl: string,
  options: CrawlOptions = {}
): Promise<{ pages: CrawledPage[]; statistics: CrawlStatistics }> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const timeout = options.timeout ?? TIMEOUT;
  const debug = options.debug ?? false;
  const headless = options.headless !== false; // Default to headless

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
  const urlQueue: string[] = [];
  const results: CrawledPage[] = [];
  const hostname = baseUrl.hostname.toLowerCase();

  // Launch browser
  if (debug) {
    console.log(`[BrowserCrawler] Launching ${headless ? "headless" : "visible"} browser...`);
  }

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await puppeteer.launch({
      headless: headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });

    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    if (debug) {
      console.log(`[BrowserCrawler] ✓ Browser launched`);
    }

    // STEP 1: PRIORITY - Try to discover and use sitemap (primary source)
    if (debug) console.log(`[BrowserCrawler] Discovering sitemap for ${baseUrl.hostname}...`);
    const sitemapUrl = await discoverSitemap(baseUrl, debug);
    
    let useSitemapAsPrimary = false;
    
    if (sitemapUrl) {
      statistics.sitemapFound = true;
      statistics.sitemapUrl = sitemapUrl;
      if (debug) console.log(`[BrowserCrawler] ✓ Found sitemap: ${sitemapUrl}`);
      
      try {
        const sitemapUrls = await parseSitemap(sitemapUrl, debug);
        statistics.sitemapUrlCount = sitemapUrls.length;
        if (debug) console.log(`[BrowserCrawler] ✓ Extracted ${sitemapUrls.length} URLs from sitemap`);
        
        if (sitemapUrls.length > 0) {
          useSitemapAsPrimary = true;
          if (debug) console.log(`[BrowserCrawler] Using sitemap as primary source (${sitemapUrls.length} URLs)`);
          
          // Add sitemap URLs to queue (prioritize them)
          let addedFromSitemap = 0;
          for (const url of sitemapUrls) {
            if (shouldCrawlUrl(url, hostname, normalizeOptions, debug)) {
              const normalized = canonicalizeUrl(url, normalizeOptions);
              if (normalized && !visited.has(normalized)) {
                urlQueue.push(normalized);
                visited.add(normalized);
                addedFromSitemap++;
              }
            }
          }
          
          // Limit to maxPages
          if (urlQueue.length > maxPages) {
            urlQueue.splice(maxPages);
            if (debug) console.log(`[BrowserCrawler] Limited sitemap URLs to ${maxPages} due to page limit`);
          }
          
          if (debug) {
            console.log(`[BrowserCrawler] ✓ Added ${addedFromSitemap} URLs from sitemap to queue`);
            console.log(`[BrowserCrawler] Queue size: ${urlQueue.length}`);
          }
        } else {
          if (debug) console.warn(`[BrowserCrawler] ⚠ Sitemap found but contains no URLs, will use browser discovery`);
        }
      } catch (error: any) {
        const errorMsg = `Failed to parse sitemap: ${error.message}`;
        statistics.crawlErrors.push(errorMsg);
        if (debug) console.warn(`[BrowserCrawler] ✗ ${errorMsg}, falling back to browser discovery`);
      }
    } else {
      if (debug) console.log(`[BrowserCrawler] No sitemap found, will use browser to discover links`);
    }

    // STEP 2: Add root URL if not already in queue
    // If we have sitemap URLs, add root to front. Otherwise, it's already prioritized.
    if (!visited.has(canonicalBase)) {
      if (useSitemapAsPrimary && urlQueue.length > 0) {
        // If using sitemap, add root after first few sitemap URLs
        urlQueue.splice(Math.min(3, urlQueue.length), 0, canonicalBase);
      } else {
        // Otherwise, add to front
        urlQueue.unshift(canonicalBase);
      }
      visited.add(canonicalBase);
      if (debug) console.log(`[BrowserCrawler] ✓ Added root URL to queue: ${canonicalBase}`);
    } else if (debug) {
      console.log(`[BrowserCrawler] Root URL already in queue/visited: ${canonicalBase}`);
    }

    // STEP 3: Crawl pages using browser
    if (debug) {
      console.log(`[BrowserCrawler] Starting crawl (Queue: ${urlQueue.length}, Max: ${maxPages})`);
      if (urlQueue.length === 0) {
        console.warn(`[BrowserCrawler] ⚠ WARNING: Queue is empty! Only root URL will be crawled.`);
      }
    }

    while (urlQueue.length > 0 && results.length < maxPages) {
      const currentUrl = urlQueue.shift()!;
      
      if (debug) {
        console.log(`[BrowserCrawler] [${results.length + 1}/${maxPages}] Crawling: ${currentUrl} (Queue remaining: ${urlQueue.length})`);
      }

      // Load page in browser
      const crawledPage = await loadPageInBrowser(page!, currentUrl, timeout, debug);

      if (!crawledPage) {
        const errorMsg = `Failed to load ${currentUrl}`;
        statistics.crawlErrors.push(errorMsg);
        if (debug) console.warn(`[BrowserCrawler] ✗ ${errorMsg}`);
        continue;
      }

      // Canonicalize final URL (after redirects)
      const canonicalUrl = canonicalizeUrl(crawledPage.url, normalizeOptions);
      if (!canonicalUrl) {
        statistics.crawlErrors.push(`Failed to canonicalize URL: ${crawledPage.url}`);
        continue;
      }

      // Only add if we haven't seen this URL
      if (!visited.has(canonicalUrl)) {
        visited.add(canonicalUrl);
        results.push({
          url: canonicalUrl,
          html: crawledPage.html,
          statusCode: crawledPage.statusCode,
        });
        statistics.totalCrawled++;

        // STEP 4: Extract links from fully rendered page (only if not using sitemap as primary)
        // If sitemap is primary, we still extract links but don't add them to queue (sitemap is more reliable)
        if (results.length < maxPages && urlQueue.length + results.length < maxPages) {
          try {
            const htmlLinks = await extractLinksFromPage(page!, hostname, normalizeOptions, debug);
            const newLinksCount = htmlLinks.size;
            statistics.htmlDiscoveredCount += newLinksCount;

            if (debug && newLinksCount > 0) {
              console.log(`[BrowserCrawler] Found ${newLinksCount} links in ${canonicalUrl}`);
            }

            // Only add HTML-discovered links to queue if:
            // 1. We're not using sitemap as primary source, OR
            // 2. Queue is getting low (less than 10 URLs remaining)
            const shouldAddHtmlLinks = !useSitemapAsPrimary || urlQueue.length < 10;
            
            if (shouldAddHtmlLinks) {
              let addedFromHtml = 0;
              const remainingSlots = maxPages - results.length - urlQueue.length;
              
              for (const link of Array.from(htmlLinks)) {
                if (addedFromHtml >= remainingSlots) {
                  break;
                }
                
                if (!visited.has(link) && !urlQueue.includes(link)) {
                  urlQueue.push(link);
                  addedFromHtml++;
                }
              }
              
              if (debug) {
                if (addedFromHtml > 0) {
                  console.log(`[BrowserCrawler] ✓ Added ${addedFromHtml} new URLs from HTML to queue (Queue size: ${urlQueue.length})`);
                } else if (newLinksCount > 0) {
                  console.log(`[BrowserCrawler] ⚠ Found ${newLinksCount} links but none were added (already visited or filtered)`);
                } else {
                  console.log(`[BrowserCrawler] No links found on page ${canonicalUrl}`);
                }
              }
            } else {
              if (debug) {
                console.log(`[BrowserCrawler] Using sitemap as primary - found ${newLinksCount} HTML links but not adding to queue (sitemap has ${urlQueue.length} URLs)`);
              }
            }
          } catch (error: any) {
            const errorMsg = `Failed to extract links from ${canonicalUrl}: ${error.message || "Unknown error"}`;
            statistics.crawlErrors.push(errorMsg);
            if (debug) console.warn(`[BrowserCrawler] ✗ ${errorMsg}`);
          }
        }
      } else if (debug) {
        console.log(`[BrowserCrawler] Skipped link extraction - already visited: ${canonicalUrl}`);
      }

      // Stop if we've reached the limit
      if (results.length >= maxPages) {
        if (debug) console.log(`[BrowserCrawler] Reached max pages limit (${maxPages})`);
        break;
      }
    }

    // Calculate final statistics
    statistics.totalDiscovered = visited.size;
    
    // FALLBACK: If browser approach failed and we have sitemap URLs, use HTTP fallback
    if (results.length === 0 && statistics.sitemapUrlCount > 0 && statistics.sitemapUrl) {
      if (debug) {
        console.warn(`[BrowserCrawler] ⚠ Browser approach found no pages, falling back to HTTP requests for sitemap URLs`);
      }
      
      // Close browser since we're switching to HTTP
      if (page) {
        await page.close().catch(() => {});
      }
      if (browser) {
        await browser.close().catch(() => {});
      }
      browser = null;
      page = null;
      
      // Use HTTP to fetch sitemap URLs
      const axios = (await import("axios")).default;
      const sitemapUrls = await parseSitemap(statistics.sitemapUrl, debug);
      
      if (debug) {
        console.log(`[BrowserCrawler] Fetching ${Math.min(sitemapUrls.length, maxPages)} URLs via HTTP...`);
      }
      
      const httpResults: CrawledPage[] = [];
      const urlsToFetch = sitemapUrls.slice(0, maxPages);
      
      for (const url of urlsToFetch) {
        if (httpResults.length >= maxPages) break;
        
        if (shouldCrawlUrl(url, hostname, normalizeOptions, debug)) {
          const normalized = canonicalizeUrl(url, normalizeOptions);
          if (!normalized || visited.has(normalized)) continue;
          
          try {
            if (debug && httpResults.length < 5) {
              console.log(`[BrowserCrawler] [HTTP Fallback] Fetching: ${normalized}`);
            }
            
            const response = await axios.get(normalized, {
              timeout: 15000,
              maxRedirects: 5,
              validateStatus: (status) => status < 500,
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
              },
            });
            
            const contentType = response.headers["content-type"] || "";
            if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
              httpResults.push({
                url: normalized,
                html: typeof response.data === "string" ? response.data : String(response.data),
                statusCode: response.status,
              });
              visited.add(normalized);
              statistics.totalCrawled++;
            }
          } catch (error: any) {
            if (debug && httpResults.length < 5) {
              console.warn(`[BrowserCrawler] [HTTP Fallback] Failed: ${normalized} - ${error.message}`);
            }
            statistics.crawlErrors.push(`HTTP fallback failed for ${normalized}: ${error.message}`);
          }
        }
      }
      
      if (httpResults.length > 0) {
        results.push(...httpResults);
        if (debug) {
          console.log(`[BrowserCrawler] ✓ HTTP fallback successfully fetched ${httpResults.length} pages`);
        }
      }
    }
    
    // Ensure at least root page is in results
    if (results.length === 0 && !visited.has(canonicalBase)) {
      if (debug) console.warn(`[BrowserCrawler] ⚠ No pages crawled, attempting to crawl root page...`);
      try {
        // Try HTTP first (faster)
        const axios = (await import("axios")).default;
        const response = await axios.get(canonicalBase, {
          timeout: 15000,
          validateStatus: (status) => status < 500,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
          },
        });
        
        results.push({
          url: canonicalBase,
          html: typeof response.data === "string" ? response.data : String(response.data),
          statusCode: response.status,
        });
        statistics.totalCrawled++;
        if (debug) console.log(`[BrowserCrawler] ✓ Added root page via HTTP`);
      } catch (error: any) {
        // Try browser as last resort
        if (page && browser) {
          try {
            const rootPage = await loadPageInBrowser(page, canonicalBase, timeout, debug);
            if (rootPage) {
              results.push({
                url: canonicalBase,
                html: rootPage.html,
                statusCode: rootPage.statusCode,
              });
              statistics.totalCrawled++;
              if (debug) console.log(`[BrowserCrawler] ✓ Added root page via browser`);
            }
          } catch (browserError: any) {
            if (debug) console.error(`[BrowserCrawler] ✗ Failed to crawl root page: ${browserError.message}`);
          }
        }
      }
    }
    
    if (debug) {
      console.log(`[BrowserCrawler] Completed crawl:`);
      console.log(`  - Total pages discovered: ${statistics.totalDiscovered}`);
      console.log(`  - Total pages crawled: ${statistics.totalCrawled}`);
      console.log(`  - Sitemap URLs: ${statistics.sitemapUrlCount}`);
      console.log(`  - HTML discovered: ${statistics.htmlDiscoveredCount}`);
      console.log(`  - Errors: ${statistics.crawlErrors.length}`);
      if (results.length === 0) {
        console.warn(`[BrowserCrawler] ⚠ WARNING: No pages were successfully crawled!`);
      } else {
        console.log(`[BrowserCrawler] ✓ Successfully crawled ${results.length} pages`);
      }
    }

    return { pages: results, statistics };
  } finally {
    // Clean up browser
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
      if (debug) {
        console.log(`[BrowserCrawler] Browser closed`);
      }
    }
  }
}
