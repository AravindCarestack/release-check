import axios from "axios";
import * as cheerio from "cheerio";
import type {
  SEOAnalysisResult,
  MetaTagCheck,
  OpenGraphCheck,
  TwitterCheck,
  RobotsCheck,
  LinksCheck,
  TechnicalCheck,
  CheckResult,
  BrokenLink,
} from "@/app/types";

const TIMEOUT = 30000; // 30 seconds
const MAX_REDIRECTS = 5;

export async function analyzeWebsite(url: string): Promise<SEOAnalysisResult> {
  const passed: string[] = [];
  const warnings: string[] = [];
  const failed: string[] = [];

  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    // Fetch HTML
    const { html, finalUrl, statusCode, isHttps, httpRedirects } = await fetchHtml(normalizedUrl);
    const $ = cheerio.load(html);
    const baseUrl = new URL(finalUrl);

    // Analyze meta tags
    const metaTags = analyzeMetaTags($, passed, warnings, failed);

    // Analyze Open Graph
    const openGraph = analyzeOpenGraph($, passed, warnings, failed);

    // Analyze Twitter Cards
    const twitter = analyzeTwitter($, passed, warnings, failed);

    // Analyze robots
    const robots = await analyzeRobots(baseUrl, $, passed, warnings, failed);

    // Analyze links
    const links = await analyzeLinks($, baseUrl, passed, warnings, failed);

    // Analyze technical SEO
    const technical = analyzeTechnical($, {
      isHttps,
      httpRedirects,
      statusCode,
    }, passed, warnings, failed);

    // Calculate score
    const score = calculateScore(passed, warnings, failed);

    return {
      score,
      passed,
      warnings,
      failed,
      details: {
        metaTags,
        openGraph,
        twitter,
        robots,
        links,
        technical,
      },
    };
  } catch (error: any) {
    throw new Error(`Failed to analyze website: ${error.message}`);
  }
}

async function fetchHtml(url: string): Promise<{
  html: string;
  finalUrl: string;
  statusCode: number;
  isHttps: boolean;
  httpRedirects: boolean;
}> {
  let currentUrl = url;
  let redirectCount = 0;
  let httpRedirects = false;

  // Check if initial URL is HTTP
  const initialIsHttp = url.startsWith("http://");
  if (initialIsHttp) {
    httpRedirects = true;
  }

  while (redirectCount < MAX_REDIRECTS) {
    try {
      const response = await axios.get(currentUrl, {
        timeout: TIMEOUT,
        maxRedirects: 0,
        validateStatus: (status) => status < 400 || status >= 300,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
        },
      });

      // Handle redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        if (location) {
          redirectCount++;
          currentUrl = new URL(location, currentUrl).href;
          if (currentUrl.startsWith("http://") && !currentUrl.startsWith("https://")) {
            httpRedirects = true;
          }
          continue;
        }
      }

      // Success response
      if (response.status === 200) {
        return {
          html: response.data,
          finalUrl: currentUrl,
          statusCode: response.status,
          isHttps: currentUrl.startsWith("https://"),
          httpRedirects,
        };
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error: any) {
      if (error.response) {
        // Got a response but with error status
        if (error.response.status >= 300 && error.response.status < 400) {
          const location = error.response.headers.location;
          if (location) {
            redirectCount++;
            currentUrl = new URL(location, currentUrl).href;
            continue;
          }
        }
        throw new Error(`HTTP ${error.response.status}`);
      }
      throw error;
    }
  }

  throw new Error("Too many redirects");
}

function analyzeMetaTags(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): MetaTagCheck {
  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content") || "";
  const robots = $('meta[name="robots"]').attr("content") || "";
  const canonical = $('link[rel="canonical"]').attr("href") || "";

  const checks: MetaTagCheck = {
    title: checkTitle(title, passed, warnings, failed),
    description: checkDescription(description, passed, warnings, failed),
    robots: checkRobotsMeta(robots, passed, warnings, failed),
    canonical: checkCanonical(canonical, passed, warnings, failed),
  };

  return checks;
}

function checkTitle(title: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!title) {
    failed.push("Missing <title> tag");
    return {
      status: "fail",
      message: "Title tag is missing",
      recommendation: "Add a descriptive <title> tag to your HTML head section",
    };
  }
  if (title.length < 30) {
    warnings.push("Title tag is too short");
    return {
      status: "warn",
      message: `Title tag is too short (${title.length} characters)`,
      value: title,
      recommendation: "Aim for 30-60 characters for optimal SEO",
    };
  }
  if (title.length > 60) {
    warnings.push("Title tag is too long");
    return {
      status: "warn",
      message: `Title tag is too long (${title.length} characters)`,
      value: title,
      recommendation: "Keep title under 60 characters to avoid truncation",
    };
  }
  passed.push("Title tag is present and well-formatted");
  return {
    status: "pass",
    message: "Title tag is present and well-formatted",
    value: title,
  };
}

