import axios from "axios";
import * as cheerio from "cheerio";
import type { SitemapUrlWithAlternates } from "@/lib/alternate-validator";
import type { AlternateLink } from "@/lib/alternate-validator";

const SITEMAP_TIMEOUT = 15000; // 15 seconds for sitemap requests
const MAX_SITEMAP_DEPTH = 10; // Prevent infinite recursion in nested sitemap indexes
const MAX_RETRIES = 3; // Retry failed sitemap fetches

export interface SitemapParseResult {
  urls: string[];
  isIndex: boolean;
  childSitemaps: string[];
}

/**
 * True when a loc looks like another sitemap file rather than a page.
 * WHY: sitemapindex files list child .xml sitemaps (e.g. sitemap-en-US.xml).
 * If index detection fails, those locs must still be followed — not crawled as pages.
 */
export function looksLikeSitemapUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return (
      pathname.includes("sitemap") &&
      (pathname.endsWith(".xml") || pathname.endsWith(".xml.gz") || pathname.endsWith(".gz"))
    );
  } catch {
    return false;
  }
}

function loadSitemapDocument(contentText: string): cheerio.CheerioAPI {
  // Cheerio's css-select does not support namespaced tag names (xhtml:link)
  const contentWithoutNamespaces = contentText.replace(
    /<(\/?)([a-zA-Z]+):([a-zA-Z]+)/g,
    "<$1$3"
  );
  return cheerio.load(contentWithoutNamespaces, { xmlMode: true });
}

function getRootTagName($: cheerio.CheerioAPI): string {
  const root = $(":root").children().first();
  const name =
    (root.prop("tagName") as string | undefined) ||
    (root.get(0) as { tagName?: string } | undefined)?.tagName ||
    "";
  return String(name).toLowerCase();
}

function isSitemapIndexDocument($: cheerio.CheerioAPI): boolean {
  if (getRootTagName($) === "sitemapindex") return true;
  const indexLocs = $("sitemapindex sitemap loc, sitemapindex > sitemap > loc, sitemap > loc");
  const urlsetUrls = $("urlset > url, urlset url");
  return indexLocs.length > 0 && urlsetUrls.length === 0;
}

function resolveSitemapHref(raw: string, baseUrl: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return new URL(text, baseUrl).href;
  } catch {
    return null;
  }
}

function extractChildSitemapUrls($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  $("sitemapindex sitemap loc, sitemapindex > sitemap > loc, sitemap > loc").each((_, element) => {
    const absolute = resolveSitemapHref($(element).text(), baseUrl);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);
    urls.push(absolute);
  });
  return urls;
}

function extractPageLocs($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const foundUrls: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const absolute = resolveSitemapHref(raw, baseUrl);
    if (!absolute || seen.has(absolute)) return;
    seen.add(absolute);
    foundUrls.push(absolute);
  };

  $("urlset > url > loc, url > loc").each((_, element) => {
    add($(element).text());
  });

  if (foundUrls.length === 0) {
    $("loc").each((_, element) => {
      const urlText = $(element).text().trim();
      if (urlText.startsWith("http://") || urlText.startsWith("https://") || urlText.startsWith("/")) {
        add(urlText);
      }
    });
  }

  return foundUrls;
}

