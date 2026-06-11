import type { PageReport } from "@/lib/page-analyzer";

function hasNoindex(robots: string | null): boolean {
  return !!robots && robots.toLowerCase().includes("noindex");
}

function toNumericMetric(value: string | number | boolean | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function titleLengthSignals(title: string | null) {
  const len = title?.length ?? 0;
  return {
    length: len,
    present: !!title,
    tooShort: len > 0 && len < 30,
    tooLong: len > 60,
    optimal: len >= 30 && len <= 60,
  };
}

function descriptionLengthSignals(description: string | null) {
  const len = description?.length ?? 0;
  return {
    length: len,
    present: !!description,
    tooShort: len > 0 && len < 120,
    tooLong: len > 160,
    optimal: len >= 120 && len <= 160,
  };
}

function headingDepthScore(counts: PageReport["headingCounts"]): number {
  return counts.h2 + counts.h3 + counts.h4 + counts.h5 + counts.h6;
}

function titleH1Alignment(title: string | null, h1Texts: string[]): string | null {
  if (!title || h1Texts.length === 0) return null;
  const normalizedTitle = title.trim().toLowerCase();
  const h1 = h1Texts[0]?.trim().toLowerCase();
  if (!h1) return null;
  if (normalizedTitle === h1) return "aligned";
  if (normalizedTitle.includes(h1) || h1.includes(normalizedTitle)) return "partial";
  return "misaligned";
}

function summarizePageSignals(page: PageReport) {
  const title = titleLengthSignals(page.meta.title);
  const description = descriptionLengthSignals(page.meta.description);
  const totalSubheadings = headingDepthScore(page.headingCounts);
  const ogComplete = !!(page.og.title && page.og.description && page.og.image);
  const twitterComplete = !!(page.twitter.card && page.twitter.title);

  return {
    url: page.url,
    auditStatus: page.status,
    issueCount: page.issues.length,
    detectedIssues: page.issues,
    indexability: {
      robots: page.meta.robots,
      noindex: hasNoindex(page.meta.robots),
      canonical: page.meta.canonical ? "present" : "missing",
      canonicalUrl: page.meta.canonical,
    },
    snippets: {
      title,
      description,
      keywordsMeta: page.meta.keywords ? "present" : "missing",
    },
    headings: {
      h1Count: page.h1Count,
      hasSingleH1: page.hasSingleH1,
      h1Preview: page.h1Texts.slice(0, 2),
      subheadingCounts: page.headingCounts,
      contentDepthProxy: totalSubheadings >= 3 ? "moderate" : totalSubheadings > 0 ? "thin" : "very-thin",
      titleH1Alignment: titleH1Alignment(page.meta.title, page.h1Texts),
    },
    structuredData: {
      present: page.jsonLd.present,
      valid: page.jsonLd.valid,
      count: page.jsonLd.count,
      types: page.jsonLd.types.slice(0, 6),
      errors: page.jsonLd.errors.slice(0, 3),
    },
    socialSharing: {
      openGraphComplete: ogComplete,
      twitterComplete,
      missingOg: [!page.og.title && "og:title", !page.og.description && "og:description", !page.og.image && "og:image"].filter(Boolean),
      missingTwitter: [!page.twitter.card && "twitter:card", !page.twitter.title && "twitter:title"].filter(Boolean),
    },
    internationalization: {
      hreflangCount: page.alternates?.length ?? 0,
      hasHreflang: (page.alternates?.length ?? 0) > 0,
    },
    performance: page.performance
      ? (() => {
          const loadMs = toNumericMetric(page.performance.pageLoadTime?.value);
          const sizeMb = toNumericMetric(page.performance.totalPageSize?.value);
          return {
            loadMs,
            sizeMb,
            slowPage: loadMs !== null && loadMs > 3000,
            heavyPage: sizeMb !== null && sizeMb > 3,
          };
        })()
      : null,
    sitemapLink: page.sitemap.present,
  };
}

function buildIssueFrequency(pages: PageReport[]): Array<{ issue: string; pages: number }> {
  const issueCounts = new Map<string, number>();
  for (const page of pages) {
    for (const issue of page.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }
  return [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([issue, count]) => ({ issue, pages: count }));
}

export function buildCrawlSummary(pages: PageReport[]): string {
  const passed = pages.filter((p) => p.status === "pass").length;
  const warned = pages.filter((p) => p.status === "warn").length;
  const failed = pages.filter((p) => p.status === "fail").length;

  const noindexPages = pages.filter((p) => hasNoindex(p.meta.robots));
  const missingCanonical = pages.filter((p) => !p.meta.canonical);
  const missingTitle = pages.filter((p) => !p.meta.title);
  const missingDesc = pages.filter((p) => !p.meta.description);
  const h1Problems = pages.filter((p) => !p.hasSingleH1);
  const noJsonLd = pages.filter((p) => !p.jsonLd.present);
  const invalidJsonLd = pages.filter((p) => p.jsonLd.present && !p.jsonLd.valid);
  const incompleteOg = pages.filter((p) => !p.og.title || !p.og.description || !p.og.image);
  const incompleteTwitter = pages.filter((p) => !p.twitter.card || !p.twitter.title);
  const withHreflang = pages.filter((p) => (p.alternates?.length ?? 0) > 0);
  const thinContentProxy = pages.filter((p) => headingDepthScore(p.headingCounts) < 2);

  const titleTooShort = pages.filter((p) => {
    const len = p.meta.title?.length ?? 0;
    return len > 0 && len < 30;
  }).length;
  const titleTooLong = pages.filter((p) => (p.meta.title?.length ?? 0) > 60).length;
  const descSuboptimal = pages.filter((p) => {
    const len = p.meta.description?.length ?? 0;
    return len === 0 || len < 120 || len > 160;
  }).length;

  const slowPages = pages.filter((p) => {
    const loadMs = toNumericMetric(p.performance?.pageLoadTime?.value);
    return loadMs !== null && loadMs > 3000;
  });

  const atRiskPages = pages
    .filter(
      (p) =>
        p.status === "fail" ||
        hasNoindex(p.meta.robots) ||
        p.issues.length >= 3
    )
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 10)
    .map((p) => ({
      url: p.url,
      status: p.status,
      issues: p.issues.slice(0, 5),
      noindex: hasNoindex(p.meta.robots),
    }));

  const upsidePages = pages
    .filter(
      (p) =>
        p.status !== "fail" &&
        !hasNoindex(p.meta.robots) &&
        (p.jsonLd.present ||
          (p.meta.title && p.meta.description && p.hasSingleH1))
    )
    .filter(
      (p) =>
        !p.jsonLd.present ||
        !p.og.image ||
        headingDepthScore(p.headingCounts) < 3
    )
    .slice(0, 8)
    .map((p) => ({
      url: p.url,
      status: p.status,
      opportunities: [
        !p.jsonLd.present && "add-valid-schema",
        (!p.og.image || !p.og.description) && "complete-og-snippet",
        headingDepthScore(p.headingCounts) < 3 && "deepen-content-structure",
      ].filter(Boolean),
    }));

  const payload = {
    crawlScope: {
      totalPages: pages.length,
      healthDistribution: { passed, warned, failed },
      passRatePct: pages.length ? Math.round((passed / pages.length) * 100) : 0,
    },
    technicalPatterns: {
      recurringIssues: buildIssueFrequency(pages),
      noindexPageCount: noindexPages.length,
      missingCanonicalCount: missingCanonical.length,
      missingTitleCount: missingTitle.length,
      missingDescriptionCount: missingDesc.length,
      h1ProblemCount: h1Problems.length,
      noJsonLdCount: noJsonLd.length,
      invalidJsonLdCount: invalidJsonLd.length,
      incompleteOgCount: incompleteOg.length,
      incompleteTwitterCount: incompleteTwitter.length,
      hreflangPageCount: withHreflang.length,
      thinStructurePageCount: thinContentProxy.length,
      snippetQuality: {
        titleTooShort,
        titleTooLong,
        suboptimalDescriptions: descSuboptimal,
      },
      performance: {
        slowPageCount: slowPages.length,
        slowestUrls: slowPages
          .sort((a, b) => {
            const bLoad = toNumericMetric(b.performance?.pageLoadTime?.value) ?? 0;
            const aLoad = toNumericMetric(a.performance?.pageLoadTime?.value) ?? 0;
            return bLoad - aLoad;
          })
          .slice(0, 5)
          .map((p) => ({
            url: p.url,
            loadMs: toNumericMetric(p.performance?.pageLoadTime?.value),
          })),
      },
    },
    strategicSignals: {
      indexingRisk: noindexPages.length > 0,
      sitewideSnippetWeakness: missingTitle.length + missingDesc.length > pages.length * 0.25,
      schemaGap: noJsonLd.length > pages.length * 0.4,
      socialSnippetGap: incompleteOg.length > pages.length * 0.3,
      internationalizationPresent: withHreflang.length > 0,
    },
    pagesAtRisk: atRiskPages,
    pagesWithUpside: upsidePages,
    samplePageAudits: pages.slice(0, 6).map(summarizePageSignals),
  };

  return JSON.stringify(payload);
}

export function buildPageSummary(page: PageReport): string {
  return JSON.stringify(summarizePageSignals(page));
}
