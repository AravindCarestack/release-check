import { NextRequest, NextResponse } from "next/server";
import type { PageReport } from "@/lib/page-analyzer";
import {
  generateCrawlInsights,
  generatePageInsights,
  isAiInsightsConfigured,
} from "@/lib/ai-insights";

export async function POST(request: NextRequest) {
  if (!isAiInsightsConfigured()) {
    return NextResponse.json(
      { error: "AI insights unavailable. Please contact support." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { mode, pages, page } = body as {
      mode?: "crawl" | "page";
      pages?: PageReport[];
      page?: PageReport;
    };

    if (mode === "page" && page?.url) {
      const insights = await generatePageInsights(page as PageReport);
      return NextResponse.json({ insights });
    }

    if (!pages?.length) {
      return NextResponse.json(
        { error: "No pages provided for crawl insights" },
        { status: 400 }
      );
    }

    const insights = await generateCrawlInsights(pages as PageReport[]);
    return NextResponse.json({ insights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI insights failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
