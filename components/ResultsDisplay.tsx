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
    if (score >= 80) return "bg-green-100 dark:bg-green-900";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900";
    return "bg-red-100 dark:bg-red-900";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/")}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2"
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
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              SEO Analysis Results
            </h1>
          </div>

          {/* Score Card */}
          <div
            className={`${getScoreBgColor(
              result.score
            )} rounded-2xl shadow-xl p-8 mb-8`}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Overall SEO Score
                </h2>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-6xl font-bold ${getScoreColor(result.score)}`}
                  >
                    {result.score}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300 text-xl">/ 100</span>
                </div>
              </div>
              <div className="flex gap-4 flex-wrap">
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Summary
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.passed.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Checks Passed
                </div>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {result.warnings.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Warnings
                </div>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.failed.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
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
