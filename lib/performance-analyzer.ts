import axios from "axios";
import * as cheerio from "cheerio";
import type { PerformanceCheck, CheckResult } from "@/app/types";
import type { PageSpeedAttempt, PageSpeedMeasurement } from "@/lib/pagespeed";

const TIMEOUT = 30000;

export async function analyzePerformance(
  url: string,
  html: string,
  passed: string[],
  warnings: string[],
  failed: string[],
  options?: { pageSpeed?: PageSpeedAttempt }
): Promise<PerformanceCheck> {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);
  const pageSpeed = options?.pageSpeed;
  const lab = pageSpeed?.ok ? pageSpeed.data : null;

  let responseTime = 0;
  let ttfb = 0;
  if (!lab) {
    const timing = await measureResponseTiming(url);
    responseTime = timing.responseTime;
    ttfb = timing.ttfb;
  }

  const resourceAnalysis = analyzeResources($, baseUrl);
  const pageSpeedFields = pageSpeed ? pageSpeedChecks(pageSpeed, passed, warnings, failed) : {};

  return {
    pageLoadTime: lab
      ? lowerIsBetterCheck(
          "Largest Contentful Paint",
          lab.lcpMs,
          lab.lcpDisplay,
          2500,
          4000,
          "ms",
          passed,
          warnings,
          failed,
          "Reduce the largest element (hero image, banner, or heading) so it paints within 2.5 seconds on mobile."
        )
      : checkPageLoadTime(responseTime, passed, warnings, failed),
    ttfb: lab
      ? lowerIsBetterCheck(
          "Time to First Byte",
          lab.ttfbMs,
          lab.ttfbDisplay,
          800,
          1800,
          "ms",
          passed,
          warnings,
          failed,
          "Improve server response time with caching, a closer CDN, and a lighter document."
        )
      : checkTTFB(ttfb, passed, warnings, failed),
    domContentLoaded: lab
      ? {
          ...lowerIsBetterCheck(
            "First Contentful Paint",
            lab.fcpMs,
            lab.fcpDisplay,
            1800,
            3000,
            "ms",
            passed,
            warnings,
            failed,
            "Reduce render-blocking CSS and JavaScript so the first content paints sooner."
          ),
          label: "First Contentful Paint",
        }
      : checkDOMContentLoaded(responseTime, passed, warnings, failed),
    totalPageSize: checkTotalPageSize(resourceAnalysis.totalSize, passed, warnings, failed),
    imageOptimization: checkImageOptimization($, resourceAnalysis, passed, warnings, failed),
    renderBlockingResources: checkRenderBlockingResources($, passed, warnings, failed),
    fontLoading: checkFontLoading($, passed, warnings, failed),
    thirdPartyScripts: checkThirdPartyScripts($, baseUrl, passed, warnings, failed),
    ...pageSpeedFields,
  };
}

async function measureResponseTiming(url: string): Promise<{ responseTime: number; ttfb: number }> {
  const startTime = Date.now();
  try {
    await axios.head(url, { timeout: TIMEOUT });
    const responseTime = Date.now() - startTime;
    return { responseTime, ttfb: responseTime };
  } catch {
    try {
      await axios.get(url, { timeout: TIMEOUT });
      const responseTime = Date.now() - startTime;
      return { responseTime, ttfb: responseTime };
    } catch {
      return { responseTime: 0, ttfb: 0 };
    }
  }
}

function pageSpeedChecks(
  attempt: PageSpeedAttempt,
  passed: string[],
  warnings: string[],
  failed: string[]
): Pick<
  PerformanceCheck,
  | "lighthouseScore"
  | "cumulativeLayoutShift"
  | "interactionToNextPaint"
  | "totalBlockingTime"
  | "fieldExperience"
  | "pageSpeed"
