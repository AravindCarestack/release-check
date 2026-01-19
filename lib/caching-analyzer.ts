import axios from "axios";
import type { CachingCheck, CheckResult } from "@/app/types";

const TIMEOUT = 10000;

export async function analyzeCaching(
  url: string,
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<CachingCheck> {
  return {
    cacheControl: checkCacheControl(headers, passed, warnings, failed),
    etag: checkETag(headers, passed, warnings, failed),
    cdnUsage: await checkCDNUsage(url, headers, passed, warnings, failed),
    staticAssetCaching: await checkStaticAssetCaching(url, headers, passed, warnings, failed),
  };
}

function getHeaderValue(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (!value) return null;
  if (Array.isArray(value)) return value[0];
  return value;
}

function checkCacheControl(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const cacheControl = getHeaderValue(headers, "cache-control");

  if (!cacheControl) {
    warnings.push("Cache-Control header is missing");
    return {
      status: "warn",
      message: "Cache-Control header is missing",
      recommendation: "Add Cache-Control header to control browser caching",
    };
  }

  // Check for no-cache or no-store (might be intentional for dynamic content)
  if (cacheControl.includes("no-cache") || cacheControl.includes("no-store")) {
    warnings.push("Cache-Control prevents caching");
    return {
      status: "warn",
      message: "Cache-Control prevents caching",
      value: cacheControl,
      recommendation: "Consider enabling caching for static assets",
    };
  }

  // Check for max-age
  if (!cacheControl.includes("max-age")) {
    warnings.push("Cache-Control missing max-age directive");
    return {
      status: "warn",
      message: "Cache-Control missing max-age directive",
      value: cacheControl,
      recommendation: "Add max-age directive to Cache-Control header",
    };
  }

  passed.push("Cache-Control is properly configured");
  return {
    status: "pass",
    message: "Cache-Control is properly configured",
    value: cacheControl,
  };
}

function checkETag(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const etag = getHeaderValue(headers, "etag");

  if (!etag) {
    warnings.push("ETag header is missing");
    return {
      status: "warn",
      message: "ETag header is missing",
      recommendation: "Add ETag header for efficient cache validation",
    };
  }

  passed.push("ETag header is present");
  return {
    status: "pass",
    message: "ETag header is present",
    value: etag,
  };
}

async function checkCDNUsage(
  url: string,
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<CheckResult> {
  const baseUrl = new URL(url);
  
  // Common CDN indicators
  const cdnIndicators = [
    "cloudflare",
    "cloudfront",
    "fastly",
    "keycdn",
    "cdn",
    "akamai",
    "maxcdn",
    "jsdelivr",
    "cdnjs",
  ];

  // Check server header
  const server = getHeaderValue(headers, "server");
  const isCDN = server && cdnIndicators.some(indicator => server.toLowerCase().includes(indicator));

  // Check via header
  const via = getHeaderValue(headers, "via");
  const isCDNVia = via && cdnIndicators.some(indicator => via.toLowerCase().includes(indicator));

  // Check X-CDN header
  const xCdn = getHeaderValue(headers, "x-cdn") || getHeaderValue(headers, "x-cache");

  if (isCDN || isCDNVia || xCdn) {
    passed.push("CDN usage detected");
    return {
      status: "pass",
      message: "CDN usage detected",
      value: true,
    };
  }

  warnings.push("CDN usage not detected");
  return {
    status: "warn",
    message: "CDN usage not detected",
    value: false,
    recommendation: "Consider using a CDN to improve page load times globally",
  };
}

async function checkStaticAssetCaching(
  url: string,
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<CheckResult> {
  const baseUrl = new URL(url);
  
  // Try to check common static asset paths
  const staticPaths = ["/static/", "/assets/", "/css/", "/js/", "/images/", "/img/"];
  const pathname = baseUrl.pathname.toLowerCase();
  
  const isStaticAsset = staticPaths.some(path => pathname.includes(path)) ||
    /\.(css|js|jpg|jpeg|png|gif|svg|woff|woff2|ttf|eot|ico)$/i.test(pathname);

  if (!isStaticAsset) {
    // For non-static pages, this check doesn't apply
    return {
      status: "pass",
      message: "Not a static asset",
      value: false,
    };
  }

  const cacheControl = getHeaderValue(headers, "cache-control");
  
  if (!cacheControl) {
    warnings.push("Static asset missing Cache-Control header");
    return {
      status: "warn",
      message: "Static asset missing Cache-Control header",
      recommendation: "Add Cache-Control header with long max-age for static assets",
    };
  }

  // Check for long max-age for static assets
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  if (maxAgeMatch) {
    const maxAge = parseInt(maxAgeMatch[1]);
    if (maxAge < 86400) { // Less than 1 day
      warnings.push("Static asset has short cache duration");
      return {
        status: "warn",
        message: `Static asset cache duration is ${maxAge} seconds`,
        value: maxAge,
        recommendation: "Use longer cache duration (e.g., max-age=31536000) for static assets",
      };
    }
  }

  passed.push("Static asset caching is properly configured");
  return {
    status: "pass",
    message: "Static asset caching is properly configured",
    value: cacheControl,
  };
}
