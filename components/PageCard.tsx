"use client";

import { useState } from "react";
import StatusBadge from "./StatusBadge";
import type { PageReport } from "@/lib/page-analyzer";

interface PageCardProps {
  page: PageReport;
}

export default function PageCard({ page }: PageCardProps) {
  const [jsonLdExpanded, setJsonLdExpanded] = useState(false);
  const [jsonLdTypesExpanded, setJsonLdTypesExpanded] = useState(false);
  const [twitterExpanded, setTwitterExpanded] = useState(false);
  const [openGraphExpanded, setOpenGraphExpanded] = useState(false);
  const CheckItem = ({ label, hasValue }: { label: string; hasValue: boolean }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span className={`text-base font-medium ${hasValue ? "text-green-600" : "text-red-600"}`}>
        {hasValue ? "✓" : "✗"}
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-md border border-gray-200 shadow-sm hover:shadow transition-shadow p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5 pb-4 border-b border-gray-200">
        <div className="flex-1 min-w-0 pr-4">
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 hover:underline break-all text-sm font-medium"
          >
            {page.url}
          </a>
        </div>
        <StatusBadge status={page.status} size="sm" />
      </div>

      {/* H1 Tag Check */}
      <div className="mb-4 min-w-0">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          H1 Tags ({page.h1Count})
        </div>
        <CheckItem 
          label={`Single H1`} 
          hasValue={page.hasSingleH1} 
        />
        {page.h1Texts.length > 0 && (
          <div className="mt-2 space-y-1 min-w-0">
            {page.h1Texts.map((text, idx) => (
              <div key={idx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 min-w-0 overflow-hidden">
                <span className="font-medium">H1 {idx + 1}:</span>{" "}
                <span className="break-all break-words">{text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Heading Counts H2-H6 */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Heading Structure
        </div>
        <div className="grid grid-cols-5 gap-2 text-xs">
          <div className={`text-center p-2 bg-gray-50 rounded border border-gray-100 ${page.headingCounts.h2 > 0 ? "border-green-500" : "border-red-600"}`}>
            <div className="font-semibold text-gray-700">H2</div>
            <div className="text-gray-600">{page.headingCounts.h2}</div>
          </div>
          <div className={`text-center p-2 bg-gray-50 rounded border ${page.headingCounts.h3 > 0 ? "border-green-500" : "bg-red-600"}`}>
            <div className="font-semibold text-gray-700">H3</div>
            <div className="text-gray-600">{page.headingCounts.h3}</div>
          </div>
          <div className={`text-center p-2 bg-gray-50 rounded border  ${page.headingCounts.h4 > 0 ? "border-green-500" : "border-red-600"}`}>
            <div className="font-semibold text-gray-700">H4</div>
            <div className="text-gray-600">{page.headingCounts.h4}</div>
          </div>
          <div className={`text-center p-2 bg-gray-50 rounded border  ${page.headingCounts.h5 > 0 ? "border-green-500" : "border-red-600"}`}>
            <div className="font-semibold text-gray-700">H5</div>
            <div className="text-gray-600">{page.headingCounts.h5}</div>
          </div>
          <div className={`text-center p-2 bg-gray-50 rounded border  ${page.headingCounts.h6 > 0 ? "border-green-500" : "border-red-600"}`}>
            <div className="font-semibold text-gray-700">H6</div>
            <div className="text-gray-600">{page.headingCounts.h6}</div>
          </div>
        </div>
      </div>

      {/* Meta Tags Checks */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Meta Tags
        </div>
        <div>
          <CheckItem label="Title" hasValue={!!page.meta.title} />
          {page.meta.title && (
            <div className="py-2 border-b border-gray-100 text-xs text-gray-600 bg-gray-50 p-2 rounded break-words">
              <span className="font-medium">Title:</span> {page.meta.title}
            </div>
          )}
          <CheckItem label="Description" hasValue={!!page.meta.description} />
          {page.meta.description && (
            <div className="py-2 border-b border-gray-100 text-xs text-gray-600 bg-gray-50 p-2 rounded break-words">
              <span className="font-medium">Description:</span> {page.meta.description}
            </div>
          )}
          <CheckItem label="Keywords" hasValue={!!page.meta.keywords} />
          {page.meta.keywords && (
            <div className="py-2 border-b border-gray-100 text-xs text-gray-600 bg-gray-50 p-2 rounded break-words">
              <span className="font-medium">Keywords:</span> {page.meta.keywords}
            </div>
          )}
          <CheckItem label="Robots" hasValue={!!page.meta.robots && !page.meta.robots.toLowerCase().includes("noindex")} />
          <CheckItem label="Canonical" hasValue={!!page.meta.canonical} />
        </div>
      </div>

      {/* Open Graph Checks - Expandable */}
      <div className="mb-4">
        <button
          onClick={() => setOpenGraphExpanded(!openGraphExpanded)}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Open Graph
          </div>
          <span className="text-xs text-gray-500">
            {openGraphExpanded ? "▼" : "▶"}
          </span>
        </button>
        {openGraphExpanded && (
          <div>
            <CheckItem label="og:title" hasValue={!!page.og.title} />
            <CheckItem label="og:description" hasValue={!!page.og.description} />
            <CheckItem label="og:image" hasValue={!!page.og.image} />
            {page.og.image && (
              <div className="py-2 border-b border-gray-100">
                <div className="text-xs text-gray-700 mb-1 font-medium">OG Image:</div>
                <img 
                  src={page.og.image} 
                  alt="Open Graph" 
                  className="w-full h-auto rounded border border-gray-200 max-h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Twitter Card Checks - Expandable */}
      <div className="mb-4">
        <button
          onClick={() => setTwitterExpanded(!twitterExpanded)}
          className="flex items-center justify-between w-full text-left mb-2"
        >
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Twitter Cards
            </div>
            {(!page.twitter.card && !page.twitter.title && !page.twitter.description && !page.twitter.image) && (
              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                ⚠ Warning
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {twitterExpanded ? "▼" : "▶"}
          </span>
        </button>
        {twitterExpanded && (
          <div>
            <CheckItem label="twitter:card" hasValue={!!page.twitter.card} />
            <CheckItem label="twitter:title" hasValue={!!page.twitter.title} />
            <CheckItem label="twitter:description" hasValue={!!page.twitter.description} />
            <CheckItem label="twitter:image" hasValue={!!page.twitter.image} />
            
            {(page.twitter.card || page.twitter.title || page.twitter.description || page.twitter.image) && (
              <div className="mt-2 border-t border-gray-100 pt-2 space-y-2">
                {page.twitter.card && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 break-words">
                    <span className="font-medium">Card:</span> {page.twitter.card}
                  </div>
                )}
                {page.twitter.title && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 break-words">
                    <span className="font-medium">Title:</span> {page.twitter.title}
                  </div>
                )}
                {page.twitter.description && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 break-words">
                    <span className="font-medium">Description:</span> {page.twitter.description}
                  </div>
                )}
                {page.twitter.image && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 break-words">
                    <span className="font-medium">Image:</span>{" "}
                    <a href={page.twitter.image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                      {page.twitter.image}
                    </a>
                    <img 
                      src={page.twitter.image} 
                      alt="Twitter Card" 
                      className="w-full h-auto rounded border border-gray-200 max-h-48 object-cover mt-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* JSON-LD Check - Expandable with content display */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          JSON-LD Structured Data
        </div>
        <div>
          <CheckItem label="JSON-LD Present" hasValue={page.jsonLd.present} />
          {page.jsonLd.present && (
            <>
              <CheckItem label="JSON-LD Valid" hasValue={page.jsonLd.valid} />
              <div className="py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">Count: </span>
                <span className="text-sm font-semibold text-gray-900">{page.jsonLd.count}</span>
              </div>
              {page.jsonLd.types.length > 0 && (
                <div className="py-2 border-b border-gray-100">
                  <button
                    onClick={() => setJsonLdTypesExpanded(!jsonLdTypesExpanded)}
                    className="flex items-center justify-between w-full text-left text-sm text-gray-700 hover:text-gray-900"
                  >
                    <span className="font-medium">Types ({page.jsonLd.types.length}):</span>
                    <span className="text-xs text-gray-500">
                      {jsonLdTypesExpanded ? "▼" : "▶"}
                    </span>
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
                <div className="py-2 border-b border-gray-100">
                  <div className="text-xs text-red-700 font-medium mb-1">Errors:</div>
                  <div className="space-y-1">
                    {page.jsonLd.errors.map((error, idx) => (
                      <div key={idx} className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 break-words">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {page.jsonLd.data && page.jsonLd.data.length > 0 && (
                <div className="py-2 border-b border-gray-100">
                  <button
                    onClick={() => setJsonLdExpanded(!jsonLdExpanded)}
                    className="flex items-center justify-between w-full text-left text-sm text-gray-700 hover:text-gray-900"
                  >
                    <span className="font-medium">
                      View JSON-LD Content ({page.jsonLd.data.length}):
                    </span>
                    <span className="text-xs text-gray-500">
                      {jsonLdExpanded ? "▼" : "▶"}
                    </span>
                  </button>
                  {jsonLdExpanded && (
                    <div className="mt-2 space-y-2">
                      {page.jsonLd.data.map((item, idx) => {
                        let formattedContent = item.content;
                        try {
                          // Try to parse and format the JSON
                          const parsed = JSON.parse(item.content);
                          formattedContent = JSON.stringify(parsed, null, 2);
                        } catch {
                          // If parsing fails, show original content
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

      {/* Performance Summary */}
      {page.performance && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            Performance
          </div>
          <div className="space-y-1 text-xs">
            {page.performance.pageLoadTime && (
              <div className="flex justify-between">
                <span className="text-gray-600">Load Time:</span>
                <span className={page.performance.pageLoadTime.status === "pass" ? "text-green-600" : page.performance.pageLoadTime.status === "warn" ? "text-yellow-600" : "text-red-600"}>
                  {typeof page.performance.pageLoadTime.value === "number" ? `${page.performance.pageLoadTime.value}ms` : "-"}
                </span>
              </div>
            )}
            {page.performance.totalPageSize && (
              <div className="flex justify-between">
                <span className="text-gray-600">Page Size:</span>
                <span className={page.performance.totalPageSize.status === "pass" ? "text-green-600" : page.performance.totalPageSize.status === "warn" ? "text-yellow-600" : "text-red-600"}>
                  {typeof page.performance.totalPageSize.value === "number" ? `${page.performance.totalPageSize.value.toFixed(2)}MB` : "-"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security Summary */}
      {page.security && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            Security
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">HTTPS:</span>
              <span className={page.security.sslCertificate?.status === "pass" ? "text-green-600" : "text-yellow-600"}>
                {page.security.sslCertificate?.status === "pass" ? "✓" : "⚠"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Security Headers:</span>
              <span className={page.security.contentSecurityPolicy?.status === "pass" && page.security.xFrameOptions?.status === "pass" ? "text-green-600" : "text-yellow-600"}>
                {page.security.contentSecurityPolicy?.status === "pass" && page.security.xFrameOptions?.status === "pass" ? "✓" : "⚠"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Accessibility Summary */}
      {page.accessibility && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            Accessibility
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Alt Text:</span>
              <span className={page.accessibility.altText?.status === "pass" ? "text-green-600" : page.accessibility.altText?.status === "warn" ? "text-yellow-600" : "text-red-600"}>
                {page.accessibility.altText?.status === "pass" ? "✓" : page.accessibility.altText?.status === "warn" ? "⚠" : "✗"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Form Labels:</span>
              <span className={page.accessibility.formLabels?.status === "pass" ? "text-green-600" : "text-yellow-600"}>
                {page.accessibility.formLabels?.status === "pass" ? "✓" : "⚠"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      {page.analytics && (
        <div className="mb-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            Analytics
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Google Analytics:</span>
              <span className={page.analytics.googleAnalytics?.status === "pass" ? "text-green-600" : "text-gray-400"}>
                {page.analytics.googleAnalytics?.status === "pass" ? "✓" : "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Consent:</span>
              <span className={page.analytics.trackingConsent?.status === "pass" ? "text-green-600" : "text-yellow-600"}>
                {page.analytics.trackingConsent?.status === "pass" ? "✓" : "⚠"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Issues */}
      {page.issues.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            Issues ({page.issues.length})
          </div>
          <ul className="space-y-1.5">
            {page.issues.slice(0, 5).map((issue, index) => (
              <li
                key={index}
                className="text-xs text-gray-600 flex items-start gap-2"
              >
                <span className="text-red-500 mt-0.5">•</span>
                <span>{issue}</span>
              </li>
            ))}
            {page.issues.length > 5 && (
              <li className="text-xs text-gray-500">
                ... and {page.issues.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
