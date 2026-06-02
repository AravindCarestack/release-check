import { NextRequest, NextResponse } from "next/server";
import { discoverSitemap, parseSitemapWithAlternates } from "@/lib/sitemap-parser";
import {
  validateAllAlternates,
  type AlternateLink,
  type AlternateValidationResult,
} from "@/lib/alternate-validator";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

interface ValidateAlternatesBody {
  sitemapUrl?: string | null;
  siteUrl?: string | null;
  pages: Array<{ url: string; alternates: AlternateLink[] }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ValidateAlternatesBody;
    const { pages } = body;

    if (!pages?.length) {
      return NextResponse.json(
        { error: "pages array is required" },
        { status: 400 }
      );
    }

    let sitemapUrl = body.sitemapUrl?.trim() || null;

    if (!sitemapUrl && body.siteUrl) {
      let normalized = body.siteUrl.trim();
      if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
        normalized = `https://${normalized}`;
      }
      const baseUrl = new URL(normalized);
      sitemapUrl = await discoverSitemap(baseUrl, false);
    }

    if (!sitemapUrl) {
      return NextResponse.json(
        {
          error: "No sitemap URL available. Ensure the site has a sitemap or pass sitemapUrl.",
        },
        { status: 400 }
      );
    }

    const sitemapEntries = await parseSitemapWithAlternates(sitemapUrl, false);
    const validationMap = validateAllAlternates({ pages, sitemapEntries });

    const results: Record<string, AlternateValidationResult> = {};
    let passed = 0;
    let warned = 0;
    let failed = 0;
    let skipped = 0;

    for (const [url, result] of validationMap) {
      results[url] = result;
      switch (result.status) {
        case "pass":
          passed++;
          break;
        case "warn":
          warned++;
          break;
        case "fail":
          failed++;
          break;
        case "skip":
          skipped++;
          break;
      }
    }

    const entriesWithAlternates = sitemapEntries.filter((e) => e.alternates.length > 0).length;

    return NextResponse.json({
      sitemapUrl,
      sitemapEntryCount: sitemapEntries.length,
      sitemapEntriesWithAlternates: entriesWithAlternates,
      summary: { passed, warned, failed, skipped, total: pages.length },
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
