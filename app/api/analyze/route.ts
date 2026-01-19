import { NextRequest, NextResponse } from "next/server";
import { analyzeWebsite } from "@/lib/seo-analyzer";
import { crawlWebsite } from "@/lib/crawler-sitemap-first";
import { analyzePage } from "@/lib/page-analyzer";
import type { PageReport } from "@/lib/page-analyzer";

// Increase timeout for browser-based crawling (can take longer)
export const maxDuration = 300; // 5 minutes (Vercel limit)
export const dynamic = 'force-dynamic';

const MAX_CONCURRENT_ANALYSIS = 5;

/**
 * Analyzes multiple pages concurrently with rate limiting
 */
async function analyzePagesConcurrently(
  pages: Array<{ url: string; html: string }>,
  baseUrl: URL,
  maxConcurrent: number = MAX_CONCURRENT_ANALYSIS
): Promise<PageReport[]> {
  const results: PageReport[] = [];
  
  // Process pages in batches
  for (let i = 0; i < pages.length; i += maxConcurrent) {
    const batch = pages.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        try {
          return await analyzePage(page.html, page.url, baseUrl);
        } catch (error) {
          // Return a failed report if analysis fails
          return {
            url: page.url,
            h1Count: 0,
            h1Texts: [],
            hasSingleH1: false,
            headingCounts: { h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
            meta: { title: null, description: null, keywords: null, robots: null, canonical: null },
            og: { title: null, description: null, image: null },
            twitter: { card: null, title: null, description: null, image: null },
            jsonLd: { present: false, valid: false, count: 0, errors: [], types: [], data: [] },
            sitemap: { present: false, url: null },
            issues: ["Failed to analyze page"],
            status: "fail" as const,
          };
        }
      })
    );
    results.push(...batchResults);
  }
  
  return results;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const crawl = searchParams.get("crawl") === "true";
  // Allow user to override maxPages via query parameter
  const maxPagesParam = searchParams.get("maxPages");
  const maxPages = maxPagesParam ? parseInt(maxPagesParam, 10) : 200;

  if (!url) {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    );
  }

  // Validate maxPages parameter
  if (maxPagesParam && (isNaN(maxPages) || maxPages < 1 || maxPages > 1000)) {
    return NextResponse.json(
      { error: "maxPages must be a number between 1 and 1000" },
      { status: 400 }
    );
  }

  try {
    // Always crawl all pages by default
    if (crawl) {
      // Normalize URL for base URL
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = `https://${normalizedUrl}`;
      }
      const baseUrl = new URL(normalizedUrl);

      // Check for sitemap at site level and fetch robots.txt
      let sitemapUrl: string | null = null;
      let sitemapPresent = false;
      let robotsTxtContent: string | null = null;
      let robotsTxtPresent = false;
      try {
        const robotsUrl = new URL("/robots.txt", baseUrl).href;
        const axios = (await import("axios")).default;
        const robotsResponse = await axios.get(robotsUrl, { timeout: 5000, validateStatus: () => true });
        if (robotsResponse.status === 200) {
          robotsTxtPresent = true;
          robotsTxtContent = typeof robotsResponse.data === "string" 
            ? robotsResponse.data 
            : String(robotsResponse.data);
          const sitemapMatch = robotsTxtContent.match(/Sitemap:\s*(.+)/i);
          if (sitemapMatch) {
            sitemapPresent = true;
            sitemapUrl = sitemapMatch[1].trim();
          }
        }
      } catch {
        // Ignore sitemap check errors
      }

      // Also check common sitemap locations
      if (!sitemapPresent) {
        const commonSitemaps = ["/sitemap.xml", "/sitemap_index.xml"];
        for (const sitemapPath of commonSitemaps) {
          try {
            const sitemapCheckUrl = new URL(sitemapPath, baseUrl).href;
            const axios = (await import("axios")).default;
            const response = await axios.head(sitemapCheckUrl, { timeout: 5000, validateStatus: () => true });
            if (response.status === 200) {
              sitemapPresent = true;
              sitemapUrl = sitemapCheckUrl;
              break;
            }
          } catch {
            // Continue checking
          }
        }
      }

      // Crawl the website using sitemap-first approach
      // WHY: Uses sitemap URLs directly via HTTP - most reliable for production sites
      const crawlResult = await crawlWebsite(normalizedUrl, {
        maxPages: maxPages, // Configurable via query parameter, default 200
        timeout: 15000, // 15 seconds per page
        debug: true, // Enable debug logging to diagnose issues
      });

      const crawledPages = crawlResult.pages;
      const crawlStatistics = crawlResult.statistics;

      console.log(`[API] Crawled ${crawledPages.length} pages from ${normalizedUrl}`);
      console.log(`[API] Crawl statistics:`, {
        sitemapFound: crawlStatistics.sitemapFound,
        sitemapUrlCount: crawlStatistics.sitemapUrlCount,
        htmlDiscoveredCount: crawlStatistics.htmlDiscoveredCount,
        totalDiscovered: crawlStatistics.totalDiscovered,
        errors: crawlStatistics.crawlErrors.length,
      });

      // Analyze all crawled pages
      const pagesToAnalyze = crawledPages.map((page) => ({
        url: page.url,
        html: page.html,
      }));

      const pageReports = await analyzePagesConcurrently(pagesToAnalyze, baseUrl);
      
      console.log(`[API] Analyzed ${pageReports.length} pages`);

      // Add sitemap info to all pages (site-level check)
      const pagesWithSitemap = pageReports.map(page => ({
        ...page,
        sitemap: {
          present: sitemapPresent,
          url: sitemapUrl,
        },
      }));

      return NextResponse.json({
        totalPages: pagesWithSitemap.length,
        sitemap: {
          present: sitemapPresent,
          url: sitemapUrl,
        },
        robotsTxt: {
          present: robotsTxtPresent,
          content: robotsTxtContent,
        },
        crawlStatistics: {
          sitemapFound: crawlStatistics.sitemapFound,
          sitemapUrl: crawlStatistics.sitemapUrl,
          sitemapUrlCount: crawlStatistics.sitemapUrlCount,
          htmlDiscoveredCount: crawlStatistics.htmlDiscoveredCount,
          totalDiscovered: crawlStatistics.totalDiscovered,
          totalCrawled: crawlStatistics.totalCrawled,
          crawlErrors: crawlStatistics.crawlErrors,
        },
        pages: pagesWithSitemap,
      });
    }

    // Single page analysis mode (backward compatibility)
    const result = await analyzeWebsite(url);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to analyze website" },
      { status: 500 }
    );
  }
}
