#!/usr/bin/env ts-node
import { discoverSitemap, parseSitemap } from "./lib/sitemap-parser";
import { canonicalizeUrl, shouldCrawlUrl, type NormalizeOptions } from "./lib/url-normalizer";

async function test() {
  const baseUrl = new URL("https://www.voicestack.com");
  console.log("Testing sitemap for:", baseUrl.href);
  
  // Test discovery
  console.log("\n=== Discovering Sitemap ===");
  const sitemapUrl = await discoverSitemap(baseUrl, true);
  console.log("Sitemap URL:", sitemapUrl);
  
  if (!sitemapUrl) {
    console.log("No sitemap found!");
    return;
  }
  
  // Test parsing
  console.log("\n=== Parsing Sitemap ===");
  const urls = await parseSitemap(sitemapUrl, true);
  console.log(`Total URLs in sitemap: ${urls.length}`);
  console.log("\nFirst 10 URLs:");
  urls.slice(0, 10).forEach((url, i) => {
    console.log(`${i + 1}. ${url}`);
  });
  
  // Test normalization
  console.log("\n=== Testing URL Normalization ===");
  const normalizeOptions: NormalizeOptions = {
    baseUrl,
    forceHttps: true,
    preserveWww: baseUrl.hostname.startsWith("www."),
  };
  const hostname = baseUrl.hostname.toLowerCase();
  
  console.log(`Base hostname: ${hostname}`);
  console.log(`Normalize options:`, normalizeOptions);
  
  let crawlable = 0;
  let notCrawlable = 0;
  
  console.log("\n=== Testing shouldCrawlUrl ===");
  urls.slice(0, 20).forEach((url, i) => {
    const shouldCrawl = shouldCrawlUrl(url, hostname, normalizeOptions, true);
    const normalized = canonicalizeUrl(url, normalizeOptions);
    
    if (shouldCrawl && normalized) {
      crawlable++;
      if (crawlable <= 5) {
        console.log(`✓ ${i + 1}. ${url} -> ${normalized}`);
      }
    } else {
      notCrawlable++;
      if (notCrawlable <= 5) {
        console.log(`✗ ${i + 1}. ${url} (normalized: ${normalized || "FAILED"})`);
      }
    }
  });
  
  console.log(`\nSummary: ${crawlable} crawlable, ${notCrawlable} not crawlable out of ${Math.min(20, urls.length)} tested`);
}

test().catch(console.error);
