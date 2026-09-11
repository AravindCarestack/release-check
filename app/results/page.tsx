"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { SEOAnalysisResult } from "@/app/types";
import type { PageReport } from "@/lib/page-analyzer";
import ResultsDisplay from "@/components/ResultsDisplay";
import PageGrid from "@/components/PageGrid";
import Terminal from "@/components/Terminal";
import { groupPagesByLocale, sortLocaleGroups, detectLocale } from "@/lib/locale-detector";
import { exportCrawlResultsToCSV, exportCrawlResultsToPDF, downloadCSV } from "@/lib/export-utils";

interface CrawlResult {
  totalPages: number;
  sitemap?: {
    present: boolean;
    url: string | null;
  };
  crawlStatistics?: {
    sitemapUrl?: string | null;
    sitemapUrlCount?: number;
    sitemapIsIndex?: boolean;
    childSitemaps?: string[];
  };
  robotsTxt?: {
    present: boolean;
    content: string | null;
    disallowQueryParams?: boolean;
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
  const [terminalLogs, setTerminalLogs] = useState<Array<{ timestamp: string; level: "info" | "success" | "warning" | "error"; message: string }>>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfExportLocale, setPdfExportLocale] = useState<string>("all");

  // Detect locales from crawled pages
  const localeInfo = useMemo(() => {
    if (!crawlResult?.pages) return null;
    const groups = groupPagesByLocale(crawlResult.pages);
    const sorted = sortLocaleGroups(groups);
    return {
      groups: sorted,
      count: groups.size,
      hasMultiple: groups.size > 1,
    };
  }, [crawlResult?.pages]);

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
        setTerminalLogs([]);
        
        if (crawl) {
          // Use streaming API for crawl mode
          setIsStreaming(true);
          const streamUrl = `/api/analyze/stream?url=${encodeURIComponent(url)}&crawl=true`;
          const eventSource = new EventSource(streamUrl);

          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.type === "complete") {
                eventSource.close();
                setIsStreaming(false);
                // Fetch final results
                fetchFinalResults(url);
                return;
              }

