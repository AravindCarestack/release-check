#!/usr/bin/env ts-node
/**
 * Test script for debugging crawler issues with voicestack.com
 * Run with: npx ts-node test-crawler.ts
 */

import { crawlWebsite } from "./lib/crawler";
import { discoverSitemap, parseSitemap } from "./lib/sitemap-parser";
import { canonicalizeUrl, shouldCrawlUrl, type NormalizeOptions } from "./lib/url-normalizer";
import axios from "axios";
import * as cheerio from "cheerio";

const TEST_URL = "https://www.voicestack.com";

async function testSitemapDiscovery() {
  console.log("\n=== Testing Sitemap Discovery ===");
  const baseUrl = new URL(TEST_URL);
  const sitemapUrl = await discoverSitemap(baseUrl, true);
  
  if (sitemapUrl) {
    console.log(`✓ Found sitemap: ${sitemapUrl}`);
    return sitemapUrl;
  } else {
    console.log("✗ No sitemap found");
    return null;
  }
}

async function testSitemapParsing(sitemapUrl: string | null) {
  console.log("\n=== Testing Sitemap Parsing ===");
  if (!sitemapUrl) {
    console.log("Skipping - no sitemap found");
    return [];
  }
  
  try {
    const urls = await parseSitemap(sitemapUrl, true);
    console.log(`✓ Parsed ${urls.length} URLs from sitemap`);
    if (urls.length > 0) {
      console.log("Sample URLs:");
      urls.slice(0, 10).forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`);
      });
    }
    return urls;
  } catch (error: any) {
    console.error(`✗ Failed to parse sitemap: ${error.message}`);
    return [];
  }
}

async function testUrlNormalization(sampleUrls: string[]) {
  console.log("\n=== Testing URL Normalization ===");
  const baseUrl = new URL(TEST_URL);
  const normalizeOptions: NormalizeOptions = {
    baseUrl,
    forceHttps: true,
    preserveWww: baseUrl.hostname.startsWith("www."),
  };
  
  console.log(`Base URL: ${baseUrl.href}`);
  console.log(`Normalize options:`, normalizeOptions);
  
  if (sampleUrls.length > 0) {
    console.log("\nTesting normalization on sample URLs:");
    sampleUrls.slice(0, 5).forEach(url => {
      const normalized = canonicalizeUrl(url, normalizeOptions);
      console.log(`  ${url} -> ${normalized || "FAILED"}`);
    });
  }
}

async function testShouldCrawlUrl(sampleUrls: string[]) {
  console.log("\n=== Testing shouldCrawlUrl ===");
  const baseUrl = new URL(TEST_URL);
  const normalizeOptions: NormalizeOptions = {
    baseUrl,
    forceHttps: true,
    preserveWww: baseUrl.hostname.startsWith("www."),
  };
  const hostname = baseUrl.hostname.toLowerCase();
  
  if (sampleUrls.length > 0) {
    console.log(`Base hostname: ${hostname}`);
    console.log("\nTesting shouldCrawlUrl on sample URLs:");
    let crawlable = 0;
    let notCrawlable = 0;
    
    sampleUrls.slice(0, 10).forEach(url => {
      const shouldCrawl = shouldCrawlUrl(url, hostname, normalizeOptions, true);
      if (shouldCrawl) {
        crawlable++;
        console.log(`  ✓ Should crawl: ${url}`);
      } else {
        notCrawlable++;
        console.log(`  ✗ Should NOT crawl: ${url}`);
      }
    });
    
    console.log(`\nSummary: ${crawlable} crawlable, ${notCrawlable} not crawlable`);
  }
}

async function testHtmlLinkExtraction() {
  console.log("\n=== Testing HTML Link Extraction ===");
  try {
    const response = await axios.get(TEST_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SEOValidator/1.0)",
      },
      timeout: 15000,
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Count links
    const anchorCount = $("a[href]").length;
    const linkCount = $('link[rel][href]').length;
    const formCount = $("form[action]").length;
    const scriptCount = $("script").length;
    const dataAttrCount = $("[data-url], [data-href], [data-link], [data-path]").length;
    
    console.log(`HTML Analysis:`);
    console.log(`  Anchor tags: ${anchorCount}`);
    console.log(`  Link tags: ${linkCount}`);
    console.log(`  Form tags: ${formCount}`);
    console.log(`  Script tags: ${scriptCount}`);
    console.log(`  Data attribute elements: ${dataAttrCount}`);
    
    // Show sample links
    console.log("\nSample anchor hrefs:");
    $("a[href]").slice(0, 10).each((i, el) => {
      const href = $(el).attr("href");
      console.log(`  ${i + 1}. ${href}`);
    });
    
    return html;
  } catch (error: any) {
    console.error(`✗ Failed to fetch homepage: ${error.message}`);
    return null;
  }
}

async function testFullCrawl() {
  console.log("\n=== Testing Full Crawl ===");
  console.log(`Crawling: ${TEST_URL}`);
  console.log("This may take a while...\n");
  
  try {
    const result = await crawlWebsite(TEST_URL, {
      maxPages: 50, // Limit for testing
      maxConcurrent: 5,
      timeout: 15000,
      debug: true, // Enable debug logging
    });
    
    console.log("\n=== Crawl Results ===");
    console.log(`Total pages crawled: ${result.pages.length}`);
    console.log(`Statistics:`, result.statistics);
    
    console.log("\nCrawled URLs:");
    result.pages.forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.url} (status: ${page.statusCode})`);
    });
    
    if (result.statistics.crawlErrors.length > 0) {
      console.log("\nErrors:");
      result.statistics.crawlErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    return result;
  } catch (error: any) {
    console.error(`✗ Crawl failed: ${error.message}`);
    console.error(error.stack);
    return null;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Crawler Test for voicestack.com");
  console.log("=".repeat(60));
  
  // Test 1: Sitemap discovery
  const sitemapUrl = await testSitemapDiscovery();
  
  // Test 2: Sitemap parsing
  const sitemapUrls = await testSitemapParsing(sitemapUrl);
  
  // Test 3: URL normalization
  await testUrlNormalization(sitemapUrls.length > 0 ? sitemapUrls : [TEST_URL]);
  
  // Test 4: shouldCrawlUrl
  await testShouldCrawlUrl(sitemapUrls.length > 0 ? sitemapUrls : [TEST_URL]);
  
  // Test 5: HTML link extraction
  await testHtmlLinkExtraction();
  
  // Test 6: Full crawl
  await testFullCrawl();
  
  console.log("\n" + "=".repeat(60));
  console.log("Test Complete");
  console.log("=".repeat(60));
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
