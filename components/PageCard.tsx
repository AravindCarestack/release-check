import StatusBadge from "./StatusBadge";
import type { PageReport } from "@/lib/page-analyzer";

interface PageCardProps {
  page: PageReport;
}

export default function PageCard({ page }: PageCardProps) {
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
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          H1 Tags ({page.h1Count})
        </div>
        <CheckItem 
          label={`Single H1`} 
          hasValue={page.hasSingleH1} 
        />
        {page.h1Texts.length > 0 && (
          <div className="mt-2 space-y-1">
            {page.h1Texts.map((text, idx) => (
              <div key={idx} className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                <span className="font-medium">H1 {idx + 1}:</span> {text}
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
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-100">
            <div className="font-semibold text-gray-700">H2</div>
            <div className="text-gray-600">{page.headingCounts.h2}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-100">
            <div className="font-semibold text-gray-700">H3</div>
            <div className="text-gray-600">{page.headingCounts.h3}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-100">
            <div className="font-semibold text-gray-700">H4</div>
            <div className="text-gray-600">{page.headingCounts.h4}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-100">
            <div className="font-semibold text-gray-700">H5</div>
            <div className="text-gray-600">{page.headingCounts.h5}</div>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded border border-gray-100">
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
          <CheckItem label="Description" hasValue={!!page.meta.description} />
          <CheckItem label="Robots" hasValue={!!page.meta.robots && !page.meta.robots.toLowerCase().includes("noindex")} />
          <CheckItem label="Canonical" hasValue={!!page.meta.canonical} />
        </div>
      </div>

      {/* Open Graph Checks */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Open Graph
        </div>
        <div>
          <CheckItem label="og:title" hasValue={!!page.og.title} />
          <CheckItem label="og:description" hasValue={!!page.og.description} />
          <CheckItem label="og:image" hasValue={!!page.og.image} />
        </div>
      </div>

      {/* Twitter Card Checks */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Twitter Cards
        </div>
        <div>
          <CheckItem label="twitter:card" hasValue={!!page.twitter.card} />
          <CheckItem label="twitter:title" hasValue={!!page.twitter.title} />
          <CheckItem label="twitter:description" hasValue={!!page.twitter.description} />
          <CheckItem label="twitter:image" hasValue={!!page.twitter.image} />
        </div>
      </div>

      {/* JSON-LD Check */}
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
              {page.jsonLd.errors.length > 0 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  Errors: {page.jsonLd.errors.join(", ")}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sitemap Check */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          Sitemap
        </div>
        <CheckItem label="Sitemap Found" hasValue={page.sitemap.present} />
        {page.sitemap.present && page.sitemap.url && (
          <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 break-all">
            {page.sitemap.url}
          </div>
        )}
      </div>

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
