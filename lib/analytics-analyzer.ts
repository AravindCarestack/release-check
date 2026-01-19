import * as cheerio from "cheerio";
import type { AnalyticsCheck, CheckResult } from "@/app/types";

export function analyzeAnalytics(
  html: string,
  passed: string[],
  warnings: string[],
  failed: string[]
): AnalyticsCheck {
  const $ = cheerio.load(html);

  return {
    googleAnalytics: checkGoogleAnalytics($, passed, warnings, failed),
    googleTagManager: checkGoogleTagManager($, passed, warnings, failed),
    facebookPixel: checkFacebookPixel($, passed, warnings, failed),
    trackingConsent: checkTrackingConsent($, passed, warnings, failed),
  };
}

function checkGoogleAnalytics(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  // Check for Google Analytics (gtag.js, analytics.js, ga.js)
  const hasGtag = $("script[src*='googletagmanager.com/gtag'], script[src*='google-analytics.com']").length > 0;
  const hasAnalytics = $("script").filter((_, el) => {
    const content = $(el).html() || "";
    return content.includes("ga(") || content.includes("gtag(") || content.includes("GoogleAnalyticsObject");
  }).length > 0;

  if (hasGtag || hasAnalytics) {
    passed.push("Google Analytics is implemented");
    return {
      status: "pass",
      message: "Google Analytics is implemented",
      value: true,
    };
  }

  return {
    status: "warn",
    message: "Google Analytics not detected",
    recommendation: "Consider implementing Google Analytics for website analytics",
  };
}

function checkGoogleTagManager(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  // Check for Google Tag Manager
  const hasGTM = $("script[src*='googletagmanager.com/gtm.js'], noscript iframe[src*='googletagmanager.com']").length > 0;
  const hasGTMDataLayer = $("script").filter((_, el) => {
    const content = $(el).html() || "";
    return content.includes("dataLayer") || content.includes("GTM-");
  }).length > 0;

  if (hasGTM || hasGTMDataLayer) {
    passed.push("Google Tag Manager is implemented");
    return {
      status: "pass",
      message: "Google Tag Manager is implemented",
      value: true,
    };
  }

  return {
    status: "warn",
    message: "Google Tag Manager not detected",
    recommendation: "Consider using Google Tag Manager for easier tag management",
  };
}

function checkFacebookPixel(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  // Check for Facebook Pixel
  const hasPixel = $("script").filter((_, el) => {
    const content = $(el).html() || "";
    return content.includes("fbq(") || content.includes("facebook.net") || content.includes("connect.facebook.net");
  }).length > 0;

  if (hasPixel) {
    passed.push("Facebook Pixel is implemented");
    return {
      status: "pass",
      message: "Facebook Pixel is implemented",
      value: true,
    };
  }

  return {
    status: "warn",
    message: "Facebook Pixel not detected",
    recommendation: "Consider implementing Facebook Pixel if using Facebook advertising",
  };
}

function checkTrackingConsent(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  // Check for tracking scripts
  const hasTracking = $("script").filter((_, el) => {
    const src = $(el).attr("src") || "";
    const content = $(el).html() || "";
    return (
      src.includes("google-analytics") ||
      src.includes("googletagmanager") ||
      src.includes("facebook.net") ||
      content.includes("gtag(") ||
      content.includes("fbq(") ||
      content.includes("dataLayer")
    );
  }).length > 0;

  if (!hasTracking) {
    return {
      status: "pass",
      message: "No tracking scripts detected",
      value: false,
    };
  }

  // Check for consent management (cookie banners, privacy notices)
  const hasConsentBanner = $(
    "[class*='cookie'], [class*='consent'], [id*='cookie'], [id*='consent'], " +
    "[class*='gdpr'], [id*='gdpr'], [class*='privacy'], [id*='privacy']"
  ).length > 0;

  const hasConsentScript = $("script").filter((_, el) => {
    const content = $(el).html() || "";
    return content.includes("cookie") && (content.includes("consent") || content.includes("accept"));
  }).length > 0;

  if (hasConsentBanner || hasConsentScript) {
    passed.push("Tracking consent mechanism detected");
    return {
      status: "pass",
      message: "Tracking consent mechanism detected",
      value: true,
    };
  }

  warnings.push("Tracking scripts detected but no consent mechanism found");
  return {
    status: "warn",
    message: "Tracking scripts detected but no consent mechanism found",
    value: true,
    recommendation: "Implement GDPR-compliant cookie consent banner for tracking scripts",
  };
}
