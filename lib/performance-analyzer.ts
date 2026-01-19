import axios from "axios";
import * as cheerio from "cheerio";
import type { PerformanceCheck, CheckResult } from "@/app/types";

const TIMEOUT = 30000;

export async function analyzePerformance(
  url: string,
  html: string,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<PerformanceCheck> {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);

  // Measure basic performance metrics
  const startTime = Date.now();
  let responseTime = 0;
  let ttfb = 0;

  try {
    const response = await axios.head(url, { timeout: TIMEOUT });
    responseTime = Date.now() - startTime;
    // TTFB approximation (actual TTFB requires browser)
    ttfb = responseTime;
  } catch {
    // If HEAD fails, try GET
    try {
      const response = await axios.get(url, { timeout: TIMEOUT });
      responseTime = Date.now() - startTime;
      ttfb = responseTime;
    } catch {
      responseTime = 0;
    }
  }

  // Analyze resources
  const resourceAnalysis = analyzeResources($, baseUrl);

  return {
    pageLoadTime: checkPageLoadTime(responseTime, passed, warnings, failed),
    ttfb: checkTTFB(ttfb, passed, warnings, failed),
    domContentLoaded: checkDOMContentLoaded(responseTime, passed, warnings, failed),
    totalPageSize: checkTotalPageSize(resourceAnalysis.totalSize, passed, warnings, failed),
    imageOptimization: checkImageOptimization($, resourceAnalysis, passed, warnings, failed),
    renderBlockingResources: checkRenderBlockingResources($, passed, warnings, failed),
    fontLoading: checkFontLoading($, passed, warnings, failed),
    thirdPartyScripts: checkThirdPartyScripts($, baseUrl, passed, warnings, failed),
  };
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
      value: { webpPercentage, lazyLoadPercentage },
      recommendation: "Use WebP/AVIF format and lazy loading for better performance",
    };
  }

  passed.push("Images are well optimized");
  return {
    status: "pass",
    message: "Images are well optimized",
    value: { webpPercentage, lazyLoadPercentage },
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
      value: { blockingScripts, blockingStyles },
      recommendation: "Use async/defer for scripts and inline critical CSS to reduce render-blocking",
    };
  }

  passed.push("Render-blocking resources are optimized");
  return {
    status: "pass",
    message: "Render-blocking resources are optimized",
    value: { blockingScripts, blockingStyles },
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
