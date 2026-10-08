"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ContentValidationResult, LinkRow } from "@/lib/content-types";
import { CONTENT_KIND_LABELS } from "@/lib/content-types";
import { contentReportText } from "@/lib/content-report";
import { diffTotals, resolveRows, type DiffSegment, type ResolvedRow } from "@/lib/word-diff";

const ROW_STYLES: Record<ResolvedRow["state"], { left: string; right: string; mark: string }> = {
  same: { left: "", right: "", mark: "text-gray-700" },
  changed: {
    left: "bg-red-950/35",
    right: "bg-emerald-950/35",
    mark: "text-amber-300",
  },
  missing: {
    left: "bg-red-950/45",
    right: "bg-black/20",
    mark: "text-red-300",
  },
  added: {
    left: "bg-black/20",
    right: "bg-emerald-950/45",
    mark: "text-emerald-300",
  },
};

const MARK: Record<ResolvedRow["state"], string> = {
  same: " ",
  changed: "~",
  missing: "−",
  added: "+",
};

export default function ContentReport({ result }: { result: ContentValidationResult }) {
  const [differencesOnly, setDifferencesOnly] = useState(true);
  const [loose, setLoose] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);

  const rows = useMemo(() => resolveRows(result.rows, loose), [result.rows, loose]);
  const totals = useMemo(() => diffTotals(rows), [rows]);
  const visibleRows = differencesOnly ? rows.filter((row) => row.state !== "same") : rows;
  const linkIssues = result.links.filter((link) => link.status !== "same").length;

  const download = () => {
    const blob = new Blob([contentReportText(result, rows, totals)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "content-diff.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 border-b border-white/10 bg-[#0c121c] text-xs">
        <p className="text-gray-400 truncate max-w-[42vw]" title={result.url}>
          <span className="text-gray-200">{result.documentName}</span>
          <span className="text-gray-600"> → </span>
          {result.url}
        </p>
        <div className="flex items-center gap-3 text-gray-400">
          <Metric label="Match" value={`${totals.wordMatchPercent}%`} />
          <Metric label="Same" value={totals.same} />
          <Metric label="Changed" value={totals.changed} tone="text-amber-300" />
          <Metric label="Missing" value={totals.missing} tone="text-red-300" />
          <Metric label="Extra" value={totals.added} tone="text-emerald-300" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Toggle pressed={differencesOnly} onClick={() => setDifferencesOnly((value) => !value)}>
            Differences only
          </Toggle>
          <Toggle pressed={loose} onClick={() => setLoose((value) => !value)}>
            Ignore case
          </Toggle>
          <button
            type="button"
            onClick={download}
            className="h-7 px-2.5 rounded text-gray-300 hover:bg-white/5"
          >
            Download
          </button>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <ul className="shrink-0 px-4 py-2 text-xs text-amber-200/90 bg-amber-950/30 border-b border-amber-900/40">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        <div>
          <div className="sticky top-0 z-10 grid grid-cols-[2.25rem_1fr_1fr] bg-[#101722] border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-500">
            <div />
            <div className="px-4 py-2 border-l border-white/10">Word document</div>
            <div className="px-4 py-2 border-l border-white/10">Website</div>
          </div>

          {visibleRows.length === 0 ? (
            <p className="px-6 py-16 text-sm text-gray-500 text-center">
              {differencesOnly
                ? "No differences. The website text matches the document."
                : "No content found."}
            </p>
          ) : (
            visibleRows.map((row, index) => <DiffLine key={index} row={row} />)
          )}

          {result.links.length > 0 && (
            <section className="border-t border-white/10">
              <button
                type="button"
                onClick={() => setLinksOpen((open) => !open)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-400 hover:bg-white/[0.03]"
              >
                <span>
                  Links in the document · {result.links.length}
                  {linkIssues > 0 && <span className="text-amber-300"> · {linkIssues} not matching</span>}
                </span>
                <span>{linksOpen ? "Hide" : "Show"}</span>
              </button>
              {linksOpen && <LinksTable links={result.links} />}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function DiffLine({ row }: { row: ResolvedRow }) {
  const styles = ROW_STYLES[row.state];
  const kind = row.documentKind ?? row.pageKind;
  const kindLabel =
    row.documentKind && row.pageKind && row.documentKind !== row.pageKind
      ? `${CONTENT_KIND_LABELS[row.documentKind]} → ${CONTENT_KIND_LABELS[row.pageKind]}`
      : kind && kind !== "sentence"
        ? CONTENT_KIND_LABELS[kind]
        : "";

  return (
    <div className="grid grid-cols-[2.25rem_1fr_1fr] text-[13px] leading-6 border-b border-white/[0.04]">
      <div className={`pt-2.5 text-center font-medium select-none ${styles.mark}`} aria-hidden>
        {MARK[row.state]}
      </div>
      <div className={`px-4 py-2.5 border-l border-white/10 min-w-0 ${styles.left}`}>
        {(kindLabel || row.moved) && (
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
            {kindLabel}
            {row.moved && <span className="text-sky-300">{kindLabel ? " · " : ""}Moved</span>}
          </p>
        )}
        <Cell text={row.documentText} segments={row.diff?.left} empty="Not in the document" side="left" />
      </div>
      <div className={`px-4 py-2.5 border-l border-white/10 min-w-0 ${styles.right}`}>
        <Cell text={row.pageText} segments={row.diff?.right} empty="Not on the website" side="right" />
      </div>
    </div>
  );
}

function Cell({
  text,
  segments,
  empty,
  side,
}: {
  text?: string;
  segments?: DiffSegment[];
  empty: string;
  side: "left" | "right";
}) {
  if (!text) return <span className="text-gray-600 italic">{empty}</span>;
  if (!segments) {
    return <span className={side === "left" ? "text-red-100" : "text-emerald-100"}>{text}</span>;
  }
  const highlight =
    side === "left"
      ? "bg-red-500/25 text-red-50 rounded-sm px-0.5 line-through decoration-red-300/60"
      : "bg-emerald-500/25 text-emerald-50 rounded-sm px-0.5";
  return (
    <span className="text-gray-100">
      {segments.map((segment, index) => (
        <span key={index}>
          {index > 0 && " "}
          {segment.changed ? <mark className={highlight}>{segment.text}</mark> : segment.text}
        </span>
      ))}
    </span>
  );
}

function LinksTable({ links }: { links: LinkRow[] }) {
  const styles: Record<LinkRow["status"], string> = {
    same: "text-gray-500",
    different: "text-amber-300",
    missing: "text-red-300",
  };
  const labels: Record<LinkRow["status"], string> = {
    same: "Same",
    different: "Different URL",
    missing: "Missing",
  };

  return (
    <table className="w-full text-xs">
      <thead className="text-left text-gray-500">
        <tr>
          <th className="px-4 py-2 font-normal">Link text</th>
          <th className="px-4 py-2 font-normal">Document</th>
          <th className="px-4 py-2 font-normal">Website</th>
          <th className="px-4 py-2 font-normal">Result</th>
        </tr>
      </thead>
      <tbody>
        {links.map((link, index) => (
          <tr key={index} className="border-t border-white/[0.04] align-top">
            <td className="px-4 py-2 text-gray-200">{link.text}</td>
            <td className="px-4 py-2 text-gray-500 break-all">{link.documentHref}</td>
            <td className="px-4 py-2 text-gray-500 break-all">{link.pageHref ?? "—"}</td>
            <td className={`px-4 py-2 whitespace-nowrap ${styles[link.status]}`}>{labels[link.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Metric({
  label,
  value,
  tone = "text-gray-100",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular-nums font-medium ${tone}`}>{value}</span>
    </span>
  );
}

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-7 px-2.5 rounded ${
        pressed ? "bg-white/10 text-gray-100" : "text-gray-500 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}
