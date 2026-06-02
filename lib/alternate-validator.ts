/**
 * Validates hreflang alternate links between HTML pages and sitemap entries.
 */

export interface AlternateLink {
  hreflang: string;
  href: string;
}

export interface AlternateValidationResult {
  status: "pass" | "warn" | "fail" | "skip";
  issues: string[];
  missingInPage: AlternateLink[];
  missingInSitemap: AlternateLink[];
  mismatched: Array<{ hreflang: string; pageHref: string; sitemapHref: string }>;
}

export interface SitemapUrlWithAlternates {
  loc: string;
  alternates: AlternateLink[];
}

const HREFLANG_NONE = "(none)";

/** Normalize URL for alternate comparison (host, path, protocol; strip hash; keep search). */
export function normalizeAlternateUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    let path = u.pathname.replace(/\/+/g, "/");
    if (path !== "/" && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    if (!path) path = "/";
    const search = u.search;
    return `${u.protocol}//${host}${path}${search}`.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeHreflang(hreflang: string | undefined | null): string {
  const raw = (hreflang ?? "").trim().toLowerCase();
  return raw || HREFLANG_NONE;
}

/** Build a map keyed by normalized hreflang for O(1) lookup. */
function alternatesToMap(
  alternates: AlternateLink[],
  baseUrl?: string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const alt of alternates) {
    const lang = normalizeHreflang(alt.hreflang);
    let href = alt.href.trim();
    if (baseUrl) {
      try {
        href = new URL(href, baseUrl).href;
      } catch {
        continue;
      }
    }
    const normalized = normalizeAlternateUrl(href);
    if (normalized) {
      map.set(lang, normalized);
    }
  }
  return map;
}

/**
 * Compare page alternates vs sitemap alternates for a single URL.
 */
export function validatePageAlternates(
  pageUrl: string,
  pageAlternates: AlternateLink[],
  sitemapAlternates: AlternateLink[] | undefined
): AlternateValidationResult {
  const issues: string[] = [];
  const missingInPage: AlternateLink[] = [];
  const missingInSitemap: AlternateLink[] = [];
  const mismatched: AlternateValidationResult["mismatched"] = [];

  const pageMap = alternatesToMap(pageAlternates, pageUrl);
  const sitemapMap = alternatesToMap(sitemapAlternates ?? [], pageUrl);

  if (sitemapAlternates === undefined) {
    return {
      status: "skip",
      issues: ["Page URL not found in sitemap"],
      missingInPage: [],
      missingInSitemap: [],
      mismatched: [],
    };
  }

  const hasPageAlts = pageMap.size > 0;
  const hasSitemapAlts = sitemapMap.size > 0;

  if (!hasPageAlts && !hasSitemapAlts) {
    return {
      status: "pass",
      issues: [],
      missingInPage: [],
      missingInSitemap: [],
      mismatched: [],
    };
  }

  if (!hasPageAlts && hasSitemapAlts) {
    issues.push("Page has no alternate links but sitemap declares hreflang alternates");
    for (const [lang, href] of sitemapMap) {
      missingInPage.push({
        hreflang: lang === HREFLANG_NONE ? "" : lang,
        href,
      });
    }
    return {
      status: "fail",
      issues,
      missingInPage,
      missingInSitemap: [],
      mismatched: [],
    };
  }

  if (hasPageAlts && !hasSitemapAlts) {
    issues.push("Page has alternate links but sitemap entry has none");
    for (const [lang, href] of pageMap) {
      missingInSitemap.push({
        hreflang: lang === HREFLANG_NONE ? "" : lang,
        href,
      });
    }
    return {
      status: "warn",
      issues,
      missingInPage: [],
      missingInSitemap,
      mismatched: [],
    };
  }

  const allLangs = new Set([...pageMap.keys(), ...sitemapMap.keys()]);

  for (const lang of allLangs) {
    const pageHref = pageMap.get(lang);
    const sitemapHref = sitemapMap.get(lang);

    if (pageHref && !sitemapHref) {
      issues.push(`Alternate "${lang}" on page but missing in sitemap`);
      missingInSitemap.push({
        hreflang: lang === HREFLANG_NONE ? "" : lang,
        href: pageAlternates.find((a) => normalizeHreflang(a.hreflang) === lang)?.href ?? pageHref,
      });
    } else if (!pageHref && sitemapHref) {
      issues.push(`Alternate "${lang}" in sitemap but missing on page`);
      missingInPage.push({
        hreflang: lang === HREFLANG_NONE ? "" : lang,
        href: sitemapAlternates.find((a) => normalizeHreflang(a.hreflang) === lang)?.href ?? sitemapHref,
      });
    } else if (pageHref && sitemapHref && pageHref !== sitemapHref) {
      issues.push(`Alternate "${lang}" URL mismatch between page and sitemap`);
      mismatched.push({
        hreflang: lang === HREFLANG_NONE ? "" : lang,
        pageHref,
        sitemapHref,
      });
    }
  }

  // Warn when rel=alternate exists without hreflang on page
  const pageWithoutHreflang = pageAlternates.filter(
    (a) => !a.hreflang || a.hreflang.trim() === ""
  );
  if (pageWithoutHreflang.length > 0) {
    issues.push(
      `${pageWithoutHreflang.length} page alternate link(s) missing hreflang attribute`
    );
  }

  // Self-reference: page URL should appear for its own hreflang when alternates exist
  const pageNorm = normalizeAlternateUrl(pageUrl);
  if (pageNorm && pageMap.size > 1) {
    const selfInPage = [...pageMap.values()].some((h) => h === pageNorm);
    const selfInSitemap = [...sitemapMap.values()].some((h) => h === pageNorm);
    if (!selfInPage) {
      issues.push("Page alternates do not include a self-referencing URL");
    }
    if (!selfInSitemap && sitemapMap.size > 1) {
      issues.push("Sitemap alternates do not include a self-referencing URL for this page");
    }
  }

  let status: AlternateValidationResult["status"] = "pass";
  if (mismatched.length > 0 || missingInPage.length > 0) {
    status = "fail";
  } else if (missingInSitemap.length > 0 || issues.some((i) => i.includes("missing hreflang"))) {
    status = "warn";
  }

  return {
    status,
    issues,
    missingInPage,
    missingInSitemap,
    mismatched,
  };
}

/** Index sitemap entries by normalized loc for fast lookup. */
export function buildSitemapAlternateIndex(
  entries: SitemapUrlWithAlternates[]
): Map<string, AlternateLink[]> {
  const index = new Map<string, AlternateLink[]>();
  for (const entry of entries) {
    const key = normalizeAlternateUrl(entry.loc);
    if (key) {
      index.set(key, entry.alternates);
    }
  }
  return index;
}

export function hasAlternateIssue(result: AlternateValidationResult | undefined): boolean {
  if (!result) return false;
  return result.status === "fail" || result.status === "warn";
}

export interface ValidateAllAlternatesInput {
  pages: Array<{ url: string; alternates: AlternateLink[] }>;
  sitemapEntries: SitemapUrlWithAlternates[];
}

export function validateAllAlternates(
  input: ValidateAllAlternatesInput
): Map<string, AlternateValidationResult> {
  const index = buildSitemapAlternateIndex(input.sitemapEntries);
  const results = new Map<string, AlternateValidationResult>();

  for (const page of input.pages) {
    const key = normalizeAlternateUrl(page.url);
    const sitemapAlts = key ? index.get(key) : undefined;
    const result = validatePageAlternates(
      page.url,
      page.alternates,
      key && index.has(key) ? sitemapAlts ?? [] : undefined
    );
    results.set(page.url, result);
  }

  return results;
}
