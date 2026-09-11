"use client";

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import SeoInsightDisplay from "./SeoInsightDisplay";
import type { PageReport } from "@/lib/page-analyzer";
import type { AlternateValidationResult } from "@/lib/alternate-validator";
import type { AiInsightsResult } from "@/lib/ai-insights";
import { buildPageSummary } from "@/lib/ai-insights-summary";

interface PageCardProps {
  page: PageReport;
  alternateValidation?: AlternateValidationResult;
}

function resolveAssetUrl(src: string | null | undefined, pageUrl: string): string | null {
  if (!src?.trim()) return null;
  try {
    return new URL(src.trim(), pageUrl).href;
  } catch {
    return src.trim();
  }
}

function displayPath(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "pass" | "warn" | "fail" | "neutral";
}) {
  const tones = {
    pass: "bg-green-50 text-green-700 border-green-200",
    warn: "bg-yellow-50 text-yellow-800 border-yellow-200",
    fail: "bg-red-50 text-red-700 border-red-200",
    neutral: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span className={`text-[11px] leading-none px-1.5 py-1 rounded border ${tones[tone]}`}>
      {label}
    </span>
  );
}

function PreviewImage({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 text-[11px] text-gray-400">
        No {label}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function PageCard({ page, alternateValidation }: PageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [jsonLdExpanded, setJsonLdExpanded] = useState(false);
  const [jsonLdTypesExpanded, setJsonLdTypesExpanded] = useState(false);
  const [twitterExpanded, setTwitterExpanded] = useState(false);
  const [openGraphExpanded, setOpenGraphExpanded] = useState(true);
  const [aiInsight, setAiInsight] = useState<AiInsightsResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAi, setShowAi] = useState(false);

  const ogImage = resolveAssetUrl(page.og.image, page.url);
  const twitterImage = resolveAssetUrl(page.twitter.image, page.url);
  const previewImage = ogImage || twitterImage;
  const imageCount = page.images?.count ?? 0;
  const missingAlt = page.images?.missingAlt ?? 0;
  const emptyAlt = page.images?.emptyAlt ?? 0;
  const altIssues = missingAlt + emptyAlt;
  const pageTitle = page.meta.title || page.og.title || page.h1Texts[0] || "Untitled page";
  const hasJsonLd = page.jsonLd.present && page.jsonLd.valid;
  const isPerfect =
    page.hasSingleH1 &&
    !!page.meta.title &&
    !!page.meta.description &&
    !!ogImage &&
    hasJsonLd &&
    altIssues === 0;

  const cardBorderClass = isPerfect
    ? "border-2 border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,0.15)]"
    : page.status === "fail"
      ? "border border-red-300"
      : page.status === "warn"
        ? "border border-yellow-300"
        : "border border-gray-200";

  const checkForCanonical = (canonical: string, value: string) => {
    try {
      const c = new URL(canonical);
      const v = new URL(value);
      const normalizeHost = (host: string) => host.replace(/^www\./, "").toLowerCase();
      const normalizePath = (path: string) => (path.endsWith("/") ? path.slice(0, -1) : path) || "/";
      return (
        normalizeHost(c.hostname) === normalizeHost(v.hostname) &&
        normalizePath(c.pathname) === normalizePath(v.pathname)
      );
    } catch {
      return false;
    }
  };

  const fetchPageInsight = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/analyze/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "page", summary: buildPageSummary(page) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "SEO analysis failed");
      setAiInsight(data.insights);
      setShowAi(true);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "SEO analysis failed");
    } finally {
      setAiLoading(false);
    }
  };

  const CheckItem = ({
    label,
    hasValue,
    value,
    isWarning = false,
  }: {
    label: string;
    hasValue: boolean;
    value?: string | null;
    isWarning?: boolean;
  }) => (
    <div className="flex flex-col text-left items-baseline justify-between py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 justify-between w-full">
        <span className="text-sm text-gray-700">{label}</span>
        {isWarning ? (
          <span className="text-sm font-medium text-yellow-600">⚠</span>
        ) : (
          <span className={`text-sm font-medium ${hasValue ? "text-green-600" : "text-red-600"}`}>
            {hasValue ? "✓" : "✗"}
          </span>
        )}
      </div>
      {value && (
        <span
          className={`text-xs text-gray-700 mt-1 break-words ${
            hasValue && !isWarning ? "text-green-600" : "text-red-600 bg-red-50 p-1.5 rounded border border-red-200"
          }`}
        >
          {value}
        </span>
      )}
    </div>
  );

  return (
    <div className={`bg-white rounded-md shadow-sm hover:shadow transition-shadow overflow-hidden ${cardBorderClass}`}>
      <div className="relative aspect-[16/7] bg-gray-100 border-b border-gray-200">
        <PreviewImage src={previewImage} label="OG / Twitter image" />
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {isPerfect && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-600 text-white">
              All good
            </span>
          )}
          <StatusBadge status={page.status} size="sm" />
        </div>
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
              ogImage ? "bg-white/90 text-gray-700 border-gray-200" : "bg-red-50/95 text-red-700 border-red-200"
            }`}
          >
            {ogImage ? "OG image" : "No OG image"}
          </span>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border bg-white/90 border-gray-200 ${
              altIssues > 0 ? "text-red-700" : "text-gray-700"
            }`}
          >
            {imageCount} img{imageCount === 1 ? "" : "s"}
            {altIssues > 0 ? ` · ${altIssues} alt issue${altIssues === 1 ? "" : "s"}` : ""}
          </span>
        </div>
      </div>

      <div className="p-3">
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium truncate block"
          title={page.url}
        >
          {displayPath(page.url)}
        </a>
        <h3 className="text-sm font-semibold text-gray-900 mt-0.5 line-clamp-2" title={pageTitle}>
          {pageTitle}
        </h3>

        <div className="flex flex-wrap gap-1 mt-2">
          <Chip
            label={page.hasSingleH1 ? "H1" : page.h1Count === 0 ? "No H1" : `${page.h1Count} H1s`}
            tone={page.hasSingleH1 ? "pass" : "fail"}
          />
          <Chip label="Title" tone={page.meta.title ? "pass" : "fail"} />
          <Chip label="Desc" tone={page.meta.description ? "pass" : "fail"} />
          <Chip label="OG" tone={ogImage ? "pass" : "fail"} />
          <Chip
            label={hasJsonLd ? "JSON-LD" : "No JSON-LD"}
            tone={hasJsonLd ? "pass" : "fail"}
          />
          <Chip
            label={twitterImage ? "Twitter" : "No Twitter img"}
            tone={twitterImage ? "pass" : "warn"}
          />
          <Chip
            label={`${imageCount} imgs`}
            tone={imageCount === 0 ? "warn" : "neutral"}
          />
          {altIssues > 0 && (
            <Chip
              label={`${altIssues} missing alt`}
              tone="fail"
            />
          )}
          {page.issues.length > 0 && (
            <Chip
              label={`${page.issues.length} issue${page.issues.length === 1 ? "" : "s"}`}
              tone={page.status === "fail" ? "fail" : "warn"}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-3">
          <button
            type="button"
            onClick={fetchPageInsight}
            disabled={aiLoading}
            className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200 transition disabled:opacity-50"
          >
            {aiLoading ? "Analyzing…" : "SEO analysis"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="text-xs font-medium text-gray-700 hover:text-gray-900 px-2 py-1"
          >
            {expanded ? "Hide details" : "Details"}
          </button>
        </div>

        {aiError && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
            {aiError}
          </p>
        )}

        {showAi && aiInsight && (
          <div className="mt-3 p-3 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-indigo-900">Page SEO outlook</h4>
              <button
                type="button"
                onClick={() => setShowAi(false)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Hide
              </button>
            </div>
            <SeoInsightDisplay insights={aiInsight} />
          </div>
        )}

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Images
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">Open Graph</div>
                  <div className="aspect-[1.91/1] rounded border border-gray-200 overflow-hidden bg-gray-50">
                    <PreviewImage src={ogImage} label="OG image" />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">Twitter</div>
                  <div className="aspect-[1.91/1] rounded border border-gray-200 overflow-hidden bg-gray-50">
                    <PreviewImage src={twitterImage} label="Twitter image" />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                {imageCount} image{imageCount === 1 ? "" : "s"} on page
                {missingAlt > 0 ? ` · ${missingAlt} missing alt` : ""}
                {emptyAlt > 0 ? ` · ${emptyAlt} empty alt` : ""}
              </p>
            </div>

            <div className="mb-4 min-w-0">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                H1 Tags ({page.h1Count})
              </div>
              <CheckItem label="Single H1" hasValue={page.hasSingleH1} />
              {page.h1Texts.length > 0 && (
                <div className="mt-2 space-y-1 min-w-0">
                  {page.h1Texts.map((text, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 min-w-0 overflow-hidden"
                    >
                      <span className="font-medium">H1 {idx + 1}:</span>{" "}
                      <span className="break-all break-words">{text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Heading Structure
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-xs">
                {(["h2", "h3", "h4", "h5", "h6"] as const).map((level) => (
                  <div
                    key={level}
                    className={`text-center p-1.5 bg-gray-50 rounded border ${
                      page.headingCounts[level] > 0 ? "border-green-500" : "border-red-300"
                    }`}
                  >
                    <div className="font-semibold text-gray-700 uppercase">{level}</div>
                    <div className="text-gray-600">{page.headingCounts[level]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                Meta Tags
              </div>
              <div>
                <CheckItem label="Title" hasValue={!!page.meta.title} />
                {page.meta.title && (
                  <div className="py-1.5 text-xs text-gray-600 bg-gray-50 p-2 rounded break-words">
                    <span className="font-medium">Title:</span> {page.meta.title}
                  </div>
                )}
                <CheckItem label="Description" hasValue={!!page.meta.description} />
                {page.meta.description && (
                  <div className="py-1.5 text-xs text-gray-600 bg-gray-50 p-2 rounded break-words">
                    <span className="font-medium">Description:</span> {page.meta.description}
                  </div>
                )}
                <CheckItem label="Keywords" hasValue={!!page.meta.keywords} />
                {page.meta.keywords && (
                  <div className="py-1.5 text-xs text-gray-600 bg-gray-50 p-2 rounded break-words">
                    <span className="font-medium">Keywords:</span> {page.meta.keywords}
                  </div>
                )}
                <CheckItem
                  label="Robots"
                  hasValue={!!page.meta.robots && !page.meta.robots.toLowerCase().includes("noindex")}
                />
                <CheckItem
                  label="Canonical"
                  hasValue={checkForCanonical(page?.meta?.canonical || "", page.url)}
                  value={page?.meta?.canonical}
                  isWarning={!checkForCanonical(page?.meta?.canonical || "", page.url)}
                />
              </div>
            </div>

            {(page.alternates?.length > 0 || alternateValidation) && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Alternate Links ({page.alternates?.length ?? 0})
                </div>
                {alternateValidation && (
                  <div
                    className={`mb-2 text-xs px-2 py-1.5 rounded border ${
                      alternateValidation.status === "pass"
                        ? "bg-green-50 text-green-800 border-green-200"
                        : alternateValidation.status === "warn"
                          ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                          : alternateValidation.status === "fail"
                            ? "bg-red-50 text-red-800 border-red-200"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                  >
                    Sitemap match:{" "}
                    {alternateValidation.status === "pass"
                      ? "✓ All alternates match"
                      : alternateValidation.status === "skip"
                        ? "— URL not in sitemap"
                        : alternateValidation.issues[0] ?? "Mismatch"}
                  </div>
                )}
                {alternateValidation &&
                  alternateValidation.issues.length > 0 &&
                  alternateValidation.status !== "pass" && (
                    <ul className="mb-2 text-xs text-red-700 space-y-1 list-disc list-inside">
                      {alternateValidation.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                {page.alternates?.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {page.alternates.map((alt, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 break-all"
                      >
                        <span className="font-medium">{alt.hreflang || "(no hreflang)"}:</span> {alt.href}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No alternate links on page</p>
                )}
              </div>
            )}

            <div className="mb-4">
              <button
                onClick={() => setOpenGraphExpanded(!openGraphExpanded)}
                className="flex items-center justify-between w-full text-left mb-2"
              >
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open Graph</div>
                <span className="text-xs text-gray-500">{openGraphExpanded ? "▼" : "▶"}</span>
              </button>
              {openGraphExpanded && (
                <div>
                  <CheckItem label="og:title" hasValue={!!page.og.title} />
                  <CheckItem label="og:description" hasValue={!!page.og.description} />
                  <CheckItem label="og:image" hasValue={!!page.og.image} value={page.og.image} />
                </div>
              )}
            </div>

            <div className="mb-4">
              <button
                onClick={() => setTwitterExpanded(!twitterExpanded)}
                className="flex items-center justify-between w-full text-left mb-2"
              >
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Twitter Cards
                  </div>
                  {!page.twitter.card &&
                    !page.twitter.title &&
                    !page.twitter.description &&
                    !page.twitter.image && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                        ⚠ Warning
                      </span>
                    )}
                </div>
                <span className="text-xs text-gray-500">{twitterExpanded ? "▼" : "▶"}</span>
              </button>
              {twitterExpanded && (
                <div>
                  <CheckItem label="twitter:card" hasValue={!!page.twitter.card} />
                  <CheckItem label="twitter:title" hasValue={!!page.twitter.title} />
                  <CheckItem label="twitter:description" hasValue={!!page.twitter.description} />
                  <CheckItem label="twitter:image" hasValue={!!page.twitter.image} value={page.twitter.image} />
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                JSON-LD Structured Data
              </div>
              <div>
                <CheckItem label="JSON-LD Present" hasValue={page.jsonLd.present} />
                {page.jsonLd.present && (
                  <>
                    <CheckItem label="JSON-LD Valid" hasValue={page.jsonLd.valid} />
                    <div className="py-1.5 border-b border-gray-100">
                      <span className="text-sm text-gray-700">Count: </span>
                      <span className="text-sm font-semibold text-gray-900">{page.jsonLd.count}</span>
                    </div>
                    {page.jsonLd.types.length > 0 && (
                      <div className="py-1.5 border-b border-gray-100">
                        <button
                          onClick={() => setJsonLdTypesExpanded(!jsonLdTypesExpanded)}
                          className="flex items-center justify-between w-full text-left text-sm text-gray-700 hover:text-gray-900"
                        >
                          <span className="font-medium">Types ({page.jsonLd.types.length}):</span>
                          <span className="text-xs text-gray-500">{jsonLdTypesExpanded ? "▼" : "▶"}</span>
                        </button>
                        {jsonLdTypesExpanded && (
                          <div className="mt-1 space-y-1">
                            {page.jsonLd.types.map((type, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 break-words"
                              >
                                {type}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {page.jsonLd.errors.length > 0 && (
                      <div className="py-1.5 border-b border-gray-100">
                        <div className="text-xs text-red-700 font-medium mb-1">Errors:</div>
                        <div className="space-y-1">
                          {page.jsonLd.errors.map((error, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 break-words"
                            >
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {page.jsonLd.data && page.jsonLd.data.length > 0 && (
                      <div className="py-1.5">
                        <button
                          onClick={() => setJsonLdExpanded(!jsonLdExpanded)}
                          className="flex items-center justify-between w-full text-left text-sm text-gray-700 hover:text-gray-900"
                        >
                          <span className="font-medium">
                            View JSON-LD Content ({page.jsonLd.data.length}):
                          </span>
                          <span className="text-xs text-gray-500">{jsonLdExpanded ? "▼" : "▶"}</span>
                        </button>
                        {jsonLdExpanded && (
                          <div className="mt-2 space-y-2">
                            {page.jsonLd.data.map((item, idx) => {
                              let formattedContent = item.content;
                              try {
                                const parsed = JSON.parse(item.content);
                                formattedContent = JSON.stringify(parsed, null, 2);
                              } catch {
                                formattedContent = item.content;
                              }
                              return (
                                <div key={idx} className="text-xs">
                                  <div className="font-medium text-gray-700 mb-1">JSON-LD #{item.index}:</div>
                                  <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap break-words font-mono max-h-64 overflow-y-auto">
                                    {formattedContent}
                                  </pre>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {page.performance && (
              <div className="mb-4 pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Performance
                </div>
                <div className="space-y-1 text-xs">
                  {page.performance.pageLoadTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Load Time:</span>
                      <span
                        className={
                          page.performance.pageLoadTime.status === "pass"
                            ? "text-green-600"
                            : page.performance.pageLoadTime.status === "warn"
                              ? "text-yellow-600"
                              : "text-red-600"
                        }
                      >
                        {typeof page.performance.pageLoadTime.value === "number"
                          ? `${page.performance.pageLoadTime.value}ms`
                          : "-"}
                      </span>
                    </div>
                  )}
                  {page.performance.totalPageSize && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Page Size:</span>
                      <span
                        className={
                          page.performance.totalPageSize.status === "pass"
                            ? "text-green-600"
                            : page.performance.totalPageSize.status === "warn"
                              ? "text-yellow-600"
                              : "text-red-600"
                        }
                      >
                        {typeof page.performance.totalPageSize.value === "number"
                          ? `${page.performance.totalPageSize.value.toFixed(2)}MB`
                          : "-"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {page.security && (
              <div className="mb-4 pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Security
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">HTTPS:</span>
                    <span
                      className={
                        page.security.sslCertificate?.status === "pass" ? "text-green-600" : "text-yellow-600"
                      }
                    >
                      {page.security.sslCertificate?.status === "pass" ? "✓" : "⚠"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Security Headers:</span>
                    <span
                      className={
                        page.security.contentSecurityPolicy?.status === "pass" &&
                        page.security.xFrameOptions?.status === "pass"
                          ? "text-green-600"
                          : "text-yellow-600"
                      }
                    >
                      {page.security.contentSecurityPolicy?.status === "pass" &&
                      page.security.xFrameOptions?.status === "pass"
                        ? "✓"
                        : "⚠"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {page.accessibility && (
              <div className="mb-4 pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Accessibility
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Alt Text:</span>
                    <span
                      className={
                        page.accessibility.altText?.status === "pass"
                          ? "text-green-600"
                          : page.accessibility.altText?.status === "warn"
                            ? "text-yellow-600"
                            : "text-red-600"
                      }
                    >
                      {page.accessibility.altText?.status === "pass"
                        ? "✓"
                        : page.accessibility.altText?.status === "warn"
                          ? "⚠"
                          : "✗"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Form Labels:</span>
                    <span
                      className={
                        page.accessibility.formLabels?.status === "pass" ? "text-green-600" : "text-yellow-600"
                      }
                    >
                      {page.accessibility.formLabels?.status === "pass" ? "✓" : "⚠"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {page.analytics && (
              <div className="mb-4 pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Analytics
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Google Analytics:</span>
                    <span
                      className={
                        page.analytics.googleAnalytics?.status === "pass" ? "text-green-600" : "text-gray-400"
                      }
                    >
                      {page.analytics.googleAnalytics?.status === "pass" ? "✓" : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Consent:</span>
                    <span
                      className={
                        page.analytics.trackingConsent?.status === "pass" ? "text-green-600" : "text-yellow-600"
                      }
                    >
                      {page.analytics.trackingConsent?.status === "pass" ? "✓" : "⚠"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {page.issues.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                  Issues ({page.issues.length})
                </div>
                <ul className="space-y-1.5">
                  {page.issues.slice(0, 5).map((issue, index) => (
                    <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                  {page.issues.length > 5 && (
                    <li className="text-xs text-gray-500">... and {page.issues.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
