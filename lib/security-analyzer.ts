import axios from "axios";
import * as cheerio from "cheerio";
import * as tls from "tls";
import type { SecurityCheck, CheckResult } from "@/app/types";

const TIMEOUT = 10000;

export async function analyzeSecurity(
  url: string,
  html: string,
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<SecurityCheck> {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);

  return {
    contentSecurityPolicy: checkContentSecurityPolicy(headers, passed, warnings, failed),
    xFrameOptions: checkXFrameOptions(headers, passed, warnings, failed),
    xContentTypeOptions: checkXContentTypeOptions(headers, passed, warnings, failed),
    strictTransportSecurity: checkStrictTransportSecurity(headers, baseUrl, passed, warnings, failed),
    referrerPolicy: checkReferrerPolicy(headers, passed, warnings, failed),
    permissionsPolicy: checkPermissionsPolicy(headers, passed, warnings, failed),
    sslCertificate: await checkSSLCertificate(baseUrl, passed, warnings, failed),
    mixedContent: checkMixedContent($, baseUrl, passed, warnings, failed),
    cookieSecurity: checkCookieSecurity(headers, passed, warnings, failed),
  };
}

function getHeaderValue(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (!value) return null;
  if (Array.isArray(value)) return value[0];
  return value;
}

function checkContentSecurityPolicy(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const csp = getHeaderValue(headers, "content-security-policy");
  
  if (!csp) {
    warnings.push("Content-Security-Policy header is missing");
    return {
      status: "warn",
      message: "Content-Security-Policy header is missing",
      recommendation: "Add Content-Security-Policy header to prevent XSS attacks",
    };
  }

  // Check for unsafe-inline or unsafe-eval
  if (csp.includes("unsafe-inline") || csp.includes("unsafe-eval")) {
    warnings.push("Content-Security-Policy contains unsafe directives");
    return {
      status: "warn",
      message: "CSP contains unsafe directives (unsafe-inline or unsafe-eval)",
      value: csp,
      recommendation: "Remove unsafe-inline and unsafe-eval from CSP for better security",
    };
  }

  passed.push("Content-Security-Policy is properly configured");
  return {
    status: "pass",
    message: "Content-Security-Policy is present and configured",
    value: csp,
  };
}

function checkXFrameOptions(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const xfo = getHeaderValue(headers, "x-frame-options");
  
  if (!xfo) {
    warnings.push("X-Frame-Options header is missing");
    return {
      status: "warn",
      message: "X-Frame-Options header is missing",
      recommendation: "Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking",
    };
  }

  const normalized = xfo.toUpperCase();
  if (normalized !== "DENY" && normalized !== "SAMEORIGIN") {
    warnings.push("X-Frame-Options has non-standard value");
    return {
      status: "warn",
      message: `X-Frame-Options value is '${xfo}'`,
      value: xfo,
      recommendation: "Use X-Frame-Options: DENY or SAMEORIGIN",
    };
  }

  passed.push("X-Frame-Options is properly configured");
  return {
    status: "pass",
    message: "X-Frame-Options is present and configured",
    value: xfo,
  };
}

function checkXContentTypeOptions(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const xcto = getHeaderValue(headers, "x-content-type-options");
  
  if (!xcto) {
    warnings.push("X-Content-Type-Options header is missing");
    return {
      status: "warn",
      message: "X-Content-Type-Options header is missing",
      recommendation: "Add X-Content-Type-Options: nosniff to prevent MIME sniffing",
    };
  }

  if (xcto.toLowerCase() !== "nosniff") {
    warnings.push("X-Content-Type-Options has incorrect value");
    return {
      status: "warn",
      message: `X-Content-Type-Options value is '${xcto}'`,
      value: xcto,
      recommendation: "Use X-Content-Type-Options: nosniff",
    };
  }

  passed.push("X-Content-Type-Options is properly configured");
  return {
    status: "pass",
    message: "X-Content-Type-Options is present and configured",
    value: xcto,
  };
}

function checkStrictTransportSecurity(
  headers: Record<string, string | string[] | undefined>,
  baseUrl: URL,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  // Only check HSTS for HTTPS URLs
  if (baseUrl.protocol !== "https:") {
    return {
      status: "warn",
      message: "HSTS only applies to HTTPS sites",
      recommendation: "Enable HTTPS to use HSTS",
    };
  }

  const hsts = getHeaderValue(headers, "strict-transport-security");
  
  if (!hsts) {
    warnings.push("Strict-Transport-Security header is missing");
    return {
      status: "warn",
      message: "Strict-Transport-Security header is missing",
      recommendation: "Add Strict-Transport-Security header to enforce HTTPS",
    };
  }

  // Check for max-age
  if (!hsts.includes("max-age")) {
    warnings.push("Strict-Transport-Security missing max-age");
    return {
      status: "warn",
      message: "HSTS header missing max-age directive",
      value: hsts,
      recommendation: "Add max-age directive to HSTS header (e.g., max-age=31536000)",
    };
  }

  passed.push("Strict-Transport-Security is properly configured");
  return {
    status: "pass",
    message: "Strict-Transport-Security is present and configured",
    value: hsts,
  };
}

function checkReferrerPolicy(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const rp = getHeaderValue(headers, "referrer-policy");
  
  if (!rp) {
    warnings.push("Referrer-Policy header is missing");
    return {
      status: "warn",
      message: "Referrer-Policy header is missing",
      recommendation: "Add Referrer-Policy header to control referrer information",
    };
  }

  passed.push("Referrer-Policy is present");
  return {
    status: "pass",
    message: "Referrer-Policy is present",
    value: rp,
  };
}