              // Add log entry
              if (data.timestamp && data.level && data.message) {
                setTerminalLogs(prev => [...prev, data]);
              }
            } catch (e) {
              // Ignore parse errors
            }
          };

          eventSource.onerror = () => {
            eventSource.close();
            setIsStreaming(false);
            // Try to fetch results anyway
            fetchFinalResults(url);
          };
        } else {
          // Regular API for single page
          const apiUrl = `/api/analyze?url=${encodeURIComponent(url)}`;
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to analyze website");
          }

          const data = await response.json();
          setSingleResult(data as SEOAnalysisResult);
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while analyzing the website");
        setLoading(false);
        setIsStreaming(false);
      }
    };

    const fetchFinalResults = async (url: string) => {
      try {
        const apiUrl = `/api/analyze?url=${encodeURIComponent(url)}&crawl=true`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch results");
        }

        const data = await response.json();
        setCrawlResult(data as CrawlResult);
      } catch (err: any) {
        setError(err.message || "Failed to fetch final results");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [searchParams]);

  // Pages to export based on selected locale
  const pagesForPdfExport = useMemo(() => {
    if (!crawlResult?.pages) return [];
    if (pdfExportLocale === "all") return crawlResult.pages;
    return crawlResult.pages.filter((page) => detectLocale(page.url).locale === pdfExportLocale);
  }, [crawlResult?.pages, pdfExportLocale]);

  const handleExportPDF = async () => {
    if (!pagesForPdfExport.length) return;
    setExportingPDF(true);
    try {
      const localeLabel =
        pdfExportLocale === "all"
          ? "All Countries"
          : localeInfo?.groups.find((g) => g.locale.locale === pdfExportLocale)?.locale.displayName ?? "Selected Region";
      await exportCrawlResultsToPDF({
        pages: pagesForPdfExport,
        locale: pdfExportLocale,
        localeLabel,
        totalPagesInCrawl: crawlResult?.totalPages ?? pagesForPdfExport.length,
      });
      setShowPDFModal(false);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
    if (!crawlResult?.pages) return;
    setExportingCSV(true);
    try {
      const csv = exportCrawlResultsToCSV(crawlResult.pages);
      const filename = `seo-crawl-report-${Date.now()}.csv`;
      downloadCSV(csv, filename);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setExportingCSV(false);
    }
  };

  if (loading) {
    const crawl = searchParams.get("crawl") === "true";
    
    if (crawl) {
      // Show terminal for crawl mode
      return (
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="container mx-auto px-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6">
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
                  Crawling Website
                </h1>
                <p className="text-sm text-gray-600">
                  Real-time crawling progress
                </p>
              </div>
              <Terminal logs={terminalLogs} isStreaming={isStreaming} />
            </div>
          </div>
        </div>
      );
    }
    
    // Regular loading for single page
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
            Analyzing website...
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
              <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
                <h1 className="text-2xl font-semibold text-gray-900">
                  SEO Analysis Results
                </h1>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPDFModal(true)}
                    disabled={exportingPDF}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Export PDF
                  </button>
                  <button
                    onClick={handleExportCSV}
                    disabled={exportingCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingCSV ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Analyzed {crawlResult.totalPages} page{crawlResult.totalPages !== 1 ? "s" : ""} from the website
                </p>
                {localeInfo && localeInfo.hasMultiple && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">
                      Regions detected:
                    </span>
                    {localeInfo.groups.map((group) => (
                      <span
                        key={group.locale.locale}
                        className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-medium border border-blue-200"
                      >
                        {group.locale.displayName} ({group.pages.length})
                      </span>
                    ))}
                  </div>
                )}
                {crawlResult.sitemap && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${crawlResult.sitemap.present ? "text-green-600" : "text-red-600"}`}>
                        {crawlResult.sitemap.present ? "✓" : "✗"}{" "}
                        {crawlResult.crawlStatistics?.sitemapIsIndex
                          ? `Sitemap index: Found (${crawlResult.crawlStatistics.childSitemaps?.length ?? 0} child sitemaps, ${crawlResult.crawlStatistics.sitemapUrlCount ?? 0} URLs)`
                          : `Sitemap: ${crawlResult.sitemap.present ? "Found" : "Not Found"}`}
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
                    {crawlResult.crawlStatistics?.sitemapIsIndex &&
                      (crawlResult.crawlStatistics.childSitemaps?.length ?? 0) > 0 && (
                        <ul className="pl-4 space-y-0.5">
                          {crawlResult.crawlStatistics.childSitemaps!.map((child) => (
                            <li key={child}>
                              <a
                                href={child}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {child}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                )}
              </div>
            </div>

            {/* Export PDF Modal */}
            {showPDFModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Export PDF Report</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Choose which region to include in the report. The PDF will use a professional layout with clear sections and alignment.
                  </p>
                  <div className="mb-4">
                    <label htmlFor="pdf-region" className="block text-sm font-medium text-gray-700 mb-2">
                      Region / Country
                    </label>
                    <select
                      id="pdf-region"
                      value={pdfExportLocale}
                      onChange={(e) => setPdfExportLocale(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="all">
                        All Countries ({crawlResult?.pages?.length ?? 0} pages)
                      </option>
                      {localeInfo?.groups.map((group) => (
                        <option key={group.locale.locale} value={group.locale.locale}>
                          {group.locale.displayName} ({group.pages.length} pages)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowPDFModal(false)}
                      disabled={exportingPDF}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      disabled={exportingPDF || pagesForPdfExport.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exportingPDF ? (
                        <>
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Exporting...
                        </>
                      ) : (
                        "Export PDF"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Robots.txt Display */}
            {crawlResult.robotsTxt && (
              <div className="mb-6 bg-white rounded-md border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Robots.txt
                  </h2>
                  <span className={`text-sm font-medium px-3 py-1 rounded-md ${
                    crawlResult.robotsTxt.present 
                      ? "bg-green-100 text-green-700" 
                      : "bg-red-100 text-red-700"
                  }`}>
                    {crawlResult.robotsTxt.present ? "✓ Present" : "✗ Not Found"}
                  </span>
                </div>
                {crawlResult.robotsTxt.present && (
                  <div className="mb-3 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Disallow: /*?*
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Blocks URLs with query strings (e.g. /products?sort=price)
                      </p>
                    </div>
                    <span className={`text-sm font-medium px-3 py-1 rounded-md ${
                      crawlResult.robotsTxt.disallowQueryParams
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {crawlResult.robotsTxt.disallowQueryParams ? "✓ Present" : "⚠ Missing"}
                    </span>
                  </div>
                )}
                {crawlResult.robotsTxt.present && crawlResult.robotsTxt.content && (
                  <div className="mt-3">
                    <pre className="bg-gray-50 border border-gray-200 rounded-md p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words font-mono">
                      {crawlResult.robotsTxt.content}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Page Grid */}
            <PageGrid
              pages={crawlResult.pages}
              sitemapUrl={
                crawlResult.crawlStatistics?.sitemapUrl ??
                crawlResult.sitemap?.url
              }
              siteUrl={searchParams.get("url") ?? undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  // Single page results
  if (singleResult) {
    const url = searchParams.get("url") || "unknown";
    return <ResultsDisplay result={singleResult} url={url} />;
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
