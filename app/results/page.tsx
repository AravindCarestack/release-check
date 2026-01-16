"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SEOAnalysisResult } from "@/app/types";
import type { PageReport } from "@/lib/page-analyzer";
import ResultsDisplay from "@/components/ResultsDisplay";
import PageGrid from "@/components/PageGrid";

interface CrawlResult {
  totalPages: number;
  sitemap?: {
    present: boolean;
    url: string | null;
  };
  pages: PageReport[];
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [singleResult, setSingleResult] = useState<SEOAnalysisResult | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = searchParams.get("url");
    const crawl = searchParams.get("crawl") === "true";

    if (!url) {
      setError("No URL provided");
      setLoading(false);
      return;
    }

    const fetchAnalysis = async () => {
      try {
        setLoading(true);
        const apiUrl = `/api/analyze?url=${encodeURIComponent(url)}${crawl ? `&crawl=true` : ""}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to analyze website");
        }

        const data = await response.json();
        
        if (crawl) {
          setCrawlResult(data as CrawlResult);
        } else {
          setSingleResult(data as SEOAnalysisResult);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while analyzing the website");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-base text-gray-700 font-medium">
            {searchParams.get("crawl") === "true" ? "Crawling and analyzing website..." : "Analyzing website..."}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This may take a minute
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white border border-gray-200 rounded-md shadow-sm p-8 text-center">
          <div className="text-red-600 text-3xl mb-4 font-bold">⚠</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            Analysis Failed
          </h2>
          <p className="text-gray-600 mb-6 text-sm">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Multi-page crawl results
  if (crawlResult) {
    return (
      <div className="min-h-screen bg-white py-8">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => router.push("/")}
                className="text-blue-600 hover:text-blue-700 mb-4 flex items-center text-sm font-medium"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Home
              </button>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                SEO Analysis Results
              </h1>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  Analyzed {crawlResult.totalPages} page{crawlResult.totalPages !== 1 ? "s" : ""} from the website
                </p>
                {crawlResult.sitemap && (
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${crawlResult.sitemap.present ? "text-green-600" : "text-red-600"}`}>
                      {crawlResult.sitemap.present ? "✓" : "✗"} Sitemap: {crawlResult.sitemap.present ? "Found" : "Not Found"}
                    </span>
                    {crawlResult.sitemap.url && (
                      <a
                        href={crawlResult.sitemap.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {crawlResult.sitemap.url}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Page Grid */}
            <PageGrid pages={crawlResult.pages} />
          </div>
        </div>
      </div>
    );
  }

  // Single page results
  if (singleResult) {
    return <ResultsDisplay result={singleResult} />;
  }

  return null;
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <svg
              className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-base text-gray-700 font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