> {
  if (!attempt.ok) {
    warnings.push(`PageSpeed Insights unavailable: ${attempt.reason}`);
    return {
      pageSpeed: {
        status: "warn",
        label: "PageSpeed Insights",
        message: `PageSpeed Insights unavailable: ${attempt.reason}`,
        recommendation:
          "Set PAGESPEED-INSIGHTS-API in .env and enable the PageSpeed Insights API for that key in Google Cloud.",
      },
    };
  }

  const data = attempt.data;
  return {
    lighthouseScore: scoreCheck(data, passed, warnings, failed),
    cumulativeLayoutShift: lowerIsBetterCheck(
      "Cumulative Layout Shift",
      data.cls,
      data.clsDisplay,
      0.1,
      0.25,
      "cls",
      passed,
      warnings,
      failed,
      "Reserve space for images, ads, and embeds so the page does not jump while loading."
    ),
    interactionToNextPaint: data.fieldInpMs === null
      ? undefined
      : lowerIsBetterCheck(
          "Interaction to Next Paint",
          data.fieldInpMs,
          null,
          200,
          500,
          "ms",
          passed,
          warnings,
          failed,
          "Field INP from the Chrome UX Report. Break up long tasks and defer non-critical JavaScript."
        ),
    totalBlockingTime: lowerIsBetterCheck(
      "Total Blocking Time",
      data.tbtMs,
      data.tbtDisplay,
      200,
      600,
      "ms",
      passed,
      warnings,
      failed,
      "Lab responsiveness from PageSpeed Insights. Reduce main-thread work from scripts."
    ),
    fieldExperience: fieldExperienceCheck(data, passed, warnings, failed),
  };
}

function scoreCheck(
  data: PageSpeedMeasurement,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const score = data.lighthouseScore;
  if (score === null) {
    warnings.push("PageSpeed Insights did not return a performance score");
    return {
      status: "warn",
      label: "Lighthouse score",
      message: "PageSpeed Insights did not return a performance score",
      recommendation: `Open the full report: ${data.reportUrl}`,
    };
  }

  const result: CheckResult = {
    label: "Lighthouse score",
    value: score,
    recommendation: `Mobile lab data from PageSpeed Insights. Full report: ${data.reportUrl}`,
    status: score >= 90 ? "pass" : score >= 50 ? "warn" : "fail",
    message:
      score >= 90
        ? `Lighthouse performance score is ${score} (mobile)`
        : score >= 50
          ? `Lighthouse performance score is ${score} (mobile). 90+ is the target.`
          : `Lighthouse performance score is ${score} (mobile). This is in the poor range.`,
  };

  if (result.status === "pass") passed.push(result.message);
  else if (result.status === "warn") warnings.push(result.message);
  else failed.push(result.message);
  return result;
}

function fieldExperienceCheck(
  data: PageSpeedMeasurement,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  if (!data.fieldCategory) {
    return {
      status: "warn",
      label: "Field data (CrUX)",
      message: "No Chrome UX Report field data for this URL",
      recommendation: "Field data appears after the URL has enough Chrome traffic. The lab metrics above still apply.",
    };
  }

  const parts = [
    data.fieldLcpMs !== null ? `LCP ${formatDuration(data.fieldLcpMs)}` : null,
    data.fieldInpMs !== null ? `INP ${formatDuration(data.fieldInpMs)}` : null,
    data.fieldCls !== null ? `CLS ${data.fieldCls.toFixed(2)}` : null,
  ].filter(Boolean);

  const detail = parts.length > 0 ? ` ${parts.join(", ")}.` : "";
  const status = data.fieldCategory === "FAST" ? "pass" : data.fieldCategory === "AVERAGE" ? "warn" : "fail";
  const message = `Chrome UX Report rates this URL ${data.fieldCategory}.${detail}`;
  const result: CheckResult = {
    status,
    label: "Field data (CrUX)",
    message,
    value: data.fieldCategory,
    recommendation: "Field data is what Google uses for Core Web Vitals ranking. Lab data shows a single test run.",
  };

  if (status === "pass") passed.push(message);
  else if (status === "warn") warnings.push(message);
  else failed.push(message);
  return result;
}

function lowerIsBetterCheck(
  label: string,
  value: number | null,
  display: string | null,
  good: number,
  poor: number,
  unit: "ms" | "cls",
  passed: string[],
  warnings: string[],
  failed: string[],
  recommendation: string
): CheckResult {
  if (value === null) {
    warnings.push(`${label} was not returned by PageSpeed Insights`);
    return {
      status: "warn",
      label,
      message: `${label} was not returned by PageSpeed Insights`,
      recommendation,
    };
  }

  const shown = display || (unit === "cls" ? value.toFixed(3) : formatDuration(value));
  const status = value <= good ? "pass" : value <= poor ? "warn" : "fail";
  const target = unit === "cls" ? `${good}` : formatDuration(good);
  const message =
    status === "pass"
      ? `${label} is ${shown} (mobile, PageSpeed Insights)`
      : `${label} is ${shown} (mobile, PageSpeed Insights). Target is ${target} or less.`;

  if (status === "pass") passed.push(message);
  else if (status === "warn") warnings.push(message);
  else failed.push(message);

  return {
    status,
    label,
    message,
    value: unit === "cls" ? Number(value.toFixed(3)) : Math.round(value),
    recommendation,
  };
}

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

