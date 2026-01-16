"use client";

import { useState, useMemo } from "react";
import PageCard from "./PageCard";
import type { PageReport } from "@/lib/page-analyzer";

interface PageGridProps {
  pages: PageReport[];
}

type FilterType = "all" | "failed" | "missingH1" | "missingDescription";

export default function PageGrid({ pages }: PageGridProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredPages = useMemo(() => {
    switch (filter) {
      case "failed":
        return pages.filter((p) => p.status === "fail");
      case "missingH1":
        return pages.filter((p) => !p.hasSingleH1);
      case "missingDescription":
        return pages.filter((p) => !p.meta.description);
      default:
        return pages;
    }
  }, [pages, filter]);

  const stats = useMemo(() => {
    const passed = pages.filter((p) => p.status === "pass").length;
    const warned = pages.filter((p) => p.status === "warn").length;
    const failed = pages.filter((p) => p.status === "fail").length;
    return { passed, warned, failed, total: pages.length };
  }, [pages]);

  return (
    <div>
      {/* Stats and Filters */}
      <div className="mb-6 space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-md">
            <span className="text-sm font-medium text-gray-700">
              {stats.passed} Passed
            </span>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-md">
            <span className="text-sm font-medium text-gray-700">
              {stats.warned} Warnings
            </span>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-md">
            <span className="text-sm font-medium text-gray-700">
              {stats.failed} Failed
            </span>
          </div>
          <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-md">
            <span className="text-sm font-medium text-gray-700">
              {stats.total} Total Pages
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            Filter:
          </span>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            All Pages
          </button>
          <button
            onClick={() => setFilter("failed")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "failed"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Failed Only
          </button>
          <button
            onClick={() => setFilter("missingH1")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "missingH1"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Missing H1
          </button>
          <button
            onClick={() => setFilter("missingDescription")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "missingDescription"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Missing Description
          </button>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-600 font-medium">
          Displaying {filteredPages.length} of {pages.length} total pages
          {filter !== "all" && (
            <span className="ml-2 text-gray-500">
              (Filtered: {filter})
            </span>
          )}
        </div>
      </div>

      {/* Grid - Always show all pages when filter is "all" */}
      {filteredPages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-md border border-gray-200">
          <p className="text-gray-500">
            {pages.length === 0 
              ? "No pages were found. Please check if the website is accessible and contains internal links."
              : "No pages match the current filter. Try selecting 'All Pages' to see all crawled pages."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPages.map((page, index) => (
            <PageCard key={`${page.url}-${index}`} page={page} />
          ))}
        </div>
      )}
    </div>
  );
}
