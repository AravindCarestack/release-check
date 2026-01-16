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
  const processedScripts = new Set<number>(); // Track processed scripts to avoid duplicates

  // Find all script tags and check for JSON-LD
  $('script').each((index, element) => {
    const $element = $(element);
    const type = $element.attr("type");
    const content = $element.html() || $element.text(); // Try both html() and text()
    
    if (!content || !content.trim()) {
      return; // Skip empty scripts
    }

    const trimmed = content.trim();
    
    // Check if type attribute indicates JSON-LD (case-insensitive)
    const isJsonLdType = type && type.toLowerCase().includes("application/ld+json");
    
    // Check if content looks like JSON-LD (starts with { or [ and contains @context or @type)
    const looksLikeJsonLd = (trimmed.startsWith("{") || trimmed.startsWith("[")) && 
                            (trimmed.includes("@context") || trimmed.includes("@type"));

    // If it's explicitly marked as JSON-LD or looks like JSON-LD
    if (isJsonLdType || looksLikeJsonLd) {
      // Avoid duplicates by checking if we've already processed this script
      if (!processedScripts.has(index)) {
        jsonLdScripts.push(trimmed);
        processedScripts.add(index);
      }
    }
  });

  if (jsonLdScripts.length === 0) {
    return { valid: false, count: 0, errors: [] };
  }

  for (const jsonContent of jsonLdScripts) {
    count++;
    try {
      // Clean up the JSON content - remove any HTML comments or extra whitespace
      let cleanedContent = jsonContent.trim();
      
      // Remove HTML comments if present
      cleanedContent = cleanedContent.replace(/<!--[\s\S]*?-->/g, '');
      
      // Try to parse the JSON
      const parsed = JSON.parse(cleanedContent);
      
      // Basic validation - check if it's an object or array
      if (typeof parsed !== "object" || parsed === null) {
        valid = false;
        errors.push(`JSON-LD ${count}: Not a valid object or array`);
        continue;
      }
      
      // Validate JSON-LD structure
      let hasValidStructure = false;
      
      if (Array.isArray(parsed)) {
        // If it's an array, check each element
        if (parsed.length === 0) {
          valid = false;
          errors.push(`JSON-LD ${count}: Empty array`);
          continue;
        }
        
        // Check if at least one element has @context or @type
        hasValidStructure = parsed.some((item: any) => 
          item && typeof item === "object" && (item["@context"] || item["@type"])
        );
        
        if (!hasValidStructure) {
          // Might still be valid, but warn
          errors.push(`JSON-LD ${count}: Array elements missing @context or @type`);
        }
      } else {
        // Single object - check for @context or @type
        hasValidStructure = !!(parsed["@context"] || parsed["@type"]);
        
        if (!hasValidStructure) {
          // Might still be valid JSON-LD, but missing common properties
          // Don't mark as invalid, just note it
          errors.push(`JSON-LD ${count}: Missing @context or @type (may still be valid)`);
        }
      }
      
      // If we got here and it's valid JSON, consider it valid even if structure is questionable
      // (some JSON-LD might not have @context/@type in all cases)
      
    } catch (error: any) {
      valid = false;
      const errorMessage = error.message || "Unknown parsing error";
      errors.push(`JSON-LD ${count}: ${errorMessage}`);
    }
  }

  // If we have at least one valid JSON-LD script, consider it valid overall
  // (even if some have errors, others might be fine)
  if (count > 0 && errors.length < count) {
    valid = true;
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
  if (jsonLdResult.count === 0) {
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
