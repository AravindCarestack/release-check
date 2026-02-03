"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SEOAnalysisResult } from "@/app/types";
import CheckSection from "./CheckSection";
import ScoreBadge from "./ScoreBadge";
import { exportSinglePageToCSV, exportSinglePageToPDF, downloadCSV } from "@/lib/export-utils";

interface ResultsDisplayProps {
  result: SEOAnalysisResult;
  url?: string;
}

export default function ResultsDisplay({ result, url: propUrl }: ResultsDisplayProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["metaTags", "robots", "links", "technical"])
  );
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  
  // Get URL from prop or search params
  const url = propUrl || searchParams.get("url") || "unknown";

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-50 border-green-200";
    if (score >= 60) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportSinglePageToPDF(result, url);
    } catch (error) {
      console.error("Failed to export PDF:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportCSV = () => {
    setExportingCSV(true);
    try {
      const csv = exportSinglePageToCSV(result, url);
      const filename = `seo-analysis-${url.replace(/[^a-z0-9]/gi, "-").substring(0, 50)}-${Date.now()}.csv`;
      downloadCSV(csv, filename);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setExportingCSV(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-8">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
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
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <h1 className="text-2xl font-semibold text-gray-900">
                SEO Analysis Results
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
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
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Export PDF
                    </>
                  )}
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
          </div>

          {/* Score Card */}
          <div
            className={`${getScoreBgColor(
              result.score
            )} border rounded-md shadow-sm p-6 mb-6`}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Overall SEO Score
                </h2>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-5xl font-bold ${getScoreColor(result.score)}`}
                  >
                    {result.score}
                  </span>
                  <span className="text-gray-600 text-lg">/ 100</span>
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <ScoreBadge
                  count={result.passed.length}
                  label="Passed"
                  color="green"
                />
                <ScoreBadge
                  count={result.warnings.length}
                  label="Warnings"
                  color="yellow"
                />
                <ScoreBadge
                  count={result.failed.length}
                  label="Failed"
                  color="red"
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Summary
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="text-2xl font-bold text-green-700">
                  {result.passed.length}
                </div>
                <div className="text-sm text-gray-600">
                  Checks Passed
                </div>
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-2xl font-bold text-yellow-700">
                  {result.warnings.length}
                </div>
                <div className="text-sm text-gray-600">
                  Warnings
                </div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-2xl font-bold text-red-700">
                  {result.failed.length}
                </div>
                <div className="text-sm text-gray-600">
                  Failed Checks
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="space-y-4">
            <CheckSection
              title="Meta Tags"
              section="metaTags"
              checks={result.details.metaTags}
              expanded={expandedSections.has("metaTags")}
              onToggle={toggleSection}
            />

            <CheckSection
              title="Open Graph"
              section="openGraph"
              checks={result.details.openGraph}
              expanded={expandedSections.has("openGraph")}
              onToggle={toggleSection}
            />

            <CheckSection
              title="Twitter Cards"
              section="twitter"
              checks={result.details.twitter}
              expanded={expandedSections.has("twitter")}
              onToggle={toggleSection}
            />

            <CheckSection
              title="Robots & Indexing"
              section="robots"
              checks={result.details.robots}
              expanded={expandedSections.has("robots")}
              onToggle={toggleSection}
            />

            <CheckSection
              title="Links"
              section="links"
              checks={result.details.links}
              expanded={expandedSections.has("links")}
              onToggle={toggleSection}
            />

            <CheckSection
              title="Technical SEO"
              section="technical"
              checks={result.details.technical}
              expanded={expandedSections.has("technical")}
              onToggle={toggleSection}
            />

            {result.details.performance && (
              <CheckSection
                title="Performance"
                section="performance"
                checks={result.details.performance}
                expanded={expandedSections.has("performance")}
                onToggle={toggleSection}
              />
            )}

            {result.details.security && (
              <CheckSection
                title="Security"
                section="security"
                checks={result.details.security}
                expanded={expandedSections.has("security")}
                onToggle={toggleSection}
              />
            )}

            {result.details.accessibility && (
              <CheckSection
                title="Accessibility"
                section="accessibility"
                checks={result.details.accessibility}
                expanded={expandedSections.has("accessibility")}
                onToggle={toggleSection}
              />
            )}

            {result.details.analytics && (
              <CheckSection
                title="Analytics & Tracking"
                section="analytics"
                checks={result.details.analytics}
                expanded={expandedSections.has("analytics")}
                onToggle={toggleSection}
              />
            )}

            {result.details.caching && (
              <CheckSection
                title="Caching & CDN"
                section="caching"
                checks={result.details.caching}
                expanded={expandedSections.has("caching")}
                onToggle={toggleSection}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
