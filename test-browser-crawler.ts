#!/usr/bin/env ts-node
/**
 * Test script for browser-based crawler on voicestack.com
 * Run with: npx ts-node test-browser-crawler.ts
 */

import { crawlWebsite } from "./lib/crawler-browser";

const TEST_URL = "https://www.voicestack.com";

async function main() {
  console.log("=".repeat(60));
  console.log("Browser-Based Crawler Test for voicestack.com");
  console.log("=".repeat(60));
  console.log(`\nCrawling: ${TEST_URL}`);
  console.log("Using headless Chromium to fully render pages...\n");
  
  try {
    const result = await crawlWebsite(TEST_URL, {
      maxPages: 50, // Limit for testing
      timeout: 30000,
      debug: true, // Enable debug logging
      headless: true, // Set to false to see browser
    });
    
    console.log("\n" + "=".repeat(60));
    console.log("Crawl Results");
    console.log("=".repeat(60));
    console.log(`\nTotal pages crawled: ${result.pages.length}`);
    console.log(`\nStatistics:`);
    console.log(`  - Sitemap found: ${result.statistics.sitemapFound}`);
    if (result.statistics.sitemapUrl) {
      console.log(`  - Sitemap URL: ${result.statistics.sitemapUrl}`);
    }
    console.log(`  - Sitemap URLs: ${result.statistics.sitemapUrlCount}`);
    console.log(`  - HTML discovered: ${result.statistics.htmlDiscoveredCount}`);
    console.log(`  - Total discovered: ${result.statistics.totalDiscovered}`);
    console.log(`  - Total crawled: ${result.statistics.totalCrawled}`);
    console.log(`  - Errors: ${result.statistics.crawlErrors.length}`);
    
    if (result.statistics.crawlErrors.length > 0) {
      console.log(`\nErrors:`);
      result.statistics.crawlErrors.slice(0, 10).forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    console.log(`\nCrawled URLs (${result.pages.length}):`);
    result.pages.forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.url} (status: ${page.statusCode})`);
    });
    
    // Verify we found inner pages
    const innerPages = result.pages.filter(p => {
      const url = new URL(p.url);
      return url.pathname !== "/" && url.pathname !== "";
    });
    
    console.log(`\n✓ Found ${innerPages.length} inner pages (excluding root)`);
    if (innerPages.length > 0) {
      console.log("\nInner pages:");
      innerPages.forEach((page, i) => {
        console.log(`  ${i + 1}. ${page.url}`);
      });
    } else {
      console.log("\n⚠ WARNING: No inner pages found! This might indicate an issue.");
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("Test Complete");
    console.log("=".repeat(60));
    
  } catch (error: any) {
    console.error("\n✗ Crawl failed:");
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
