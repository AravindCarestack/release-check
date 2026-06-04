import type { PageReport } from "@/lib/page-analyzer";

export type SeoPerformanceRating = "excellent" | "good" | "fair" | "poor";
export type ActionPriority = "Critical" | "High" | "Medium" | "Low";

export interface PriorityAction {
  priority: ActionPriority;
  category: string;
  issue: string;
  impact: string;
  recommendation: string;
}

export interface AiInsightsResult {
  performanceRating: SeoPerformanceRating;
  summary: string;
  seoOutlook: string;
  criticalIssues: string[];
  highImpactOpportunities: string[];
  whatsWrong: string[];
  whatsWorking: string[];
  priorityActions: PriorityAction[];
  bestPractices: string[];
  estimatedOrganicImpact: string;
  estimatedRankingRisk: string;
}

const RATINGS: SeoPerformanceRating[] = ["excellent", "good", "fair", "poor"];
const PRIORITIES: ActionPriority[] = ["Critical", "High", "Medium", "Low"];

const CRAWL_MAX_TOKENS = 2400;
const PAGE_MAX_TOKENS = 2000;

function getGroqApiKey(): string | undefined {
  return process.env.SEO_VALIDATE_KEY ?? process.env["SEO-VALIDATE"];
}

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

function buildCrawlSummary(pages: PageReport[]): string {
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

function buildPageSummary(page: PageReport): string {
  return JSON.stringify(summarizePageSignals(page));
}

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error("SEO_VALIDATE_KEY is not configured");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from Groq");
  }
  return content;
}

function normalizeRating(value: unknown): SeoPerformanceRating {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (RATINGS.includes(lower as SeoPerformanceRating)) {
      return lower as SeoPerformanceRating;
    }
  }
  return "fair";
}

function normalizePriority(value: unknown): ActionPriority {
  if (typeof value === "string") {
    const match = PRIORITIES.find((p) => p.toLowerCase() === value.toLowerCase());
    if (match) return match;
  }
  return "Medium";
}

function toStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
}

function toNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function parsePriorityActions(value: unknown): PriorityAction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): PriorityAction | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const issue = toNonEmptyString(row.issue, "");
      const recommendation = toNonEmptyString(
        row.recommendation ?? row.action,
        ""
      );
      if (!issue && !recommendation) return null;

      return {
        priority: normalizePriority(row.priority),
        category: toNonEmptyString(row.category, "Technical SEO"),
        issue: issue || "Unspecified issue",
        impact: toNonEmptyString(row.impact, "May limit organic visibility"),
        recommendation: recommendation || "Review and fix based on audit evidence",
      };
    })
    .filter((a): a is PriorityAction => a !== null)
    .slice(0, 10);
}

function parseInsightsJson(raw: string): AiInsightsResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJsonPayload(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned invalid JSON. Try refreshing the analysis.");
  }

  const priorityActions = parsePriorityActions(parsed.priorityActions);
  const criticalIssues = toStringArray(parsed.criticalIssues, 8);
  const highImpactOpportunities = toStringArray(
    parsed.highImpactOpportunities ?? parsed.opportunities,
    8
  );
  const whatsWrong = toStringArray(
    parsed.whatsWrong ?? parsed.priorities ?? parsed.issues,
    10
  );
  const whatsWorking = toStringArray(
    parsed.whatsWorking ?? parsed.strengths,
    8
  );
  const bestPractices = toStringArray(
    parsed.bestPractices ?? parsed.recommendations,
    10
  );

  return {
    performanceRating: normalizeRating(parsed.performanceRating),
    summary: toNonEmptyString(
      parsed.summary,
      "No executive summary available from this audit."
    ),
    seoOutlook: toNonEmptyString(
      parsed.seoOutlook ?? parsed.outlook,
      "Outlook unavailable — review priority actions below."
    ),
    criticalIssues,
    highImpactOpportunities,
    whatsWrong,
    whatsWorking,
    priorityActions,
    bestPractices,
    estimatedOrganicImpact: toNonEmptyString(
      parsed.estimatedOrganicImpact ?? parsed.organicImpact,
      "Impact assessment unavailable."
    ),
    estimatedRankingRisk: toNonEmptyString(
      parsed.estimatedRankingRisk ?? parsed.rankingRisk,
      "Ranking risk assessment unavailable."
    ),
  };
}

