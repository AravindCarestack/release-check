import axios, { type AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import { extractContentFromHtml } from "@/lib/content-extract";
import { visibleText } from "@/lib/visible-text";
import { ContentCheckError } from "@/lib/content-error";
import { assertPublicHttpUrl } from "@/lib/public-url";

const USER_AGENT = "Mozilla/5.0 (compatible; SEOValidator/1.0)";

export interface FetchedPage {
  html: string;
  finalUrl: string;
  title: string;
  renderedWith: "http" | "browser";
  warning?: string;
}

export async function fetchPublicPage(rawUrl: string): Promise<FetchedPage> {
  const start = assertPublicHttpUrl(rawUrl);
  const fetched = await fetchHtml(start.href);
  const visible = extractContentFromHtml(fetched.html, fetched.finalUrl);
  const textLength = visible.units.reduce((sum, unit) => sum + unit.text.length, 0);

  if (textLength >= 80) {
    return {
      ...fetched,
      title: pageTitle(fetched.html, fetched.finalUrl),
      renderedWith: "http",
    };
  }

  const rendered = await renderWithBrowser(fetched.finalUrl);
  if (rendered) {
    return {
      html: rendered.html,
      finalUrl: rendered.finalUrl,
      title: pageTitle(rendered.html, rendered.finalUrl),
      renderedWith: "browser",
    };
  }

  if (textLength < 40) {
    throw new ContentCheckError("No readable content was found on that page");
  }

  return {
    ...fetched,
    title: pageTitle(fetched.html, fetched.finalUrl),
    renderedWith: "http",
    warning:
      "The page returned very little text. If the copy loads with JavaScript, some of it may not have been compared.",
  };
}

async function fetchHtml(startUrl: string): Promise<{ html: string; finalUrl: string }> {
  let current = startUrl;

  for (let hop = 0; hop < 5; hop += 1) {
    assertPublicHttpUrl(current);
    let response: AxiosResponse<string>;
    try {
      response = await axios.get<string>(current, {
        timeout: 20000,
        maxRedirects: 0,
        maxContentLength: 2_000_000,
        responseType: "text",
        validateStatus: () => true,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (error) {
      throw new ContentCheckError(fetchErrorMessage(error));
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.location;
      if (!location || Array.isArray(location)) {
        throw new ContentCheckError("The page redirect had no destination");
      }
      current = new URL(location, current).href;
      continue;
    }

    if (response.status !== 200) {
      throw new ContentCheckError(`The page returned HTTP ${response.status}`);
    }

    const contentType = String(response.headers["content-type"] || "");
    const html = typeof response.data === "string" ? response.data : String(response.data);
    if (contentType && !/html|xml/i.test(contentType)) {
      throw new ContentCheckError("That URL did not return an HTML page");
    }
    return { html, finalUrl: current };
  }

  throw new ContentCheckError("The page redirected too many times");
}

async function renderWithBrowser(
  url: string
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const { default: puppeteer } = await import("puppeteer");
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    try {
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 8000 }).catch(() => undefined);
      const landed = page.url();
      assertPublicHttpUrl(landed);
      const html = await page.content();
      return { html, finalUrl: landed };
    } finally {
      await browser.close();
    }
  } catch {
    return null;
  }
}

function pageTitle(html: string, fallback: string): string {
  const $ = cheerio.load(html);
  const title = visibleText($("title").first().text());
  if (title) return title.slice(0, 180);
  const heading = $("h1").first().text().replace(/\s+/g, " ").trim();
  return heading.slice(0, 180) || fallback;
}

function fetchErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "The page could not be fetched";
  if (error.code === "ECONNABORTED") return "The page took too long to respond";
  if (error.code === "ENOTFOUND") return "That domain could not be found";
  return "The page could not be fetched";
}
