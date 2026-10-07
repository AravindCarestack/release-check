const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_TIMEOUT_MS = 60000;

/** Chrome UX Report categories, matching the PageSpeed Insights API demo. */
export interface CruxMetrics {
  "First Contentful Paint": string | null;
  "Interaction to Next Paint": string | null;
}

/** Lighthouse lab display values, matching the PageSpeed Insights API demo. */
export interface LighthouseMetrics {
  "First Contentful Paint": string | null;
  "Speed Index": string | null;
  "Largest Contentful Paint": string | null;
  "Total Blocking Time": string | null;
  "Time To Interactive": string | null;
}

export interface PageSpeedMeasurement {
  /** `id` from the PageSpeed response, usually the final tested URL. */
  id: string;
  testedUrl: string;
  strategy: "mobile";
  reportUrl: string;
  crux: CruxMetrics;
  lighthouseMetrics: LighthouseMetrics;
  /** Lighthouse performance score, 0–100. */
  lighthouseScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  fcpMs: number | null;
  tbtMs: number | null;
  ttfbMs: number | null;
  speedIndexMs: number | null;
  /** Real-user INP from the Chrome UX Report, when the URL has enough traffic. */
  fieldInpMs: number | null;
  fieldCategory: "FAST" | "AVERAGE" | "SLOW" | null;
  fieldLcpMs: number | null;
  fieldCls: number | null;
  lcpDisplay: string | null;
  clsDisplay: string | null;
  fcpDisplay: string | null;
  ttfbDisplay: string | null;
  tbtDisplay: string | null;
}

export type PageSpeedAttempt =
  | { ok: true; data: PageSpeedMeasurement }
  | { ok: false; reason: string };

export interface PageSpeedSummary {
  testedUrl: string;
  id: string | null;
  strategy: "mobile";
  ok: boolean;
  reason?: string;
  lighthouseScore: number | null;
  reportUrl: string | null;
  crux: CruxMetrics;
  lighthouse: LighthouseMetrics;
}

const EMPTY_CRUX: CruxMetrics = {
  "First Contentful Paint": null,
  "Interaction to Next Paint": null,
};

const EMPTY_LIGHTHOUSE: LighthouseMetrics = {
  "First Contentful Paint": null,
  "Speed Index": null,
  "Largest Contentful Paint": null,
  "Total Blocking Time": null,
  "Time To Interactive": null,
};

export function getPageSpeedApiKey(): string | undefined {
  const raw =
    process.env["PAGESPEED-INSIGHTS-API"] || process.env.PAGESPEED_INSIGHTS_API;
  const key = raw?.trim();
  return key || undefined;
}

export function pageSpeedReportUrl(url: string): string {
  return `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}&form_factor=mobile`;
}

export function urlsMatch(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    const host = (value: string) => value.replace(/^www\./i, "").toLowerCase();
    const path = (value: string) => {
      const trimmed = value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
      return trimmed || "/";
    };
    return host(left.hostname) === host(right.hostname) && path(left.pathname) === path(right.pathname);
  } catch {
    return false;
  }
}

export function toPageSpeedSummary(attempt: PageSpeedAttempt, testedUrl: string): PageSpeedSummary {
  if (!attempt.ok) {
    return {
      testedUrl,
      id: null,
      strategy: "mobile",
      ok: false,
      reason: attempt.reason,
      lighthouseScore: null,
      reportUrl: null,
      crux: EMPTY_CRUX,
      lighthouse: EMPTY_LIGHTHOUSE,
    };
  }

  return {
    testedUrl: attempt.data.testedUrl,
    id: attempt.data.id,
    strategy: "mobile",
    ok: true,
    lighthouseScore: attempt.data.lighthouseScore,
    reportUrl: attempt.data.reportUrl,
    crux: attempt.data.crux,
    lighthouse: attempt.data.lighthouseMetrics,
  };
}

/**
 * Runs a mobile PageSpeed Insights lab test for one URL.
 * Returns a failed attempt instead of throwing so analysis can continue.
 */
export async function measurePageSpeed(url: string): Promise<PageSpeedAttempt> {
  const key = getPageSpeedApiKey();
  if (!key) {
    return {
      ok: false,
      reason: "PAGESPEED-INSIGHTS-API is not set",
    };
  }

  const endpoint = new URL(PSI_ENDPOINT);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("key", key);
  endpoint.searchParams.set("strategy", "mobile");
  endpoint.searchParams.set("category", "performance");

  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(PSI_TIMEOUT_MS) });
    const json: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, reason: redactKey(describeHttpError(response.status, json), key) };
    }
    const data = parsePageSpeedResponse(url, json);
    if (!data) {
      return { ok: false, reason: "PageSpeed Insights returned no Lighthouse result" };
    }
    return { ok: true, data };
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { ok: false, reason: "PageSpeed Insights timed out after 60 seconds." };
    }
    const message = error instanceof Error ? error.message : "PageSpeed Insights request failed";
    return { ok: false, reason: redactKey(message, key) };
  }
}