interface ResourceAnalysis {
  totalSize: number;
  imageCount: number;
  scriptCount: number;
  stylesheetCount: number;
  webpImages: number;
  lazyLoadedImages: number;
}

function analyzeResources($: cheerio.CheerioAPI, baseUrl: URL): ResourceAnalysis {
  let totalSize = 0;
  let imageCount = 0;
  let scriptCount = 0;
  let stylesheetCount = 0;
  let webpImages = 0;
  let lazyLoadedImages = 0;

  // Estimate HTML size
  totalSize += Buffer.byteLength($.html(), "utf8");

  // Analyze images
  $("img").each((_, el) => {
    imageCount++;
    const src = $(el).attr("src");
    const loading = $(el).attr("loading");
    if (loading === "lazy") {
      lazyLoadedImages++;
    }
    if (src && (src.includes(".webp") || src.includes(".avif"))) {
      webpImages++;
    }
  });

  // Analyze scripts
  $("script[src]").each(() => {
    scriptCount++;
  });

  // Analyze stylesheets
  $("link[rel='stylesheet']").each(() => {
    stylesheetCount++;
  });

  return {
    totalSize,
    imageCount,
    scriptCount,
    stylesheetCount,
    webpImages,
    lazyLoadedImages,
  };
}

function checkPageLoadTime(
  loadTime: number,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  if (loadTime === 0) {
    return {
      status: "warn",
      message: "Could not measure page load time",
      recommendation: "Check network connectivity",
    };
  }

  if (loadTime > 3000) {
    failed.push(`Page load time is ${loadTime}ms (target: < 3000ms)`);
    return {
      status: "fail",
      message: `Page load time is ${loadTime}ms`,
      value: loadTime,
      recommendation: "Optimize page load time to under 3 seconds",
    };
  }

  if (loadTime > 2000) {
    warnings.push(`Page load time is ${loadTime}ms (target: < 2000ms)`);
    return {
      status: "warn",
      message: `Page load time is ${loadTime}ms`,
      value: loadTime,
      recommendation: "Optimize page load time to under 2 seconds",
    };
  }

  passed.push(`Page load time is ${loadTime}ms`);
  return {
    status: "pass",
    message: `Page load time is ${loadTime}ms`,
    value: loadTime,
  };
}

function checkTTFB(
  ttfb: number,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  if (ttfb === 0) {
    return {
      status: "warn",
      message: "Could not measure TTFB",
      recommendation: "Check network connectivity",
    };
  }

  if (ttfb > 800) {
    failed.push(`TTFB is ${ttfb}ms (target: < 800ms)`);
    return {
      status: "fail",
      message: `TTFB is ${ttfb}ms`,
      value: ttfb,
      recommendation: "Optimize server response time to under 800ms",
    };
  }

  if (ttfb > 600) {
    warnings.push(`TTFB is ${ttfb}ms (target: < 600ms)`);
    return {
      status: "warn",
      message: `TTFB is ${ttfb}ms`,
      value: ttfb,
      recommendation: "Optimize server response time to under 600ms",
    };
  }

  passed.push(`TTFB is ${ttfb}ms`);
  return {
    status: "pass",
    message: `TTFB is ${ttfb}ms`,
    value: ttfb,
  };
}

function checkDOMContentLoaded(
  loadTime: number,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  // Approximation - actual DOMContentLoaded requires browser
  if (loadTime > 2000) {
    warnings.push("DOMContentLoaded may be slow");
    return {
      status: "warn",
      message: "DOMContentLoaded may be slow",
      value: loadTime,
      recommendation: "Reduce render-blocking resources to improve DOMContentLoaded time",
    };
  }

  passed.push("DOMContentLoaded appears optimized");
  return {
    status: "pass",
    message: "DOMContentLoaded appears optimized",
    value: loadTime,
  };
}