function checkDescription(description: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!description) {
    failed.push("Missing meta description");
    return {
      status: "fail",
      message: "Meta description is missing",
      recommendation: "Add a <meta name='description' content='...'> tag",
    };
  }
  if (description.length < 120) {
    warnings.push("Meta description is too short");
    return {
      status: "warn",
      message: `Meta description is too short (${description.length} characters)`,
      value: description,
      recommendation: "Aim for 120-160 characters for optimal SEO",
    };
  }
  if (description.length > 160) {
    warnings.push("Meta description is too long");
    return {
      status: "warn",
      message: `Meta description is too long (${description.length} characters)`,
      value: description,
      recommendation: "Keep description under 160 characters",
    };
  }
  passed.push("Meta description is present and well-formatted");
  return {
    status: "pass",
    message: "Meta description is present and well-formatted",
    value: description,
  };
}

function checkRobotsMeta(robots: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!robots) {
    warnings.push("No meta robots tag found");
    return {
      status: "warn",
      message: "No meta robots tag found",
      recommendation: "Consider adding a meta robots tag for better control",
    };
  }
  if (robots.toLowerCase().includes("noindex")) {
    failed.push("Meta robots contains 'noindex'");
    return {
      status: "fail",
      message: "Meta robots contains 'noindex'",
      value: robots,
      recommendation: "Remove 'noindex' to allow search engines to index your page",
    };
  }
  passed.push("Meta robots tag is properly configured");
  return {
    status: "pass",
    message: "Meta robots tag is properly configured",
    value: robots,
  };
}

function checkCanonical(canonical: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!canonical) {
    warnings.push("No canonical URL found");
    return {
      status: "warn",
      message: "No canonical URL found",
      recommendation: "Add a canonical link to prevent duplicate content issues",
    };
  }
  passed.push("Canonical URL is present");
  return {
    status: "pass",
    message: "Canonical URL is present",
    value: canonical,
  };
}

function analyzeOpenGraph(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): OpenGraphCheck {
  const ogTitle = $('meta[property="og:title"]').attr("content") || "";
  const ogDescription = $('meta[property="og:description"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || "";
  const ogUrl = $('meta[property="og:url"]').attr("content") || "";
  const ogType = $('meta[property="og:type"]').attr("content") || "";

  const checks: OpenGraphCheck = {
    title: checkOGTag("og:title", ogTitle, passed, warnings, failed),
    description: checkOGTag("og:description", ogDescription, passed, warnings, failed),
    image: checkOGTag("og:image", ogImage, passed, warnings, failed),
    url: checkOGTag("og:url", ogUrl, passed, warnings, failed),
    type: checkOGTag("og:type", ogType, passed, warnings, failed),
  };

  return checks;
}

function checkOGTag(tag: string, value: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!value) {
    warnings.push(`Missing ${tag}`);
    return {
      status: "warn",
      message: `${tag} is missing`,
      recommendation: `Add <meta property="${tag}" content="..."> for better social media sharing`,
    };
  }
  passed.push(`${tag} is present`);
  return {
    status: "pass",
    message: `${tag} is present`,
    value,
  };
}

function analyzeTwitter(
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): TwitterCheck {
  const twitterCard = $('meta[name="twitter:card"]').attr("content") || "";
  const twitterTitle = $('meta[name="twitter:title"]').attr("content") || "";
  const twitterDescription = $('meta[name="twitter:description"]').attr("content") || "";
  const twitterImage = $('meta[name="twitter:image"]').attr("content") || "";

  const checks: TwitterCheck = {
    card: checkTwitterCard(twitterCard, passed, warnings, failed),
    title: checkTwitterTag("twitter:title", twitterTitle, passed, warnings, failed),
    description: checkTwitterTag("twitter:description", twitterDescription, passed, warnings, failed),
    image: checkTwitterTag("twitter:image", twitterImage, passed, warnings, failed),
  };

  return checks;
}

function checkTwitterCard(card: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!card) {
    warnings.push("Missing twitter:card");
    return {
      status: "warn",
      message: "Twitter card type is missing",
      recommendation: "Add <meta name='twitter:card' content='summary_large_image'>",
    };
  }
  if (card !== "summary_large_image" && card !== "summary") {
    warnings.push(`Twitter card type is '${card}', prefer 'summary_large_image'`);
    return {
      status: "warn",
      message: `Twitter card type is '${card}'`,
      value: card,
      recommendation: "Use 'summary_large_image' for better visual presentation",
    };
  }
  passed.push("Twitter card is properly configured");
  return {
    status: "pass",
    message: "Twitter card is properly configured",
    value: card,
  };
}