function checkPermissionsPolicy(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const pp = getHeaderValue(headers, "permissions-policy") || getHeaderValue(headers, "feature-policy");
  
  if (!pp) {
    warnings.push("Permissions-Policy header is missing");
    return {
      status: "warn",
      message: "Permissions-Policy header is missing",
      recommendation: "Add Permissions-Policy header to restrict browser features",
    };
  }

  passed.push("Permissions-Policy is present");
  return {
    status: "pass",
    message: "Permissions-Policy is present",
    value: pp,
  };
}

async function checkSSLCertificate(
  baseUrl: URL,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<CheckResult> {
  if (baseUrl.protocol !== "https:") {
    return {
      status: "fail",
      message: "Site is not using HTTPS",
      recommendation: "Enable HTTPS/SSL certificate",
    };
  }

  try {
    // Use Node.js tls module to check certificate
    return new Promise((resolve) => {
      const socket = tls.connect(
        {
          host: baseUrl.hostname,
          port: 443,
          servername: baseUrl.hostname,
          rejectUnauthorized: false, // We'll check manually
        },
        () => {
          try {
            const cert = socket.getPeerCertificate(true);
            socket.end();

            if (!cert || !cert.valid_to) {
              failed.push("SSL certificate validation failed");
              resolve({
                status: "fail",
                message: "SSL certificate validation failed",
                recommendation: "Check SSL certificate configuration",
              });
              return;
            }

            const expiryDate = new Date(cert.valid_to);
            const now = new Date();
            const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (daysUntilExpiry < 0) {
              failed.push("SSL certificate has expired");
              resolve({
                status: "fail",
                message: "SSL certificate has expired",
                recommendation: "Renew SSL certificate immediately",
              });
              return;
            }

            if (daysUntilExpiry < 30) {
              warnings.push("SSL certificate expires soon");
              resolve({
                status: "warn",
                message: `SSL certificate expires in ${daysUntilExpiry} days`,
                value: expiryDate.toISOString(),
                recommendation: "Renew SSL certificate before expiration",
              });
              return;
            }

            passed.push("SSL certificate is valid");
            resolve({
              status: "pass",
              message: "SSL certificate is valid",
              value: expiryDate.toISOString(),
            });
          } catch (err) {
            socket.end();
            warnings.push("Could not verify SSL certificate");
            resolve({
              status: "warn",
              message: "Could not verify SSL certificate",
              recommendation: "Verify SSL certificate manually",
            });
          }
        }
      );

      socket.on("error", () => {
        warnings.push("Could not verify SSL certificate");
        resolve({
          status: "warn",
          message: "Could not verify SSL certificate",
          recommendation: "Verify SSL certificate manually",
        });
      });

      // Set timeout for connection
      socket.setTimeout(5000, () => {
        socket.destroy();
        warnings.push("SSL certificate check timed out");
        resolve({
          status: "warn",
          message: "SSL certificate check timed out",
          recommendation: "Verify SSL certificate manually",
        });
      });
    });
  } catch (error) {
    warnings.push("SSL certificate check failed");
    return {
      status: "warn",
      message: "SSL certificate check failed",
      recommendation: "Verify SSL certificate manually",
    };
  }
}

function checkMixedContent(
  $: cheerio.CheerioAPI,
  baseUrl: URL,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  if (baseUrl.protocol !== "https:") {
    return {
      status: "warn",
      message: "Mixed content check only applies to HTTPS sites",
      recommendation: "Enable HTTPS to check for mixed content",
    };
  }

  const mixedContentUrls: string[] = [];

  // Check images
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && src.startsWith("http://")) {
      mixedContentUrls.push(src);
    }
  });

  // Check scripts
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && src.startsWith("http://")) {
      mixedContentUrls.push(src);
    }
  });

  // Check stylesheets
  $("link[rel='stylesheet'][href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("http://")) {
      mixedContentUrls.push(href);
    }
  });

  // Check iframes
  $("iframe[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && src.startsWith("http://")) {
      mixedContentUrls.push(src);
    }
  });

  if (mixedContentUrls.length > 0) {
    failed.push(`Found ${mixedContentUrls.length} mixed content resource(s)`);
    return {
      status: "fail",
      message: `Found ${mixedContentUrls.length} mixed content resource(s)`,
      value: mixedContentUrls.length,
      recommendation: "Replace HTTP resources with HTTPS to prevent mixed content warnings",
    };
  }

  passed.push("No mixed content detected");
  return {
    status: "pass",
    message: "No mixed content detected",
    value: 0,
  };
}

function checkCookieSecurity(
  headers: Record<string, string | string[] | undefined>,
  passed: string[],
  warnings: string[],
  failed: string[]
): CheckResult {
  const setCookie = headers["set-cookie"];
  
  if (!setCookie) {
    return {
      status: "warn",
      message: "No cookies detected",
      recommendation: "If using cookies, ensure they have Secure, HttpOnly, and SameSite attributes",
    };
  }

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const issues: string[] = [];

  for (const cookie of cookies) {
    const lowerCookie = cookie.toLowerCase();
    if (!lowerCookie.includes("secure")) {
      issues.push("Cookie missing Secure flag");
    }
    if (!lowerCookie.includes("httponly")) {
      issues.push("Cookie missing HttpOnly flag");
    }
    if (!lowerCookie.includes("samesite")) {
      issues.push("Cookie missing SameSite attribute");
    }
  }

  if (issues.length > 0) {
    warnings.push(`Cookie security issues: ${issues.join(", ")}`);
    return {
      status: "warn",
      message: `Cookie security issues detected`,
      value: issues.length,
      recommendation: "Ensure all cookies have Secure, HttpOnly, and SameSite attributes",
    };
  }

  passed.push("Cookies are properly secured");
  return {
    status: "pass",
    message: "Cookies are properly secured",
    value: cookies.length,
  };
}
