"use client";

import type { AiInsightsResult } from "@/lib/ai-insights";
import {
  ACTION_PRIORITY_STYLES,
  PERFORMANCE_RATING_LABELS,
  PERFORMANCE_RATING_STYLES,
} from "@/lib/ai-insights";

interface SeoInsightDisplayProps {
  insights: AiInsightsResult;
  compact?: boolean;
}

function InsightList({
  title,
  items,
  titleClass,
  limit,
}: {
  title: string;
  items: string[];
  titleClass: string;
  limit?: number;
}) {
  if (items.length === 0) return null;
  const shown = limit ? items.slice(0, limit) : items;
  const hidden = limit ? items.length - limit : 0;

  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${titleClass}`}>
        {title}
      </h4>
      <ul className="list-disc list-inside space-y-1 text-gray-700">
        {shown.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
        {hidden > 0 && (
          <li className="list-none text-gray-500 pl-0">+{hidden} more</li>
        )}
      </ul>
    </div>
  );
}

export default function SeoInsightDisplay({
  insights,
  compact = false,
}: SeoInsightDisplayProps) {
  const styles = PERFORMANCE_RATING_STYLES[insights.performanceRating];
  const actions = compact
    ? insights.priorityActions.slice(0, 2)
    : insights.priorityActions;

  return (
    <div className={`space-y-4 text-sm ${compact ? "text-xs" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex px-2 py-0.5 rounded border text-xs font-semibold ${styles.badge}`}
        >
          {PERFORMANCE_RATING_LABELS[insights.performanceRating]}
        </span>
      </div>

      <div>
        <h4 className={`font-semibold text-gray-900 mb-1 ${compact ? "text-xs" : "text-sm"}`}>
          Executive summary
        </h4>
        <p className="text-gray-700 leading-relaxed">{insights.summary}</p>
      </div>

      {insights.seoOutlook && (
        <div className="rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2">
          <h4 className="text-xs font-semibold text-indigo-900 mb-1">SEO outlook</h4>
          <p className="text-gray-700 leading-relaxed">{insights.seoOutlook}</p>
        </div>
      )}

      {!compact && (insights.estimatedOrganicImpact || insights.estimatedRankingRisk) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-emerald-100 bg-emerald-50/40 px-3 py-2">
            <h4 className="text-xs font-semibold text-emerald-900 mb-1">Estimated organic impact</h4>
            <p className="text-gray-700 text-xs leading-relaxed">{insights.estimatedOrganicImpact}</p>
          </div>
          <div className="rounded-md border border-amber-100 bg-amber-50/40 px-3 py-2">
            <h4 className="text-xs font-semibold text-amber-900 mb-1">Estimated ranking risk</h4>
            <p className="text-gray-700 text-xs leading-relaxed">{insights.estimatedRankingRisk}</p>
          </div>
        </div>
      )}

      <InsightList
        title="Critical issues"
        items={insights.criticalIssues}
        titleClass="text-red-800"
        limit={compact ? 2 : undefined}
      />

      <InsightList
        title="High-impact opportunities"
        items={insights.highImpactOpportunities}
        titleClass="text-blue-800"
        limit={compact ? 2 : undefined}
      />

      {actions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-2">
            Priority action plan
          </h4>
          <div className="space-y-2">
            {actions.map((action, i) => {
              const pStyles = ACTION_PRIORITY_STYLES[action.priority];
              return (
                <div
                  key={i}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2.5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${pStyles.badge}`}
                    >
                      {action.priority}
                    </span>
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                      {action.category}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900">{action.issue}</p>
                  {!compact && (
                    <>
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium text-gray-700">Why it matters:</span>{" "}
                        {action.impact}
                      </p>
                      <p className="text-xs text-indigo-800 mt-1">
                        <span className="font-medium">Recommendation:</span>{" "}
                        {action.recommendation}
                      </p>
                    </>
                  )}
                  {compact && (
                    <p className="text-xs text-indigo-800 mt-1">{action.recommendation}</p>
                  )}
                </div>
              );
            })}
            {compact && insights.priorityActions.length > 2 && (
              <p className="text-xs text-gray-500">
                +{insights.priorityActions.length - 2} more actions in full report
              </p>
            )}
          </div>
        </div>
      )}

      <InsightList
        title="What's wrong"
        items={insights.whatsWrong}
        titleClass="text-red-700"
        limit={compact ? 3 : undefined}
      />

      <InsightList
        title="What's working"
        items={insights.whatsWorking}
        titleClass="text-green-700"
      />

      <InsightList
        title="SEO best practices"
        items={insights.bestPractices}
        titleClass="text-blue-700"
        limit={compact ? 2 : undefined}
      />
    </div>
  );
}