const JSON_OUTPUT_SCHEMA = `{
  "performanceRating": "excellent" | "good" | "fair" | "poor",
  "summary": "2-3 sentences: executive summary for a client — current organic health and biggest blocker",
  "seoOutlook": "2-3 sentences: 90-day search visibility outlook (indexing, rankings, CTR, rich results) based ONLY on audit evidence",
  "criticalIssues": ["2-5 issues that actively block or severely limit organic growth — cite counts/URLs from data"],
  "highImpactOpportunities": ["2-5 growth levers (not just bugs) — ranking/CTR upside tied to patterns in the crawl"],
  "whatsWrong": ["3-6 factual problems from the audit — include WHY each hurts (indexing, snippets, trust, crawl waste)"],
  "whatsWorking": ["2-4 strengths already supporting SEO"],
  "priorityActions": [
    {
      "priority": "Critical" | "High" | "Medium" | "Low",
      "category": "Technical SEO | Content SEO | Search Visibility | Internationalization | Performance",
      "issue": "specific problem from audit",
      "impact": "business/search impact in plain language",
      "recommendation": "specific, implementable fix — no generic advice"
    }
  ],
  "bestPractices": ["3-5 Google-aligned standards to apply next — each tied to a gap found in THIS crawl"],
  "estimatedOrganicImpact": "1-2 sentences: realistic upside if top priorities are fixed (traffic/indexing/CTR framing)",
  "estimatedRankingRisk": "1-2 sentences: what happens if critical issues remain (use noindex/canonical/schema/snippet risks from data)"
}`;

const CRAWL_SYSTEM_PROMPT = `You are a Senior Technical SEO Consultant and Search Strategist delivering a multi-page site audit to a marketing leader.

Think like an agency: separate technical blockers from growth opportunities, prioritize by business impact, and explain WHY — not checklist regurgitation.

Analyze ONLY the JSON audit payload. You may infer content-depth and intent alignment ONLY from proxies provided (heading counts, title/H1 alignment, snippet lengths) — do NOT invent word counts, rankings, traffic, or competitor data.

${JSON_OUTPUT_SCHEMA}

Crawl-specific rules:
- Surface recurring patterns (e.g. "missing meta description on 14/20 pages") with exact counts from technicalPatterns
- Distinguish Critical (indexing blocked, noindex, broken canonicals) vs High (snippet/CTR/schema) vs Medium/Low
- pagesAtRisk = urgent remediation; pagesWithUpside = quick wins or scale opportunities
- priorityActions: 5-8 items, sorted Critical→Low; first 2-3 should be highest ROI fixes
- highImpactOpportunities = growth plays (rich results, CTR, content structure), not duplicate criticalIssues
- Quick wins: call out in highImpactOpportunities or Medium priorityActions when fix is low effort
- Long-term: content depth / topical expansion only when thinStructurePageCount or contentDepthProxy supports it
- If hreflang/internationalization data exists, address in dedicated actions
- Never cite URLs or counts not present in the payload`;

const PAGE_SYSTEM_PROMPT = `You are a Senior Technical SEO Consultant analyzing ONE URL for a client-ready page brief.

Deliver strategic guidance: ranking potential vs technical debt, CTR/snippet quality, rich-result eligibility, and indexability — using ONLY the audit JSON.

${JSON_OUTPUT_SCHEMA}

Page-specific rules:
- Reference title/description length fields in snippets when commenting on CTR
- Use titleH1Alignment and contentDepthProxy for content SEO commentary — flag misalignment or thin structure as content gaps, not invented keywords
- Treat noindex or missing canonical as Critical if present in indexability
- highImpactOpportunities = upside on THIS page (schema types to add, OG completion, heading expansion)
- priorityActions: 4-6 items for this URL only
- estimatedOrganicImpact / estimatedRankingRisk must reference actual gaps on this page
- Do not invent analytics, backlinks, or search volume`;

export async function generateCrawlInsights(
  pages: PageReport[]
): Promise<AiInsightsResult> {
  if (pages.length === 0) {
    throw new Error("No pages provided for crawl insights");
  }
  const raw = await callGroq(
    CRAWL_SYSTEM_PROMPT,
    `Multi-page technical SEO audit payload (use exact counts and URLs):\n${buildCrawlSummary(pages)}`,
    CRAWL_MAX_TOKENS
  );
  return parseInsightsJson(raw);
}

export async function generatePageInsights(page: PageReport): Promise<AiInsightsResult> {
  const raw = await callGroq(
    PAGE_SYSTEM_PROMPT,
    `Single-page technical SEO audit payload:\n${buildPageSummary(page)}`,
    PAGE_MAX_TOKENS
  );
  return parseInsightsJson(raw);
}

export function isAiInsightsConfigured(): boolean {
  return !!getGroqApiKey();
}

export const PERFORMANCE_RATING_LABELS: Record<SeoPerformanceRating, string> = {
  excellent: "Excellent SEO outlook",
  good: "Good SEO outlook",
  fair: "Fair — needs improvement",
  poor: "Poor — high ranking risk",
};

export const PERFORMANCE_RATING_STYLES: Record<
  SeoPerformanceRating,
  { badge: string; border: string }
> = {
  excellent: { badge: "bg-green-100 text-green-800 border-green-200", border: "border-green-200" },
  good: { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", border: "border-emerald-200" },
  fair: { badge: "bg-amber-100 text-amber-800 border-amber-200", border: "border-amber-200" },
  poor: { badge: "bg-red-100 text-red-800 border-red-200", border: "border-red-200" },
};

export const ACTION_PRIORITY_STYLES: Record<
  ActionPriority,
  { badge: string; dot: string }
> = {
  Critical: { badge: "bg-red-100 text-red-800 border-red-200", dot: "bg-red-500" },
  High: { badge: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  Medium: { badge: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  Low: { badge: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
};
