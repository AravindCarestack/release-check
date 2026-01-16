"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SEOAnalysisResult } from "@/app/types";
import CheckSection from "./CheckSection";
import ScoreBadge from "./ScoreBadge";

interface ResultsDisplayProps {
  result: SEOAnalysisResult;
}

export default function ResultsDisplay({ result }: ResultsDisplayProps) {
  const router = useRouter();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["metaTags", "openGraph", "twitter", "robots", "links", "technical"])
  );

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
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">
              SEO Analysis Results
            </h1>
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
          </div>
        </div>
      </div>
    </div>
  );
}
