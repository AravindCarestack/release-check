import type { DiffRow } from "@/lib/content-types";

export interface DiffSegment {
  text: string;
  changed: boolean;
}

export interface WordDiff {
  left: DiffSegment[];
  right: DiffSegment[];
  sameWords: number;
  documentWords: number;
  identical: boolean;
}

export type RowState = "same" | "changed" | "missing" | "added";

export interface ResolvedRow extends DiffRow {
  state: RowState;
  diff?: WordDiff;
}

export interface DiffTotals {
  same: number;
  changed: number;
  missing: number;
  added: number;
  wordMatchPercent: number;
}

export function resolveRows(rows: DiffRow[], loose: boolean): ResolvedRow[] {
  return rows.map((row) => {
    if (row.status === "missing") return { ...row, state: "missing" };
    if (row.status === "added") return { ...row, state: "added" };
    const diff = diffWords(row.documentText ?? "", row.pageText ?? "", loose);
    return { ...row, diff, state: diff.identical ? "same" : "changed" };
  });
}

export function diffTotals(rows: ResolvedRow[]): DiffTotals {
  let sameWords = 0;
  let documentWords = 0;
  const totals = { same: 0, changed: 0, missing: 0, added: 0 };
  for (const row of rows) {
    totals[row.state] += 1;
    if (row.diff) {
      sameWords += row.diff.sameWords;
      documentWords += row.diff.documentWords;
    } else if (row.state === "missing") {
      documentWords += tokenize(row.documentText ?? "").length;
    }
  }
  return {
    ...totals,
    wordMatchPercent: documentWords === 0 ? 0 : Math.round((sameWords / documentWords) * 100),
  };
}

export function diffWords(documentText: string, pageText: string, loose: boolean): WordDiff {
  const left = tokenize(documentText);
  const right = tokenize(pageText);
  const leftKeys = left.map((word) => wordKey(word, loose));
  const rightKeys = right.map((word) => wordKey(word, loose));

  const rows = left.length;
  const cols = right.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(cols + 1).fill(0));
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] =
        leftKeys[i] === rightKeys[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const leftMarks: boolean[] = new Array(rows).fill(true);
  const rightMarks: boolean[] = new Array(cols).fill(true);
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (leftKeys[i] === rightKeys[j]) {
      leftMarks[i] = false;
      rightMarks[j] = false;
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  const sameWords = table[0][0];
  return {
    left: segments(left, leftMarks),
    right: segments(right, rightMarks),
    sameWords,
    documentWords: rows,
    identical: sameWords === rows && sameWords === cols,
  };
}

function segments(words: string[], changed: boolean[]): DiffSegment[] {
  const result: DiffSegment[] = [];
  words.forEach((word, index) => {
    const last = result[result.length - 1];
    if (last && last.changed === changed[index]) {
      last.text += ` ${word}`;
    } else {
      result.push({ text: word, changed: changed[index] });
    }
  });
  return result;
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function wordKey(word: string, loose: boolean): string {
  const unified = word
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ");
  if (!loose) return unified;
  return unified.toLowerCase().replace(/[.,!?;:"'`()[\]{}]/g, "");
}
