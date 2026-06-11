import { NextRequest, NextResponse } from "next/server";
import {
  generateCrawlInsightsFromSummary,
  generatePageInsightsFromSummary,
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
    const { mode, summary } = body as {
      mode?: "crawl" | "page";
      summary?: string;
    };

    if (!summary?.trim()) {
      return NextResponse.json(
        { error: "No audit summary provided" },
        { status: 400 }
      );
    }

    if (mode === "page") {
      const insights = await generatePageInsightsFromSummary(summary);
      return NextResponse.json({ insights });
    }

    const insights = await generateCrawlInsightsFromSummary(summary);
    return NextResponse.json({ insights });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI insights failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
