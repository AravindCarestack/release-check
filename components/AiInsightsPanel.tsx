"use client";

import { useState } from "react";
import type { PageReport } from "@/lib/page-analyzer";
import type { AiInsightsResult } from "@/lib/ai-insights";
import SeoInsightDisplay from "./SeoInsightDisplay";

interface AiInsightsPanelProps {
  pages: PageReport[];
}

export default function AiInsightsPanel({ pages }: AiInsightsPanelProps) {
  const [insights, setInsights] = useState<AiInsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "crawl", pages }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate SEO analysis");
      }
      setInsights(data.insights);
      setExpanded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate SEO analysis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600 text-lg" aria-hidden>
            ✦
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">SEO performance analysis</h2>
            <p className="text-xs text-gray-600">
              Consultant-style report: critical issues, growth opportunities, and prioritized action plan
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading || pages.length === 0}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing SEO…" : insights ? "Refresh analysis" : "Analyze SEO performance"}
        </button>
      </div>

      {error && <p className="px-4 pb-3 text-sm text-red-700">{error}</p>}

      {insights && (
        <div className="border-t border-indigo-200 bg-white/80">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-4 py-2 text-left text-xs text-gray-500 hover:bg-white/50 flex items-center justify-between"
          >
            <span>{expanded ? "Hide analysis" : "Show analysis"}</span>
            <span>{expanded ? "▼" : "▶"}</span>
          </button>
          {expanded && (
            <div className="px-4 pb-4">
              <SeoInsightDisplay insights={insights} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
