"use client";

import { useState, useMemo, useCallback } from "react";
import PageCard from "./PageCard";
import type { PageReport } from "@/lib/page-analyzer";
import { groupPagesByLocale, sortLocaleGroups, detectLocale } from "@/lib/locale-detector";
import {
  hasAlternateIssue,
  type AlternateValidationResult,
} from "@/lib/alternate-validator";

interface PageGridProps {
  pages: PageReport[];
  sitemapUrl?: string | null;
  siteUrl?: string | null;
}

type FilterType =
  | "all"
  | "failed"
  | "missingH1"
  | "missingDescription"
  | "canonicalWarning"
  | "alternateIssue";

function hasCanonicalWarning(page: PageReport): boolean {
  const canonical = page?.meta?.canonical;
  if (!canonical) return true;

  try {
    const canonicalUrl = new URL(canonical);
    const pageUrl = new URL(page.url);

    const normalizeHost = (host: string) => host.replace(/^www\./, "").toLowerCase();
    const normalizePath = (path: string) =>
      (path.endsWith("/") ? path.slice(0, -1) : path) || "/";

    return !(
      normalizeHost(canonicalUrl.hostname) === normalizeHost(pageUrl.hostname) &&
      normalizePath(canonicalUrl.pathname) === normalizePath(pageUrl.pathname)
    );
  } catch {
    return true;
  }
}