function checkTotalPageSize(
  size: number,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const sizeInMB = size / (1024 * 1024);

  if (sizeInMB > 5) {
    failed.push(`Total page size is ${sizeInMB.toFixed(2)}MB (target: < 5MB)`);
    return {
      status: "fail",
      message: `Total page size is ${sizeInMB.toFixed(2)}MB`,
      value: sizeInMB,
      recommendation: "Reduce page size by optimizing images, minifying CSS/JS, and removing unused code",
    };
  }

  if (sizeInMB > 3) {
    warnings.push(`Total page size is ${sizeInMB.toFixed(2)}MB (target: < 3MB)`);
    return {
      status: "warn",
      message: `Total page size is ${sizeInMB.toFixed(2)}MB`,
      value: sizeInMB,
      recommendation: "Optimize page size for better performance",
    };
  }

  passed.push(`Total page size is ${sizeInMB.toFixed(2)}MB`);
  return {
    status: "pass",
    message: `Total page size is ${sizeInMB.toFixed(2)}MB`,
    value: sizeInMB,
  };
}

function checkImageOptimization(
  $: cheerio.CheerioAPI,
  analysis: ResourceAnalysis,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  if (analysis.imageCount === 0) {
    return {
      status: "pass",
      message: "No images found",
      value: 0,
    };
  }

  const webpPercentage = (analysis.webpImages / analysis.imageCount) * 100;
  const lazyLoadPercentage = (analysis.lazyLoadedImages / analysis.imageCount) * 100;

  if (webpPercentage < 50 && lazyLoadPercentage < 50) {
    warnings.push(`Only ${webpPercentage.toFixed(0)}% images use WebP/AVIF and ${lazyLoadPercentage.toFixed(0)}% use lazy loading`);
    return {
      status: "warn",
      message: `Image optimization could be improved`,
      value: `${webpPercentage.toFixed(0)}% WebP, ${lazyLoadPercentage.toFixed(0)}% lazy loaded`,
      recommendation: "Use WebP/AVIF format and lazy loading for better performance",
    };
  }

  passed.push("Images are well optimized");
  return {
    status: "pass",
    message: "Images are well optimized",
    value: `${webpPercentage.toFixed(0)}% WebP, ${lazyLoadPercentage.toFixed(0)}% lazy loaded`,
  };
}

function checkRenderBlockingResources(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const blockingScripts = $("script[src]:not([async]):not([defer])").length;
  const blockingStyles = $("link[rel='stylesheet']:not([media='print'])").length;

  if (blockingScripts > 3 || blockingStyles > 3) {
    warnings.push(`Found ${blockingScripts} blocking scripts and ${blockingStyles} blocking stylesheets`);
    return {
      status: "warn",
      message: `Multiple render-blocking resources detected`,
      value: `${blockingScripts} scripts, ${blockingStyles} stylesheets`,
      recommendation: "Use async/defer for scripts and inline critical CSS to reduce render-blocking",
    };
  }

  passed.push("Render-blocking resources are optimized");
  return {
    status: "pass",
    message: "Render-blocking resources are optimized",
    value: `${blockingScripts} scripts, ${blockingStyles} stylesheets`,
  };
}

function checkFontLoading(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const fontLinks = $("link[rel='stylesheet'][href*='font'], link[href*='googleapis.com/fonts'], link[href*='fonts.googleapis.com']");
  const hasFontDisplay = $("style, link[rel='stylesheet']").filter((_, el) => {
    const content = $(el).html() || $(el).attr("href") || "";
    return content.includes("font-display");
  }).length > 0;

  if (fontLinks.length > 0 && !hasFontDisplay) {
    warnings.push("Web fonts detected but font-display strategy not found");
    return {
      status: "warn",
      message: "Web fonts detected without font-display strategy",
      value: fontLinks.length,
      recommendation: "Add font-display: swap or optional to prevent FOIT/FOUT",
    };
  }

  passed.push("Font loading is optimized");
  return {
    status: "pass",
    message: "Font loading is optimized",
    value: fontLinks.length,
  };
}

function checkThirdPartyScripts(
  $: cheerio.CheerioAPI,
  baseUrl: URL,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const thirdPartyDomains = new Set<string>();
  const hostname = baseUrl.hostname;

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      try {
        const scriptUrl = new URL(src, baseUrl);
        if (scriptUrl.hostname !== hostname && !scriptUrl.hostname.includes(hostname.replace("www.", ""))) {
          thirdPartyDomains.add(scriptUrl.hostname);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  const count = thirdPartyDomains.size;

  if (count > 5) {
    warnings.push(`Found ${count} third-party script domains`);
    return {
      status: "warn",
      message: `Found ${count} third-party script domains`,
      value: count,
      recommendation: "Consider reducing third-party scripts or using a tag manager to consolidate",
    };
  }

  passed.push(`Third-party scripts are manageable (${count} domains)`);
  return {
    status: "pass",
    message: `Third-party scripts are manageable`,
    value: count,
  };
}