async function fetchSitemapXml(
  url: string
): Promise<{ contentText: string; finalUrl: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      let normalizedUrl = url;
      if (normalizedUrl.startsWith("http://")) {
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
        responseType: "text",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
          Accept: "application/xml, text/xml, application/gzip, */*",
          "Accept-Encoding": "gzip, deflate, br",
        },
        decompress: true,
        validateStatus: (status) => status === 200,
        maxRedirects: 5,
      });

      const contentType = response.headers["content-type"] || "";
      const contentText =
        typeof response.data === "string" ? response.data : String(response.data);

      const isXml =
        contentType.includes("xml") ||
        contentType.includes("text/plain") ||
        contentText.trim().startsWith("<") ||
        contentText.trim().startsWith("<?xml");

      if (!isXml) {
        throw new Error(`Invalid sitemap content type: ${contentType}`);
      }

      return { contentText, finalUrl: normalizedUrl };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status && [404, 403].includes(status)) {
        throw lastError;
      }
      if (attempt < MAX_RETRIES - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to fetch/parse sitemap ${url} after ${MAX_RETRIES} attempts: ${lastError?.message ?? "Unknown error"}`
  );
}

/**
 * Parses a sitemap XML file and extracts all page URLs.
 * Follows sitemapindex files recursively (child sitemaps, locale splits, etc.).
 */
export async function parseSitemap(sitemapUrl: string, debug: boolean = false): Promise<string[]> {
  const result = await parseSitemapDetailed(sitemapUrl, debug);
  return result.urls;
}

/**
 * Same as parseSitemap, plus index/child-sitemap metadata for crawlers and UI.
 */
export async function parseSitemapDetailed(
  sitemapUrl: string,
  debug: boolean = false
): Promise<SitemapParseResult> {
  const urls: string[] = [];
  const childSitemaps: string[] = [];
  const visitedSitemaps = new Set<string>();
  let isIndex = false;

  async function fetchSitemap(url: string, depth: number = 0): Promise<string[]> {
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

    const { contentText, finalUrl } = await fetchSitemapXml(url);
    const $ = loadSitemapDocument(contentText);

    const followChildren = async (children: string[]): Promise<string[]> => {
      if (depth === 0 && children.length > 0) {
        isIndex = true;
      }
      for (const child of children) {
        if (!childSitemaps.includes(child)) {
          childSitemaps.push(child);
        }
        if (debug) console.log(`[Sitemap] Adding child sitemap: ${child}`);
      }

      const childResults = await Promise.allSettled(
        children.map((child) => fetchSitemap(child, depth + 1))
      );
      const merged: string[] = [];
      for (const result of childResults) {
        if (result.status === "fulfilled") {
          merged.push(...result.value);
        } else {
          console.warn(`[Sitemap] Failed to fetch child sitemap: ${result.reason}`);
        }
      }
      return merged;
    };

    if (isSitemapIndexDocument($)) {
      const children = extractChildSitemapUrls($, finalUrl);
      if (debug) {
        console.log(`[Sitemap] Found sitemap index with ${children.length} child sitemaps`);
      }
      return followChildren(children);
    }

    const foundUrls = extractPageLocs($, finalUrl);
    const nestedSitemaps = foundUrls.filter(looksLikeSitemapUrl);
    const pageUrls = foundUrls.filter((loc) => !looksLikeSitemapUrl(loc));

    if (nestedSitemaps.length > 0) {
      if (debug) {
        console.log(
          `[Sitemap] ${nestedSitemaps.length} loc URL(s) look like child sitemaps; following them`
        );
      }
      const nestedPages = await followChildren(nestedSitemaps);
      return [...pageUrls, ...nestedPages];
    }

    if (debug) {
      console.log(`[Sitemap] Extracted ${pageUrls.length} URLs from ${finalUrl}`);
      if (pageUrls.length > 0 && pageUrls.length <= 5) {
        console.log(`[Sitemap] Sample URLs:`, pageUrls.slice(0, 3));
      }
    }

    return pageUrls;
  }

  const parsedUrls = await fetchSitemap(sitemapUrl);
  const uniqueUrls = [...new Set(parsedUrls)];
  urls.push(...uniqueUrls);

  return {
    urls,
    isIndex,
    childSitemaps,
  };
}

function extractUrlEntriesFromDocument(
  $: cheerio.CheerioAPI
): SitemapUrlWithAlternates[] {
  const entries: SitemapUrlWithAlternates[] = [];
  const seenLocs = new Set<string>();

  $("urlset > url, urlset url").each((_, urlEl) => {
    const $urlBlock = $(urlEl);
    const loc = $urlBlock.children("loc").first().text().trim();
    if (!loc || seenLocs.has(loc)) return;
    seenLocs.add(loc);

    const alternates: AlternateLink[] = [];
    const seenAlts = new Set<string>();

    $urlBlock.find("link").each((_, linkEl) => {
      const $link = $(linkEl);
      const rel = ($link.attr("rel") || "").toLowerCase();
      if (rel && rel !== "alternate") return;

      const href = $link.attr("href");
      if (!href?.trim()) return;

      const hreflang = ($link.attr("hreflang") || "").trim();
      try {
        const absoluteHref = new URL(href.trim(), loc).href;
        const key = `${hreflang.toLowerCase()}|${absoluteHref}`;
        if (seenAlts.has(key)) return;
        seenAlts.add(key);
        alternates.push({ hreflang, href: absoluteHref });
      } catch {
        // Invalid alternate URL
      }
    });

    entries.push({ loc, alternates });
  });

  return entries;
}

/**
 * Parses sitemap XML and returns URL entries with hreflang alternates (xhtml:link).
 */
export async function parseSitemapWithAlternates(
  sitemapUrl: string,
  debug: boolean = false
): Promise<SitemapUrlWithAlternates[]> {
  const visitedSitemaps = new Set<string>();

  async function fetchSitemapEntries(
    url: string,
    depth: number = 0
  ): Promise<SitemapUrlWithAlternates[]> {
    if (visitedSitemaps.has(url)) return [];
    if (depth > MAX_SITEMAP_DEPTH) return [];
    visitedSitemaps.add(url);

    const { contentText, finalUrl } = await fetchSitemapXml(url);
    const $ = loadSitemapDocument(contentText);

    const followChildren = async (children: string[]): Promise<SitemapUrlWithAlternates[]> => {
      const childResults = await Promise.allSettled(
        children.map((child) => fetchSitemapEntries(child, depth + 1))
      );
      return childResults
        .filter((r): r is PromiseFulfilledResult<SitemapUrlWithAlternates[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);
    };

    if (isSitemapIndexDocument($)) {
      const children = extractChildSitemapUrls($, finalUrl);
      if (debug) {
        console.log(`[Sitemap] Found sitemap index with ${children.length} child sitemaps`);
      }
      return followChildren(children);
    }

    const entries = extractUrlEntriesFromDocument($);
    const nestedFromLocs = extractPageLocs($, finalUrl).filter(looksLikeSitemapUrl);
    if (entries.length === 0 && nestedFromLocs.length > 0) {
      if (debug) {
        console.log(`[Sitemap] Following ${nestedFromLocs.length} nested sitemap loc(s)`);
      }
      return followChildren(nestedFromLocs);
    }

    if (debug) {
      const withAlts = entries.filter((e) => e.alternates.length > 0).length;
      console.log(
        `[Sitemap] Extracted ${entries.length} URL entries (${withAlts} with alternates) from ${finalUrl}`
      );
    }
    return entries;
  }

  return fetchSitemapEntries(sitemapUrl);
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
