import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import type { ContentKind, ContentUnit } from "@/lib/content-types";

const MAX_UNITS = 800;
const TEXT_CONTAINERS = "p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote";

export function normalizeContent(text: string): string {
  return text
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/[.,!?;:"'`()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractContentFromHtml(
  html: string,
  baseUrl?: string
): { units: ContentUnit[]; truncated: boolean } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, canvas, template").remove();
  $(
    "nav, footer, aside, [role='navigation'], [role='contentinfo'], #cookie-banner, #cookieBanner, .cookie-banner, .cookie-consent, #onetrust-banner-sdk"
  ).remove();

  const main = $("main, article, [role='main']").first();
  const mainText = collapse(main.text());
  const scope = main.length > 0 && mainText.length > 250 ? main : $("body");

  const units: ContentUnit[] = [];
  let truncated = false;

  const push = (
    kind: ContentKind,
    text: string,
    extra?: { href?: string; level?: number; standalone?: boolean }
  ) => {
    const cleaned = collapse(text);
    if (cleaned.length < 2) return;
    if (units.length >= MAX_UNITS) {
      truncated = true;
      return;
    }
    units.push({
      index: units.length,
      kind,
      text: cleaned.slice(0, 700),
      normalized: normalizeContent(cleaned).slice(0, 700),
      ...extra,
    });
  };

  scope
    .find(`${TEXT_CONTAINERS}, a[href], button, input[type='submit'], input[type='button'], img[alt]`)
    .each((_, node) => {
      if (!isTag(node)) return;
      const tag = node.name.toLowerCase();
      const $node = $(node);

      if (tag === "a") {
        const text = collapse($node.text());
        if (text.length > 220) return;
        push("link", text, {
          href: resolveHref($node.attr("href"), baseUrl),
          standalone: $node.closest(TEXT_CONTAINERS).length === 0,
        });
        return;
      }

      if (tag === "button" || tag === "input") {
        if ($node.closest("a").length > 0) return;
        const text = tag === "input" ? $node.attr("value") || "" : $node.text();
        push("button", text, { standalone: $node.closest(TEXT_CONTAINERS).length === 0 });
        return;
      }

      if (tag === "img") {
        push("image", $node.attr("alt") || "");
        return;
      }

      if (
        (tag === "p" || /^h[1-6]$/.test(tag) || tag === "blockquote") &&
        $node.parents("li, td, th, blockquote").length > 0
      ) {
        return;
      }

      const text = ownText($, node);
      if (/^h[1-6]$/.test(tag)) {
        push("heading", text, { level: Number(tag.slice(1)) });
        return;
      }

      const kind: ContentKind =
        tag === "li" ? "list-item" : tag === "td" || tag === "th" ? "table-cell" : "sentence";
      for (const sentence of splitSentences(text)) {
        push(kind, sentence);
      }
    });

  return {
    units: units.filter((unit) => unit.normalized.length > 0),
    truncated,
  };
}

function ownText($: cheerio.CheerioAPI, node: Element): string {
  const clone = $(node).clone();
  clone.find("ul, ol, table").remove();
  return collapse(clone.text());
}

function splitSentences(text: string): string[] {
  const cleaned = collapse(text);
  if (!cleaned) return [];
  if (cleaned.length <= 90) return [cleaned];
  const parts = cleaned
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'\u201C])/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [cleaned];
}

function resolveHref(href: string | undefined, baseUrl?: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) {
    return undefined;
  }
  if (trimmed.startsWith("mailto:") || trimmed.startsWith("tel:")) return trimmed;
  try {
    if (baseUrl) return new URL(trimmed, baseUrl).href;
    if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed).href;
  } catch {
    return undefined;
  }
  return undefined;
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isTag(node: unknown): node is Element {
  return !!node && typeof node === "object" && (node as { type?: string }).type === "tag";
}
