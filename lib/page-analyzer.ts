import * as cheerio from "cheerio";
import type { CheckResult } from "@/app/types";

export interface PageReport {
  url: string;
  h1Count: number;
  h1Texts: string[];
  hasSingleH1: boolean;
  headingCounts: {
    h2: number;
    h3: number;
    h4: number;
    h5: number;
    h6: number;
  };
  meta: {
    title: string | null;
    description: string | null;
    robots: string | null;
    canonical: string | null;
  };
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
  };
  twitter: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
  };
  jsonLd: {
    present: boolean;
    valid: boolean;
    count: number;
    errors: string[];
  };
  sitemap: {
    present: boolean;
    url: string | null;
  };
  issues: string[];
  status: "pass" | "warn" | "fail";
}

/**
 * Validates JSON-LD structured data
 */
function validateJsonLd(html: string): { valid: boolean; count: number; errors: string[] } {
  const errors: string[] = [];
  let count = 0;
  let valid = true;

  // Use Cheerio to find script tags more reliably
  const $ = cheerio.load(html);
  const jsonLdScripts: string[] = [];

  // Find all script tags with type="application/ld+json"
  $('script[type="application/ld+json"]').each((_, element) => {
    const content = $(element).html();
    if (content && content.trim()) {
      jsonLdScripts.push(content.trim());
    }
  });

  // Also check for script tags without explicit type but with JSON-LD content
  $('script').each((_, element) => {
    const type = $(element).attr("type");
    const content = $(element).html();
    
    // If no type specified, check if content looks like JSON-LD
    if (!type && content && content.trim()) {
      const trimmed = content.trim();
      if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && 
          (trimmed.includes("@context") || trimmed.includes("@type"))) {
        jsonLdScripts.push(trimmed);
      }
    }
  });

  if (jsonLdScripts.length === 0) {
    return { valid: false, count: 0, errors: [] };
  }

  for (const jsonContent of jsonLdScripts) {
    count++;
    try {
      const parsed = JSON.parse(jsonContent);
      
      // Basic validation - check if it's an object or array
      if (typeof parsed !== "object" || parsed === null) {
        valid = false;
        errors.push(`JSON-LD ${count}: Not a valid object or array`);
      } else {
        // Additional validation - check for @context or @type (common JSON-LD properties)
        if (Array.isArray(parsed)) {
          // If it's an array, check first element
          if (parsed.length > 0 && typeof parsed[0] === "object" && 
              (!parsed[0]["@context"] && !parsed[0]["@type"])) {
            // Not necessarily invalid, but might not be JSON-LD
          }
        } else if (!parsed["@context"] && !parsed["@type"]) {
          // Might still be valid JSON-LD, but missing common properties
          // Don't mark as invalid, just note it
        }
      }
    } catch (error: any) {
      valid = false;
      errors.push(`JSON-LD ${count}: ${error.message}`);
    }
  }

  return { valid, count, errors };
}

/**
 * Analyzes a single page's SEO elements
 */
export function analyzePage(html: string, url: string, baseUrl?: URL): PageReport {
  const $ = cheerio.load(html);
  const issues: string[] = [];

  // Analyze H1 tags
  const h1Elements = $("h1");
  const h1Count = h1Elements.length;
  const h1Texts: string[] = [];
  h1Elements.each((_, el) => {
    const text = $(el).text().trim();
    if (text) h1Texts.push(text);
  });
  const hasSingleH1 = h1Count === 1;

  if (h1Count === 0) {
    issues.push("Missing H1 tag");
  } else if (h1Count > 1) {
    issues.push(`Multiple H1 tags found (${h1Count})`);
  }

  // Analyze H2-H6 tags
  const headingCounts = {
    h2: $("h2").length,
    h3: $("h3").length,
    h4: $("h4").length,
    h5: $("h5").length,
    h6: $("h6").length,
  };

  // Analyze meta tags
  const title = $("title").text().trim() || null;
  const description = $('meta[name="description"]').attr("content") || null;
  const robots = $('meta[name="robots"]').attr("content") || null;
  const canonical = $('link[rel="canonical"]').attr("href") || null;

  if (!title) {
    issues.push("Missing title tag");
  }
  if (!description) {
    issues.push("Missing meta description");
  }
  if (robots && robots.toLowerCase().includes("noindex")) {
    issues.push("Meta robots contains 'noindex'");
  }
  if (!canonical) {
    issues.push("Missing canonical URL");
  }

  // Analyze Open Graph tags
  const ogTitle = $('meta[property="og:title"]').attr("content") || null;
  const ogDescription = $('meta[property="og:description"]').attr("content") || null;
  const ogImage = $('meta[property="og:image"]').attr("content") || null;

  if (!ogTitle) {
    issues.push("Missing og:title");
  }
  if (!ogDescription) {
    issues.push("Missing og:description");
  }
  if (!ogImage) {
    issues.push("Missing og:image");
  }

  // Analyze Twitter Card tags
  const twitterCard = $('meta[name="twitter:card"]').attr("content") || null;
  const twitterTitle = $('meta[name="twitter:title"]').attr("content") || null;
  const twitterDescription = $('meta[name="twitter:description"]').attr("content") || null;
  const twitterImage = $('meta[name="twitter:image"]').attr("content") || null;

  if (!twitterCard) {
    issues.push("Missing twitter:card");
  }
  if (!twitterTitle) {
    issues.push("Missing twitter:title");
  }
  if (!twitterDescription) {
    issues.push("Missing twitter:description");
  }
  if (!twitterImage) {
    issues.push("Missing twitter:image");
  }

  // Analyze JSON-LD
  const jsonLdResult = validateJsonLd(html);
  if (!jsonLdResult.present) {
    issues.push("No JSON-LD structured data found");
  } else if (!jsonLdResult.valid) {
    issues.push(`Invalid JSON-LD: ${jsonLdResult.errors.join(", ")}`);
  }

  // Check for sitemap reference
  let sitemapUrl: string | null = null;
  let sitemapPresent = false;
  
  // Check in robots.txt (if baseUrl provided)
  if (baseUrl) {
    try {
      const robotsUrl = new URL("/robots.txt", baseUrl).href;
      // This will be checked at site level, not per page
      sitemapPresent = false; // Will be set during site-level analysis
    } catch {
      // Ignore
    }
  }
  
  // Check for sitemap link in HTML
  const sitemapLink = $('link[rel="sitemap"]').attr("href");
  if (sitemapLink) {
    sitemapPresent = true;
    try {
      sitemapUrl = new URL(sitemapLink, url).href;
    } catch {
      sitemapUrl = sitemapLink;
    }
  }

  // Determine status based on issue count
  let status: "pass" | "warn" | "fail";
  if (issues.length === 0) {
    status = "pass";
  } else if (issues.length <= 2) {
    status = "warn";
  } else {
    status = "fail";
  }

  return {
    url,
    h1Count,
    h1Texts,
    hasSingleH1,
    headingCounts,
    meta: {
      title,
      description,
      robots,
      canonical,
    },
    og: {
      title: ogTitle,
      description: ogDescription,
      image: ogImage,
    },
    twitter: {
      card: twitterCard,
      title: twitterTitle,
      description: twitterDescription,
      image: twitterImage,
    },
    jsonLd: {
      present: jsonLdResult.count > 0,
      valid: jsonLdResult.valid,
      count: jsonLdResult.count,
      errors: jsonLdResult.errors,
    },
    sitemap: {
      present: sitemapPresent,
      url: sitemapUrl,
    },
    issues,
    status,
  };
}
