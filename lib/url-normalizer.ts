/**
 * Comprehensive URL normalization for reliable deduplication
 * WHY: URLs can be written in many ways but point to the same page:
 * - http vs https
 * - www vs non-www
 * - trailing slashes
 * - query parameters (tracking, UTM, etc.)
 * - hash fragments
 */

export interface NormalizeOptions {
  baseUrl: URL;
  forceHttps?: boolean;
  removeWww?: boolean;
  preserveWww?: boolean;
}

/**
 * Normalizes a URL to a canonical form for deduplication
 * WHY: This ensures we don't crawl the same page multiple times due to URL variations
 */
export function canonicalizeUrl(
  url: string | URL,
  options: NormalizeOptions
): string | null {
  try {
    let urlObj: URL;

    // Convert string to URL object
    if (typeof url === "string") {
      url = url.trim();
      if (!url) return null;

      // Remove hash fragments immediately
      // WHY: Hash fragments (#section) don't change the page content
      url = url.split("#")[0].trim();
      if (!url) return null;

      // Skip invalid protocols
      const lowerUrl = url.toLowerCase();
      if (
        lowerUrl.startsWith("mailto:") ||
        lowerUrl.startsWith("tel:") ||
        lowerUrl.startsWith("javascript:") ||
        lowerUrl.startsWith("data:") ||
        lowerUrl.startsWith("ftp:") ||
        lowerUrl.startsWith("file:")
      ) {
        return null;
      }

      // Normalize double slashes in protocol (http:/// -> http://)
      url = url.replace(/^([a-z]+:)\/\/+/i, "$1//");

      // Handle relative URLs
      if (url.startsWith("http://") || url.startsWith("https://")) {
        try {
          urlObj = new URL(url);
        } catch {
          // Try decoding if URL parsing fails
          try {
            url = decodeURIComponent(url);
            urlObj = new URL(url);
          } catch {
            return null;
          }
        }
      } else if (url.startsWith("//")) {
        // Protocol-relative URL
        urlObj = new URL(options.baseUrl.protocol + url);
      } else if (url.startsWith("/")) {
        // Absolute path
        urlObj = new URL(url, options.baseUrl.origin);
      } else {
        // Relative path
        urlObj = new URL(url, options.baseUrl);
      }
    } else {
      urlObj = url;
    }

    // Force HTTPS if requested
    // WHY: Modern sites should use HTTPS, and http://example.com and https://example.com are the same page
    if (options.forceHttps && urlObj.protocol === "http:") {
      urlObj.protocol = "https:";
    }

    // Remove default ports (80 for HTTP, 443 for HTTPS)
    // WHY: https://example.com:443 and https://example.com are the same
    if ((urlObj.protocol === "http:" && urlObj.port === "80") ||
        (urlObj.protocol === "https:" && urlObj.port === "443")) {
      urlObj.port = "";
    }

    // Normalize www vs non-www based on base URL
    // WHY: www.example.com and example.com are the same site, we need consistent handling
    const baseHostname = options.baseUrl.hostname.toLowerCase();
    const urlHostname = urlObj.hostname.toLowerCase();
    
    // Remove www for consistent comparison (but preserve subdomains)
    // WHY: We only normalize www, not other subdomains (e.g., blog.example.com should stay)
    const baseHostnameNoWww = baseHostname.replace(/^www\./, "");
    const urlHostnameNoWww = urlHostname.replace(/^www\./, "");
    
    // If hostnames match (ignoring www), normalize to match base URL
    // Don't normalize if they're different subdomains
    if (baseHostnameNoWww === urlHostnameNoWww) {
      if (baseHostname.startsWith("www.")) {
        // Base URL has www - ensure all URLs use www
        if (!urlHostname.startsWith("www.")) {
          urlObj.hostname = "www." + urlHostnameNoWww;
        }
      } else {
        // Base URL doesn't have www - remove www from all URLs
        if (urlHostname.startsWith("www.")) {
          urlObj.hostname = urlHostnameNoWww;
        }
      }
    }
    // If hostnames don't match (different subdomains), leave as-is
    // WHY: blog.example.com and www.example.com are different sites

    // Normalize pathname: remove double slashes, normalize index pages
    // WHY: /page//subpage and /page/subpage are the same
    let pathname = urlObj.pathname;
    
    // Remove double slashes (but preserve protocol slashes)
    pathname = pathname.replace(/\/+/g, "/");
    
    // Normalize index pages (index.html, index.php, etc. -> /)
    // WHY: /index.html and / are the same page
    const indexPatterns = [
      /\/index\.html?$/i,
      /\/index\.php$/i,
      /\/index\.aspx?$/i,
      /\/index\.jsp$/i,
      /\/index\.cgi$/i,
      /\/default\.html?$/i,
      /\/default\.php$/i,
      /\/default\.aspx?$/i,
    ];
    for (const pattern of indexPatterns) {
      if (pattern.test(pathname)) {
        pathname = pathname.replace(pattern, "/");
        break;
      }
    }

    // Remove trailing slash except for root
    // WHY: /page/ and /page are the same page, but / and /page are different
    if (pathname !== "/" && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    // Ensure valid pathname
    if (!pathname || pathname === "") {
      pathname = "/";
    }

    urlObj.pathname = pathname;

    // Remove query parameters
    // WHY: ?utm_source=google and ?ref=home point to the same page content
    // Tracking params, UTM params, etc. don't change the actual page
    urlObj.search = "";

    // Remove hash fragments (already done above, but ensure)
    urlObj.hash = "";

    // Convert hostname to lowercase for consistency
    // WHY: URLs are case-sensitive in paths but hostnames should be normalized
    urlObj.hostname = urlObj.hostname.toLowerCase();

    return urlObj.href;
  } catch (error) {
    // Invalid URL - return null instead of throwing
    return null;
  }
}

/**
 * Checks if URL should be crawled (same hostname, valid format)
 * WHY: We only want to crawl internal pages, not external links
 */
export function shouldCrawlUrl(
  url: string | URL,
  baseHostname: string,
  options: NormalizeOptions
): boolean {
  try {
    const normalized = canonicalizeUrl(url, options);
    if (!normalized) return false;

    const urlObj = new URL(normalized);
    const normalizedHostname = urlObj.hostname.toLowerCase();
    const baseHostnameLower = baseHostname.toLowerCase();

    // Must be same hostname (after www normalization)
    // WHY: We only crawl internal pages, external links are out of scope
    // Compare hostnames ignoring www prefix
    const normalizedHostnameNoWww = normalizedHostname.replace(/^www\./, "");
    const baseHostnameNoWww = baseHostnameLower.replace(/^www\./, "");
    
    if (normalizedHostnameNoWww !== baseHostnameNoWww) {
      return false;
    }

    // Skip file extensions we don't want
    // WHY: Images, PDFs, assets don't need SEO analysis
    const lowerPath = urlObj.pathname.toLowerCase();
    const skipExtensions = [
      ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".ico",
      ".zip", ".exe", ".dmg", ".css", ".js", ".json", ".xml", ".txt",
      ".mp4", ".mp3", ".avi", ".mov", ".wmv", ".flv", ".webm",
      ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ];

    if (skipExtensions.some(ext => lowerPath.endsWith(ext))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
