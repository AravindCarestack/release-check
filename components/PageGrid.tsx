"use client";

import { useState, useMemo, useCallback } from "react";
import PageCard from "./PageCard";
import AiInsightsPanel from "./AiInsightsPanel";
import SeoChatbot from "./SeoChatbot";
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
  | "alternateIssue"
  | "missingOgImage"
  | "imageAltIssue";

type StatusSortKey = "pass" | "warn" | "fail";

function isNotFound(page: PageReport): boolean {
  return page.statusCode === 404;
}

function focusPages(
  pages: PageReport[],
  statusFocus: StatusSortKey | null,
  notFoundOnly: boolean
): PageReport[] {
  let next = pages;
  if (statusFocus) next = next.filter((page) => page.status === statusFocus);
  if (notFoundOnly) next = next.filter(isNotFound);
  return next;
}

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
  const [statusFocus, setStatusFocus] = useState<StatusSortKey | null>(null);
  const [notFoundOnly, setNotFoundOnly] = useState(false);

  const toggleStatusFocus = (key: StatusSortKey) => {
    setStatusFocus((current) => (current === key ? null : key));
  };

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
      case "missingOgImage":
        return pages.filter((p) => !p.og.image);
      case "imageAltIssue":
        return pages.filter((p) => (p.images?.missingAlt ?? 0) + (p.images?.emptyAlt ?? 0) > 0);
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

  const viewedPages = useMemo(
    () => focusPages(filteredPages, statusFocus, notFoundOnly),
    [filteredPages, statusFocus, notFoundOnly]
  );

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

  return (
    <div>
      <SeoChatbot pages={pages} />
      <AiInsightsPanel pages={pages} />

      {/* Stats and Filters */}
      <div className="mb-6 space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            aria-pressed={statusFocus === "pass"}
            onClick={() => toggleStatusFocus("pass")}
            className={`border px-4 py-2.5 rounded-md text-sm font-medium transition ${
              statusFocus === "pass"
                ? "bg-green-600 border-green-600 text-white"
                : "bg-gray-900 border-gray-700 text-gray-300 hover:border-green-600"
            }`}
          >
            {stats.passed} Passed
          </button>
          <button
            type="button"
            aria-pressed={statusFocus === "warn"}
            onClick={() => toggleStatusFocus("warn")}
            className={`border px-4 py-2.5 rounded-md text-sm font-medium transition ${
              statusFocus === "warn"
                ? "bg-yellow-500 border-yellow-500 text-white"
                : "bg-gray-900 border-gray-700 text-gray-300 hover:border-yellow-600"
            }`}
          >
            {stats.warned} Warnings
          </button>
          <button
            type="button"
            aria-pressed={statusFocus === "fail"}
            onClick={() => toggleStatusFocus("fail")}
            className={`border px-4 py-2.5 rounded-md text-sm font-medium transition ${
              statusFocus === "fail"
                ? "bg-red-600 border-red-600 text-white"
                : "bg-gray-900 border-gray-700 text-gray-300 hover:border-red-600"
            }`}
          >
            {stats.failed} Failed
          </button>
          <button
            type="button"
            aria-pressed={notFoundOnly}
            onClick={() => setNotFoundOnly((current) => !current)}
            className={`border px-4 py-2.5 rounded-md text-sm font-medium transition ${
              notFoundOnly
                ? "bg-red-600 border-red-600 text-white"
                : "bg-gray-900 border-gray-700 text-gray-300 hover:border-red-600"
            }`}
          >
            {pages.filter(isNotFound).length} Not Found (404)
          </button>
          <div className="bg-gray-900 border border-gray-700 px-4 py-2.5 rounded-md">
            <span className="text-sm font-medium text-gray-300">
              {stats.total} Total Pages
            </span>
          </div>
        </div>

        {/* Locale Filter Dropdown - Show when we have any locales detected */}
        {availableLocales.length > 0 && (
          <div className="flex items-center gap-3">
            <label htmlFor="locale-filter" className="text-sm font-medium text-gray-300 whitespace-nowrap">
              Country/Region:
            </label>
            <select
              id="locale-filter"
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value)}
              className="px-4 py-2 border border-gray-600 rounded-md bg-gray-900 text-sm font-medium text-gray-300 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition min-w-[200px]"
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
          <span className="text-sm font-medium text-gray-300">
            Filter:
          </span>
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            All Pages
          </button>
          <button
            onClick={() => setFilter("failed")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "failed"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Failed Only
          </button>
          <button
            onClick={() => setFilter("missingH1")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "missingH1"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Missing H1
          </button>
          <button
            onClick={() => setFilter("missingDescription")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "missingDescription"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Missing Description
          </button>
          <button
            onClick={() => setFilter("canonicalWarning")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "canonicalWarning"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Canonical Warning
          </button>
          <button
            onClick={() => setFilter("missingOgImage")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "missingOgImage"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Missing OG Image
          </button>
          <button
            onClick={() => setFilter("imageAltIssue")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              filter === "imageAltIssue"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
            }`}
          >
            Image Alt Issues
          </button>
          <button
            type="button"
            onClick={runAlternateValidation}
            disabled={validatingAlternates || pages.length === 0}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
              filter === "alternateIssue"
                ? "bg-blue-600 text-white"
                : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
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
                  : "bg-gray-900 border border-gray-600 text-gray-300 hover:bg-gray-800"
              }`}
            >
              Alternate Issues
            </button>
          )}
        </div>

        {alternateValidationError && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-md px-3 py-2">
            {alternateValidationError}
          </p>
        )}
        {alternateValidationSummary && (
          <p className="text-sm text-gray-300 bg-gray-800 border border-gray-700 rounded-md px-3 py-2">
            Alternate validation: {alternateValidationSummary.passed} passed,{" "}
            {alternateValidationSummary.warned} warnings, {alternateValidationSummary.failed}{" "}
            failed, {alternateValidationSummary.skipped} not in sitemap
          </p>
        )}

        {/* Results count */}
        <div className="text-sm text-gray-400 font-medium">
          Displaying {viewedPages.length} of {pages.length} total pages
          {selectedLocale !== "all" && (
            <span className="ml-2 text-gray-500">
              (Country: {availableLocales.find(g => g.locale.locale === selectedLocale)?.locale.displayName || selectedLocale})
            </span>
          )}
          {filter !== "all" && (
            <span className="ml-2 text-gray-500">
              (Status:{" "}
              {filter === "alternateIssue"
                ? "Alternate issues"
                : filter === "missingOgImage"
                  ? "Missing OG image"
                  : filter === "imageAltIssue"
                    ? "Image alt issues"
                    : filter})
            </span>
          )}
          {notFoundOnly && (
            <span className="ml-2 text-gray-500">(HTTP 404 only)</span>
          )}
          {statusFocus && (
            <span className="ml-2 text-gray-500">
              (Showing {statusFocus === "pass" ? "passed" : statusFocus === "warn" ? "warnings" : "failed"} only)
            </span>
          )}
        </div>
      </div>

      {/* Grid - Show filtered pages */}
      {viewedPages.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-md border border-gray-700">
          <p className="text-gray-500">
            {pages.length === 0 
              ? "No pages were found. Please check if the website is accessible and contains internal links."
                : notFoundOnly
                ? pages.some((page) => typeof page.statusCode === "number")
                  ? "No HTTP 404 pages match the current filters."
                  : "No HTTP 404 pages in the current results. Run a new crawl to capture status codes, or turn off the 404 filter."
                : "No pages match the current filter. Try selecting 'All Countries' or 'All Pages' to see all crawled pages."}
          </p>
        </div>
      ) : selectedLocale === "all" && localeGroups.length > 0 ? (
        // Show grouped by locale when "All Countries" is selected
        <div className="space-y-8">
          {localeGroups.map((group) => {
            const visiblePages = focusPages(group.pages, statusFocus, notFoundOnly);
            if (visiblePages.length === 0) return null;
            const passed = group.pages.filter((p) => p.status === "pass").length;
            const warned = group.pages.filter((p) => p.status === "warn").length;
            const failed = group.pages.filter((p) => p.status === "fail").length;
            const notFound = group.pages.filter(isNotFound).length;

            return (
            <div key={group.locale.locale} className="space-y-4">
              {/* Locale Header */}
              <div className="flex items-center justify-between border-b border-gray-700 pb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-gray-100">
                    {group.locale.displayName}
                  </h3>
                  <span className="text-sm text-gray-500 bg-gray-800 px-2.5 py-1 rounded-md">
                    {visiblePages.length} {visiblePages.length === 1 ? "page" : "pages"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <button
                    type="button"
                    aria-pressed={statusFocus === "pass"}
                    onClick={() => toggleStatusFocus("pass")}
                    className={`px-2 py-1 rounded transition ${
                      passed > 0 ? "bg-green-900/70 text-green-300" : ""
                    } ${
                      statusFocus === "pass"
                        ? "ring-2 ring-green-600 ring-offset-1 ring-offset-gray-950"
                        : "hover:ring-1 hover:ring-green-300"
                    }`}
                  >
                    {passed} passed
                  </button>
                  <button
                    type="button"
                    aria-pressed={statusFocus === "warn"}
                    onClick={() => toggleStatusFocus("warn")}
                    className={`px-2 py-1 rounded transition ${
                      warned > 0 ? "bg-yellow-900/70 text-yellow-300" : ""
                    } ${
                      statusFocus === "warn"
                        ? "ring-2 ring-yellow-600 ring-offset-1 ring-offset-gray-950"
                        : "hover:ring-1 hover:ring-yellow-300"
                    }`}
                  >
                    {warned} warnings
                  </button>
                  <button
                    type="button"
                    aria-pressed={statusFocus === "fail"}
                    onClick={() => toggleStatusFocus("fail")}
                    className={`px-2 py-1 rounded transition ${
                      failed > 0 ? "bg-red-900/70 text-red-300" : ""
                    } ${
                      statusFocus === "fail"
                        ? "ring-2 ring-red-600 ring-offset-1 ring-offset-gray-950"
                        : "hover:ring-1 hover:ring-red-300"
                    }`}
                  >
                    {failed} failed
                  </button>
                  <button
                    type="button"
                    aria-pressed={notFoundOnly}
                    title="Show HTTP 404 pages only"
                    onClick={() => setNotFoundOnly((current) => !current)}
                    className={`px-2 py-1 rounded transition ${
                      notFoundOnly || notFound > 0
                        ? "bg-red-900/70 text-red-300"
                        : "bg-gray-800 text-gray-400"
                    } ${
                      notFoundOnly
                        ? "ring-2 ring-red-600 ring-offset-1 ring-offset-gray-950"
                        : "hover:ring-1 hover:ring-red-300"
                    }`}
                  >
                    {notFound} 404
                  </button>
                </div>
              </div>
              
              {/* Pages Grid for this locale */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {visiblePages.map((page, index) => (
                  <PageCard
                    key={`${page.url}-${index}`}
                    page={page}
                    alternateValidation={alternateValidations.get(page.url)}
                  />
                ))}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        // Show filtered pages in a single grid (when a specific locale is selected or no multiple locales)
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {viewedPages.map((page, index) => (
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