function checkTwitterTag(tag: string, value: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!value) {
    warnings.push(`Missing ${tag}`);
    return {
      status: "warn",
      message: `${tag} is missing`,
      recommendation: `Add <meta name="${tag}" content="..."> for better Twitter sharing`,
    };
  }
  passed.push(`${tag} is present`);
  return {
    status: "pass",
    message: `${tag} is present`,
    value,
  };
}

async function analyzeRobots(
  baseUrl: URL,
  $: cheerio.CheerioAPI,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<RobotsCheck> {
  const robotsUrl = new URL("/robots.txt", baseUrl).href;
  let robotsTxtExists = false;
  let disallowAll = false;
  let sitemapReference = false;

  try {
    const robotsResponse = await axios.get(robotsUrl, {
      timeout: 10000,
      validateStatus: (status) => status === 200,
    });
    robotsTxtExists = true;
    const robotsContent = robotsResponse.data.toLowerCase();
    disallowAll = robotsContent.includes("disallow: /");
    sitemapReference = robotsContent.includes("sitemap:");
  } catch {
    // robots.txt doesn't exist or is inaccessible
  }

  const robotsMeta = $('meta[name="robots"]').attr("content") || "";
  const noindexMeta = robotsMeta.toLowerCase().includes("noindex");

  const checks: RobotsCheck = {
    robotsTxtExists: checkRobotsTxt(robotsTxtExists, passed, warnings, failed),
    disallowAll: checkDisallowAll(disallowAll, passed, warnings, failed),
    sitemapReference: checkSitemapReference(sitemapReference, passed, warnings, failed),
    noindexMeta: checkNoindexMeta(noindexMeta, passed, warnings, failed),
  };

  return checks;
}

function checkRobotsTxt(exists: boolean, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!exists) {
    warnings.push("robots.txt not found");
    return {
      status: "warn",
      message: "robots.txt file is missing",
      recommendation: "Create a robots.txt file at the root of your domain",
    };
  }
  passed.push("robots.txt exists");
  return {
    status: "pass",
    message: "robots.txt file exists",
    value: true,
  };
}

function checkDisallowAll(disallowAll: boolean, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (disallowAll) {
    failed.push("robots.txt disallows all crawlers");
    return {
      status: "fail",
      message: "robots.txt contains 'Disallow: /'",
      recommendation: "Remove 'Disallow: /' to allow search engines to crawl your site",
    };
  }
  passed.push("robots.txt does not disallow all");
  return {
    status: "pass",
    message: "robots.txt does not disallow all crawlers",
    value: false,
  };
}

function checkSitemapReference(hasSitemap: boolean, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!hasSitemap) {
    warnings.push("No sitemap reference in robots.txt");
    return {
      status: "warn",
      message: "No sitemap reference found in robots.txt",
      recommendation: "Add 'Sitemap: https://yourdomain.com/sitemap.xml' to robots.txt",
    };
  }
  passed.push("Sitemap reference found in robots.txt");
  return {
    status: "pass",
    message: "Sitemap reference found in robots.txt",
    value: true,
  };
}

function checkNoindexMeta(noindex: boolean, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (noindex) {
    failed.push("Meta robots contains 'noindex'");
    return {
      status: "fail",
      message: "Meta robots tag contains 'noindex'",
      recommendation: "Remove 'noindex' from meta robots tag to allow indexing",
    };
  }
  passed.push("Meta robots does not contain 'noindex'");
  return {
    status: "pass",
    message: "Meta robots tag allows indexing",
    value: false,
  };
}

async function analyzeLinks(
  $: cheerio.CheerioAPI,
  baseUrl: URL,
  passed: string[],
  warnings: string[],
  failed: string[]
): Promise<LinksCheck> {
  const links: { href: string; type: "internal" | "external" }[] = [];
  const brokenLinks: BrokenLink[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) {
      return;
    }

    try {
      const linkUrl = new URL(href, baseUrl);
      const isInternal = linkUrl.hostname === baseUrl.hostname;
      links.push({ href: linkUrl.href, type: isInternal ? "internal" : "external" });
    } catch {
      // Invalid URL, skip
    }
  });

  // Check a sample of links for broken ones (limit to 20 to avoid timeout)
  const linksToCheck = links.slice(0, 20);
  for (const link of linksToCheck) {
    try {
      const response = await axios.head(link.href, {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      });
      if (response.status >= 400) {
        brokenLinks.push({
          url: link.href,
          status: response.status,
          type: link.type,
        });
      }
    } catch {
      // Link check failed, consider it broken
      brokenLinks.push({
        url: link.href,
        status: 0,
        type: link.type,
      });
    }
  }

  const internalLinks = links.filter((l) => l.type === "internal").length;
  const externalLinks = links.filter((l) => l.type === "external").length;

  if (brokenLinks.length > 0) {
    warnings.push(`Found ${brokenLinks.length} broken link(s)`);
  } else {
    passed.push("No broken links detected");
  }

  return {
    totalLinks: links.length,
    internalLinks,
    externalLinks,
    brokenLinks,
  };
}