function describeHttpError(status: number, body: unknown): string {
  const apiMessage = readApiErrorMessage(body);
  if (status === 429) return "PageSpeed Insights quota exceeded. Try again later.";
  if (status === 403) {
    return apiMessage || "PageSpeed Insights rejected the API key. Enable the API for this key in Google Cloud.";
  }
  if (status === 400) return apiMessage || "PageSpeed Insights rejected this URL.";
  return apiMessage || `HTTP error! status: ${status}`;
}

function readApiErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" && error.message.trim() ? error.message.trim() : null;
}

function redactKey(message: string, key: string): string {
  return message.split(key).join("***");
}

function parsePageSpeedResponse(testedUrl: string, body: unknown): PageSpeedMeasurement | null {
  const root = asRecord(body);
  if (!root) return null;

  const lighthouse = asRecord(root.lighthouseResult);
  const audits = asRecord(lighthouse?.audits);
  const categories = asRecord(lighthouse?.categories);
  const performance = asRecord(categories?.performance);
  if (!lighthouse || !audits) return null;

  const rawScore = typeof performance?.score === "number" ? performance.score : null;
  const loadingExperience = asRecord(root.loadingExperience);
  const metrics = asRecord(loadingExperience?.metrics);
  const fieldLcp = metrics ? fieldMetric(metrics, "LARGEST_CONTENTFUL_PAINT_MS") : null;
  const fieldCls = metrics ? fieldMetric(metrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE") : null;
  const fieldInp = metrics ? fieldMetric(metrics, "INTERACTION_TO_NEXT_PAINT") : null;
  const fieldCategory = normalizeFieldCategory(loadingExperience?.overall_category);

  const finalUrl = typeof lighthouse.finalUrl === "string" ? lighthouse.finalUrl : testedUrl;
  const id = typeof root.id === "string" && root.id.trim() ? root.id : finalUrl;
  const crux: CruxMetrics = {
    "First Contentful Paint": metricCategory(metrics, "FIRST_CONTENTFUL_PAINT_MS"),
    "Interaction to Next Paint": metricCategory(metrics, "INTERACTION_TO_NEXT_PAINT"),
  };
  const lighthouseMetrics: LighthouseMetrics = {
    "First Contentful Paint": auditDisplay(audits, "first-contentful-paint"),
    "Speed Index": auditDisplay(audits, "speed-index"),
    "Largest Contentful Paint": auditDisplay(audits, "largest-contentful-paint"),
    "Total Blocking Time": auditDisplay(audits, "total-blocking-time"),
    "Time To Interactive": auditDisplay(audits, "interactive"),
  };

  return {
    id,
    testedUrl: finalUrl,
    strategy: "mobile",
    reportUrl: pageSpeedReportUrl(finalUrl),
    crux,
    lighthouseMetrics,
    lighthouseScore: rawScore === null ? null : Math.round(rawScore * 100),
    lcpMs: auditNumeric(audits, "largest-contentful-paint"),
    cls: auditNumeric(audits, "cumulative-layout-shift"),
    fcpMs: auditNumeric(audits, "first-contentful-paint"),
    tbtMs: auditNumeric(audits, "total-blocking-time"),
    ttfbMs: auditNumeric(audits, "server-response-time"),
    speedIndexMs: auditNumeric(audits, "speed-index"),
    fieldInpMs: fieldInp?.percentile ?? null,
    fieldCategory,
    fieldLcpMs: fieldLcp?.percentile ?? null,
    fieldCls: fieldCls ? fieldCls.percentile / 100 : null,
    lcpDisplay: auditDisplay(audits, "largest-contentful-paint"),
    clsDisplay: auditDisplay(audits, "cumulative-layout-shift"),
    fcpDisplay: auditDisplay(audits, "first-contentful-paint"),
    ttfbDisplay: auditDisplay(audits, "server-response-time"),
    tbtDisplay: auditDisplay(audits, "total-blocking-time"),
  };
}

function normalizeFieldCategory(value: unknown): "FAST" | "AVERAGE" | "SLOW" | null {
  if (value === "FAST" || value === "AVERAGE" || value === "SLOW") return value;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function auditNumeric(audits: Record<string, unknown>, id: string): number | null {
  const audit = asRecord(audits[id]);
  const value = audit?.numericValue;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function auditDisplay(audits: Record<string, unknown>, id: string): string | null {
  const audit = asRecord(audits[id]);
  return typeof audit?.displayValue === "string" && audit.displayValue.trim()
    ? audit.displayValue.trim()
    : null;
}

function metricCategory(metrics: Record<string, unknown> | null, id: string): string | null {
  if (!metrics) return null;
  const metric = asRecord(metrics[id]);
  const category = metric?.category;
  return typeof category === "string" && category.trim() ? category.trim() : null;
}

function fieldMetric(
  metrics: Record<string, unknown>,
  id: string
): { percentile: number } | null {
  const metric = asRecord(metrics[id]);
  const percentile = metric?.percentile;
  if (typeof percentile !== "number" || !Number.isFinite(percentile)) return null;
  return { percentile };
}
