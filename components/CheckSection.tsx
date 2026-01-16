"use client";

import type { CheckResult } from "@/app/types";

interface CheckSectionProps {
  title: string;
  section: string;
  checks: Record<string, CheckResult> | any;
  expanded: boolean;
  onToggle: (section: string) => void;
}

export default function CheckSection({
  title,
  section,
  checks,
  expanded,
  onToggle,
}: CheckSectionProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "text-green-700 bg-green-50 border border-green-200";
      case "warn":
        return "text-yellow-700 bg-yellow-50 border border-yellow-200";
      case "fail":
        return "text-red-700 bg-red-50 border border-red-200";
      default:
        return "text-gray-700 bg-gray-50 border border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return "✓";
      case "warn":
        return "⚠";
      case "fail":
        return "✗";
      default:
        return "?";
    }
  };

  // Handle special cases for Links and other complex types
  const renderCheckItem = (key: string, check: CheckResult | any) => {
    if (key === "brokenLinks" && Array.isArray(check)) {
      return (
        <div key={key} className="p-4 border-b border-gray-200 last:border-0">
          <div className="flex items-start justify-between mb-2">
            <span className="font-medium text-gray-900">
              Broken Links
            </span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(check.length > 0 ? "warn" : "pass")}`}>
              {check.length > 0 ? "⚠ Warning" : "✓ Pass"}
            </span>
          </div>
          {check.length > 0 ? (
            <div className="mt-2 space-y-1">
              {check.slice(0, 5).map((link: any, idx: number) => (
                <div key={idx} className="text-sm text-gray-600">
                  <span className="font-mono">{link.url}</span>
                  {link.status > 0 && (
                    <span className="ml-2 text-red-600">(HTTP {link.status})</span>
                  )}
                </div>
              ))}
              {check.length > 5 && (
                <div className="text-sm text-gray-500">
                  ... and {check.length - 5} more
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No broken links detected</p>
          )}
        </div>
      );
    }

    if (typeof check === "number") {
      // Handle numeric values like totalLinks, internalLinks, etc.
      return (
        <div key={key} className="p-4 border-b border-gray-200 last:border-0">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </span>
            <span className="text-gray-600 font-semibold">{check}</span>
          </div>
        </div>
      );
    }

    if (typeof check === "object" && check.status) {
      // Standard CheckResult
      return (
        <div key={key} className="p-4 border-b border-gray-200 last:border-0">
          <div className="flex items-start justify-between mb-2">
            <span className="font-medium text-gray-900 capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}
            </span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(check.status)}`}>
              {getStatusIcon(check.status)} {check.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">
            {check.message}
          </p>
          {check.value !== undefined && check.value !== null && (
            <p className="text-xs text-gray-500 font-mono mt-1 break-all">
              Value: {String(check.value)}
            </p>
          )}
          {check.recommendation && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              {check.recommendation}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const checkEntries = Object.entries(checks);

  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
      <button
        onClick={() => onToggle(section)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition"
      >
        <h3 className="text-base font-semibold text-gray-900">
          {title}
        </h3>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-200">
          {checkEntries.map(([key, check]) => renderCheckItem(key, check))}
        </div>
      )}
    </div>
  );
}
