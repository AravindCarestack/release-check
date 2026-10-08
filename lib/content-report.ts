import type { ContentValidationResult } from "@/lib/content-types";
import { CONTENT_KIND_LABELS } from "@/lib/content-types";
import type { DiffTotals, ResolvedRow } from "@/lib/word-diff";

const STATE_LABELS: Record<ResolvedRow["state"], string> = {
  same: "SAME",
  changed: "CHANGED",
  missing: "MISSING ON WEBSITE",
  added: "ONLY ON WEBSITE",
};

export function contentReportText(
  result: ContentValidationResult,
  rows: ResolvedRow[],
  totals: DiffTotals
): string {
  const lines = [
    `Content diff: ${result.url}`,
    `Document: ${result.documentName}`,
    `Word match: ${totals.wordMatchPercent}%`,
    `Same: ${totals.same}  Changed: ${totals.changed}  Missing on website: ${totals.missing}  Only on website: ${totals.added}`,
    "",
  ];

  rows
    .filter((row) => row.state !== "same")
    .forEach((row) => {
      const kind = CONTENT_KIND_LABELS[row.documentKind ?? row.pageKind ?? "sentence"];
      lines.push(`[${STATE_LABELS[row.state]}] ${kind}${row.moved ? " (different position)" : ""}`);
      if (row.documentText) lines.push(`  Document: ${row.documentText}`);
      if (row.pageText) lines.push(`  Website:  ${row.pageText}`);
      lines.push("");
    });

  const linkIssues = result.links.filter((link) => link.status !== "same");
  if (linkIssues.length > 0) {
    lines.push("Links:");
    linkIssues.forEach((link) => {
      lines.push(`- ${link.text}`);
      lines.push(`  Document: ${link.documentHref ?? ""}`);
      lines.push(`  Website:  ${link.pageHref ?? "Not found"}`);
    });
    lines.push("");
  }

  result.warnings.forEach((warning) => lines.push(`Note: ${warning}`));
  return lines.join("\n");
}