export default function PageGrid({ pages, sitemapUrl, siteUrl }: PageGridProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedLocale, setSelectedLocale] = useState<string>("all");
  const [alternateValidations, setAlternateValidations] = useState<
    Map<string, AlternateValidationResult>
  >(new Map());
  const [validatingAlternates, setValidatingAlternates] = useState(false);
  const [alternateValidationError, setAlternateValidationError] = useState<string | null>(null);
  const [alternateValidationSummary, setAlternateValidationSummary] = useState<{
    passed: number;
    warned: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const runAlternateValidation = useCallback(async () => {
    setValidatingAlternates(true);
    setAlternateValidationError(null);
    setAlternateValidationSummary(null);

    try {
      const response = await fetch("/api/analyze/validate-alternates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sitemapUrl: sitemapUrl ?? undefined,
          siteUrl: siteUrl ?? pages[0]?.url,
          pages: pages.map((p) => ({
            url: p.url,
            alternates: p.alternates ?? [],
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Alternate validation failed");
      }

      const map = new Map<string, AlternateValidationResult>(
        Object.entries(data.results as Record<string, AlternateValidationResult>)
      );
      setAlternateValidations(map);
      setAlternateValidationSummary(data.summary);
      setFilter("alternateIssue");
    } catch (err: unknown) {
      setAlternateValidationError(
        err instanceof Error ? err.message : "Alternate validation failed"
      );
    } finally {
      setValidatingAlternates(false);
    }
  }, [pages, sitemapUrl, siteUrl]);

  // Get all available locales
  const availableLocales = useMemo(() => {
    const groups = groupPagesByLocale(pages);
    return sortLocaleGroups(groups);
  }, [pages]);

  // Filter pages by status
  const statusFilteredPages = useMemo(() => {
    switch (filter) {
      case "failed":
        return pages.filter((p) => p.status === "fail");
      case "missingH1":
        return pages.filter((p) => !p.hasSingleH1);
      case "missingDescription":
        return pages.filter((p) => !p.meta.description);
      case "canonicalWarning":
        return pages.filter((p) => hasCanonicalWarning(p));
      case "alternateIssue":
        return pages.filter((p) => hasAlternateIssue(alternateValidations.get(p.url)));
      default:
        return pages;
    }
  }, [pages, filter, alternateValidations]);

  // Filter pages by locale
  const filteredPages = useMemo(() => {
    if (selectedLocale === "all") {
      return statusFilteredPages;
    }
    return statusFilteredPages.filter((page) => {
      const localeInfo = detectLocale(page.url);
      return localeInfo.locale === selectedLocale;
    });
  }, [statusFilteredPages, selectedLocale]);

  const stats = useMemo(() => {
    const passed = pages.filter((p) => p.status === "pass").length;
    const warned = pages.filter((p) => p.status === "warn").length;
    const failed = pages.filter((p) => p.status === "fail").length;
    return { passed, warned, failed, total: pages.length };
  }, [pages]);

  // Group pages by locale (for display when "All Countries" is selected)
  const localeGroups = useMemo(() => {
    const groups = groupPagesByLocale(statusFilteredPages);
    return sortLocaleGroups(groups);
  }, [statusFilteredPages]);

  // Check if we have multiple locales (countries)
  const hasMultipleLocales = useMemo(() => {
    if (availableLocales.length === 0) return false;
    // Show dropdown if we have multiple countries
    return availableLocales.length > 1;
  }, [availableLocales]);

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

        {/* Locale Filter Dropdown - Show when we have any locales detected */}
        {availableLocales.length > 0 && (
          <div className="flex items-center gap-3">
            <label htmlFor="locale-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Country/Region:
            </label>
            <select
              id="locale-filter"
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition min-w-[200px]"
            >
              <option value="all">All Countries ({pages.length})</option>
              {availableLocales.map((group) => (
                <option key={group.locale.locale} value={group.locale.locale}>
                  {group.locale.displayName} ({group.pages.length})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Status Filters */}
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
          <button
            onClick={() => setFilter("canonicalWarning")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "canonicalWarning"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Canonical Warning
          </button>
          <button
            type="button"
            onClick={runAlternateValidation}
            disabled={validatingAlternates || pages.length === 0}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
              filter === "alternateIssue"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {validatingAlternates ? "Validating…" : "Validate Alternate"}
          </button>
          {alternateValidations.size > 0 && (
            <button
              type="button"
              onClick={() => setFilter("alternateIssue")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                filter === "alternateIssue"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              Alternate Issues
            </button>
          )}
        </div>

        {alternateValidationError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {alternateValidationError}
          </p>
        )}
        {alternateValidationSummary && (
          <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
            Alternate validation: {alternateValidationSummary.passed} passed,{" "}
            {alternateValidationSummary.warned} warnings, {alternateValidationSummary.failed}{" "}
            failed, {alternateValidationSummary.skipped} not in sitemap
          </p>
        )}

        {/* Results count */}
        <div className="text-sm text-gray-600 font-medium">
          Displaying {filteredPages.length} of {pages.length} total pages
          {selectedLocale !== "all" && (
            <span className="ml-2 text-gray-500">
              (Country: {availableLocales.find(g => g.locale.locale === selectedLocale)?.locale.displayName || selectedLocale})
            </span>
          )}
          {filter !== "all" && (
            <span className="ml-2 text-gray-500">
              (Status:{" "}
              {filter === "alternateIssue" ? "Alternate issues" : filter})
            </span>
          )}
        </div>
      </div>

      {/* Grid - Show filtered pages */}
      {filteredPages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-md border border-gray-200">
          <p className="text-gray-500">
            {pages.length === 0 
              ? "No pages were found. Please check if the website is accessible and contains internal links."
              : "No pages match the current filter. Try selecting 'All Countries' or 'All Pages' to see all crawled pages."}
          </p>
        </div>
      ) : selectedLocale === "all" && hasMultipleLocales ? (
        // Show grouped by locale when "All Countries" is selected
        <div className="space-y-8">
          {localeGroups.map((group) => (
            <div key={group.locale.locale} className="space-y-4">
              {/* Locale Header */}
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {group.locale.displayName}
                  </h3>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                    {group.pages.length} {group.pages.length === 1 ? "page" : "pages"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className={`px-2 py-1 rounded ${
                    group.pages.filter(p => p.status === "pass").length > 0
                      ? "bg-green-100 text-green-700"
                      : ""
                  }`}>
                    {group.pages.filter(p => p.status === "pass").length} passed
                  </span>
                  <span className={`px-2 py-1 rounded ${
                    group.pages.filter(p => p.status === "warn").length > 0
                      ? "bg-yellow-100 text-yellow-700"
                      : ""
                  }`}>
                    {group.pages.filter(p => p.status === "warn").length} warnings
                  </span>
                  <span className={`px-2 py-1 rounded ${
                    group.pages.filter(p => p.status === "fail").length > 0
                      ? "bg-red-100 text-red-700"
                      : ""
                  }`}>
                    {group.pages.filter(p => p.status === "fail").length} failed
                  </span>
                </div>
              </div>
              
              {/* Pages Grid for this locale */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {group.pages.map((page, index) => (
                  <PageCard
                    key={`${page.url}-${index}`}
                    page={page}
                    alternateValidation={alternateValidations.get(page.url)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Show filtered pages in a single grid (when a specific locale is selected or no multiple locales)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPages.map((page, index) => (
            <PageCard
              key={`${page.url}-${index}`}
              page={page}
              alternateValidation={alternateValidations.get(page.url)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
