import type { ContentKind, ContentUnit, DiffRow, LinkRow } from "@/lib/content-types";

const PAIR_SCORE = 0.55;
const LINK_TEXT_SCORE = 0.8;

export function compareContent(
  documentUnits: ContentUnit[],
  pageUnits: ContentUnit[]
): { rows: DiffRow[]; links: LinkRow[] } {
  return {
    rows: diffRows(documentUnits.filter(isTextBlock), pageUnits.filter(isTextBlock)),
    links: diffLinks(
      documentUnits.filter((unit) => unit.kind === "link" && unit.href),
      pageUnits.filter((unit) => unit.kind === "link")
    ),
  };
}

function diffRows(docUnits: ContentUnit[], pageUnits: ContentUnit[]): DiffRow[] {
  const pairs = assign(docUnits, pageUnits, (doc, page) => similarity(doc.normalized, page.normalized), PAIR_SCORE);
  const matchedPages = new Set([...pairs.values()].map((pair) => pair.pageIndex));
  const rows: DiffRow[] = [];
  let nextPage = 0;

  const flushAddedBefore = (limit: number) => {
    while (nextPage < limit) {
      if (!matchedPages.has(nextPage)) {
        const page = pageUnits[nextPage];
        rows.push({ status: "added", pageKind: page.kind, pageText: page.text });
      }
      nextPage += 1;
    }
  };

  docUnits.forEach((doc, docIndex) => {
    const pair = pairs.get(docIndex);
    if (!pair) {
      rows.push({ status: "missing", documentKind: doc.kind, documentText: doc.text });
      return;
    }
    const moved = pair.pageIndex < nextPage;
    if (!moved) flushAddedBefore(pair.pageIndex);
    const page = pageUnits[pair.pageIndex];
    rows.push({
      status: "paired",
      documentKind: doc.kind,
      pageKind: page.kind,
      documentText: doc.text,
      pageText: page.text,
      moved: moved || undefined,
    });
    if (!moved) nextPage = pair.pageIndex + 1;
  });

  flushAddedBefore(pageUnits.length);
  return rows;
}

function diffLinks(docLinks: ContentUnit[], pageLinks: ContentUnit[]): LinkRow[] {
  const pairs = assign(
    docLinks,
    pageLinks,
    (doc, page) => {
      const text = similarity(doc.normalized, page.normalized);
      const sameHref = !!(doc.href && page.href && hrefKey(doc.href) === hrefKey(page.href));
      return sameHref ? Math.max(text, 0.85) + 0.1 : text;
    },
    LINK_TEXT_SCORE
  );

  return docLinks.map((doc, index): LinkRow => {
    const pair = pairs.get(index);
    if (!pair) return { text: doc.text, documentHref: doc.href, status: "missing" };
    const page = pageLinks[pair.pageIndex];
    const same = !!(doc.href && page.href && hrefKey(doc.href) === hrefKey(page.href));
    return {
      text: doc.text,
      pageText: page.text,
      documentHref: doc.href,
      pageHref: page.href,
      status: same ? "same" : "different",
    };
  });
}

function isTextBlock(unit: ContentUnit): boolean {
  const kind: ContentKind = unit.kind;
  if (kind === "link" || kind === "button") return !!unit.standalone;
  return kind !== "image";
}

interface Assigned {
  pageIndex: number;
  score: number;
}

function assign(
  docUnits: ContentUnit[],
  pageUnits: ContentUnit[],
  scoreFn: (doc: ContentUnit, page: ContentUnit) => number,
  minScore: number
): Map<number, Assigned> {
  const candidates: Array<Assigned & { docIndex: number }> = [];
  for (let docIndex = 0; docIndex < docUnits.length; docIndex += 1) {
    for (let pageIndex = 0; pageIndex < pageUnits.length; pageIndex += 1) {
      const score = scoreFn(docUnits[docIndex], pageUnits[pageIndex]);
      if (score >= minScore) candidates.push({ docIndex, pageIndex, score });
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      Math.abs(a.docIndex - a.pageIndex) - Math.abs(b.docIndex - b.pageIndex)
  );
  const usedDoc = new Set<number>();
  const usedPage = new Set<number>();
  const assigned = new Map<number, Assigned>();
  for (const candidate of candidates) {
    if (usedDoc.has(candidate.docIndex) || usedPage.has(candidate.pageIndex)) continue;
    usedDoc.add(candidate.docIndex);
    usedPage.add(candidate.pageIndex);
    assigned.set(candidate.docIndex, { pageIndex: candidate.pageIndex, score: candidate.score });
  }
  return assigned;
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const left = a.split(" ").filter(Boolean).slice(0, 120);
  const right = b.split(" ").filter(Boolean).slice(0, 120);
  if (left.length === 0 || right.length === 0) return 0;

  const counts = new Map<string, number>();
  for (const token of right) counts.set(token, (counts.get(token) ?? 0) + 1);
  let shared = 0;
  for (const token of left) {
    const count = counts.get(token) ?? 0;
    if (count > 0) {
      shared += 1;
      counts.set(token, count - 1);
    }
  }
  if (shared === 0) return 0;

  const order = lcsLength(left, right);
  return (2 * order) / (left.length + right.length);
}

function lcsLength(left: string[], right: string[]): number {
  let previous = new Array<number>(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    const current = new Array<number>(right.length + 1).fill(0);
    for (let j = 1; j <= right.length; j += 1) {
      current[j] =
        left[i - 1] === right[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[right.length];
}

function hrefKey(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol === "mailto:" || url.protocol === "tel:") return href.toLowerCase();
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = (url.pathname.replace(/\/$/, "") || "/").toLowerCase();
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !/^(utm_|fbclid$|gclid$|mc_|ref$)/i.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    const query = params.map(([key, value]) => `${key}=${value}`).join("&");
    return query ? `${host}${path}?${query}` : `${host}${path}`;
  } catch {
    return href.trim().toLowerCase();
  }
}