function analyzeTechnical(
  $: cheerio.CheerioAPI,
  fetchInfo: { isHttps: boolean; httpRedirects: boolean; statusCode: number },
  passed: string[],
  warnings: string[],
  failed: string[]
): TechnicalCheck {
  const viewport = $('meta[name="viewport"]').attr("content") || "";
  const charset = $("meta[charset]").attr("charset") || $('meta[http-equiv="Content-Type"]').attr("content") || "";
  const h1Elements = $("h1");
  const h1Count = h1Elements.length;

  const checks: TechnicalCheck = {
    httpsEnabled: checkHttps(fetchInfo.isHttps, passed, warnings, failed),
    httpRedirect: checkHttpRedirect(fetchInfo.httpRedirects, passed, warnings, failed),
    statusCode: checkStatusCode(fetchInfo.statusCode, passed, warnings, failed),
    viewport: checkViewport(viewport, passed, warnings, failed),
    charset: checkCharset(charset, passed, warnings, failed),
    h1Count: checkH1Count(h1Count, passed, warnings, failed),
    multipleH1: checkMultipleH1(h1Count, passed, warnings, failed),
  };

  return checks;
}

function checkHttps(isHttps: boolean, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!isHttps) {
    failed.push("HTTPS is not enabled");
    return {
      status: "fail",
      message: "Site is not using HTTPS",
      recommendation: "Enable HTTPS/SSL certificate for your domain",
    };
  }
  passed.push("HTTPS is enabled");
  return {
    status: "pass",
    message: "HTTPS is enabled",
    value: true,
  };
}

function checkHttpRedirect(httpRedirects: boolean, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (httpRedirects) {
    warnings.push("HTTP redirects to HTTPS detected");
    return {
      status: "warn",
      message: "HTTP redirects to HTTPS",
      value: true,
      recommendation: "Ensure all HTTP traffic redirects to HTTPS",
    };
  }
  passed.push("No HTTP redirects detected (HTTPS only)");
  return {
    status: "pass",
    message: "No HTTP redirects detected",
    value: false,
  };
}

function checkStatusCode(statusCode: number, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (statusCode !== 200) {
    failed.push(`Page returns HTTP ${statusCode}`);
    return {
      status: "fail",
      message: `Page returns HTTP ${statusCode}`,
      value: statusCode,
      recommendation: "Ensure the page returns HTTP 200 status code",
    };
  }
  passed.push("Page returns HTTP 200");
  return {
    status: "pass",
    message: "Page returns HTTP 200",
    value: statusCode,
  };
}

function checkViewport(viewport: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!viewport) {
    failed.push("Missing viewport meta tag");
    return {
      status: "fail",
      message: "Viewport meta tag is missing",
      recommendation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'>",
    };
  }
  passed.push("Viewport meta tag is present");
  return {
    status: "pass",
    message: "Viewport meta tag is present",
    value: viewport,
  };
}

function checkCharset(charset: string, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (!charset) {
    failed.push("Missing charset declaration");
    return {
      status: "fail",
      message: "Charset meta tag is missing",
      recommendation: "Add <meta charset='UTF-8'> to your HTML head",
    };
  }
  passed.push("Charset is declared");
  return {
    status: "pass",
    message: "Charset is declared",
    value: charset,
  };
}

function checkH1Count(count: number, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (count === 0) {
    failed.push("No H1 tag found");
    return {
      status: "fail",
      message: "No H1 tag found on the page",
      recommendation: "Add at least one H1 tag with your main heading",
    };
  }
  passed.push(`Found ${count} H1 tag(s)`);
  return {
    status: "pass",
    message: `Found ${count} H1 tag(s)`,
    value: count,
  };
}

function checkMultipleH1(count: number, passed: string[], warnings: string[], failed: string[]): CheckResult {
  if (count > 1) {
    warnings.push(`Multiple H1 tags found (${count})`);
    return {
      status: "warn",
      message: `Multiple H1 tags found (${count})`,
      value: count,
      recommendation: "Use only one H1 tag per page for better SEO",
    };
  }
  passed.push("Single H1 tag found");
  return {
    status: "pass",
    message: "Single H1 tag found",
    value: count === 1,
  };
}

function calculateScore(passed: string[], warnings: string[], failed: string[]): number {
  const total = passed.length + warnings.length + failed.length;
  if (total === 0) return 0;

  const passWeight = 1;
  const warnWeight = 0.5;
  const failWeight = 0;

  const score = ((passed.length * passWeight + warnings.length * warnWeight) / total) * 100;
  return Math.round(score);
}
