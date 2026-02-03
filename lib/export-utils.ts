import type { SEOAnalysisResult } from "@/app/types";
import type { PageReport } from "@/lib/page-analyzer";

/**
 * Escapes CSV field values
 */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts SEOAnalysisResult to CSV format
 */
export function exportSinglePageToCSV(result: SEOAnalysisResult, url: string): string {
  const rows: string[] = [];
  
  // Header
  rows.push("SEO Analysis Report");
  rows.push(`URL,${escapeCsvField(url)}`);
  rows.push(`Overall Score,${result.score}/100`);
  rows.push(`Passed Checks,${result.passed.length}`);
  rows.push(`Warnings,${result.warnings.length}`);
  rows.push(`Failed Checks,${result.failed.length}`);
  rows.push(""); // Empty row
  
  // Summary
  rows.push("Summary");
  rows.push("Category,Status,Message,Value,Recommendation");
  
  // Meta Tags
  Object.entries(result.details.metaTags).forEach(([key, check]) => {
    rows.push(`Meta Tags - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
  });
  
  // Open Graph
  Object.entries(result.details.openGraph).forEach(([key, check]) => {
    rows.push(`Open Graph - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
  });
  
  // Twitter
  Object.entries(result.details.twitter).forEach(([key, check]) => {
    rows.push(`Twitter - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
  });
  
  // Robots
  Object.entries(result.details.robots).forEach(([key, check]) => {
    rows.push(`Robots - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
  });
  
  // Links
  rows.push(`Links - Total Links,info,Total links found,${result.details.links.totalLinks},`);
  rows.push(`Links - Internal Links,info,Internal links,${result.details.links.internalLinks},`);
  rows.push(`Links - External Links,info,External links,${result.details.links.externalLinks},`);
  if (result.details.links.brokenLinks.length > 0) {
    rows.push("Links - Broken Links");
    result.details.links.brokenLinks.forEach(link => {
      rows.push(`Broken Link,${link.type},${escapeCsvField(link.url)},Status: ${link.status},`);
    });
  }
  
  // Technical
  Object.entries(result.details.technical).forEach(([key, check]) => {
    rows.push(`Technical - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
  });
  
  // Performance
  if (result.details.performance) {
    Object.entries(result.details.performance).forEach(([key, check]) => {
      rows.push(`Performance - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
    });
  }
  
  // Security
  if (result.details.security) {
    Object.entries(result.details.security).forEach(([key, check]) => {
      rows.push(`Security - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
    });
  }
  
  // Accessibility
  if (result.details.accessibility) {
    Object.entries(result.details.accessibility).forEach(([key, check]) => {
      rows.push(`Accessibility - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
    });
  }
  
  // Analytics
  if (result.details.analytics) {
    Object.entries(result.details.analytics).forEach(([key, check]) => {
      rows.push(`Analytics - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
    });
  }
  
  // Caching
  if (result.details.caching) {
    Object.entries(result.details.caching).forEach(([key, check]) => {
      rows.push(`Caching - ${key},${check.status},${escapeCsvField(check.message)},${escapeCsvField(check.value?.toString())},${escapeCsvField(check.recommendation)}`);
    });
  }
  
  return rows.join("\n");
}

/**
 * Converts PageReport array to CSV format
 */
export function exportCrawlResultsToCSV(pages: PageReport[]): string {
  const rows: string[] = [];
  
  // Header
  rows.push("SEO Crawl Analysis Report");
  rows.push(`Total Pages,${pages.length}`);
  rows.push(`Generated,${new Date().toISOString()}`);
  rows.push(""); // Empty row
  
  // Column headers
  rows.push("URL,Status,H1 Count,H1 Text,Title,Meta Description,Canonical,OG Title,OG Description,OG Image,Twitter Card,JSON-LD Present,JSON-LD Valid,Issues");
  
  // Data rows
  pages.forEach(page => {
    const issues = page.issues.join("; ");
    const h1Text = page.h1Texts.join("; ");
    rows.push([
      escapeCsvField(page.url),
      page.status,
      page.h1Count,
      escapeCsvField(h1Text),
      escapeCsvField(page.meta.title),
      escapeCsvField(page.meta.description),
      escapeCsvField(page.meta.canonical),
      escapeCsvField(page.og.title),
      escapeCsvField(page.og.description),
      escapeCsvField(page.og.image),
      escapeCsvField(page.twitter.card),
      page.jsonLd.present ? "Yes" : "No",
      page.jsonLd.valid ? "Yes" : "No",
      escapeCsvField(issues)
    ].join(","));
  });
  
  return rows.join("\n");
}

/**
 * Downloads CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Generates PDF from SEOAnalysisResult
 */
export async function exportSinglePageToPDF(result: SEOAnalysisResult, url: string): Promise<void> {
  // Dynamic import to avoid SSR issues
  const { jsPDF } = await import("jspdf");
  
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  
  // Helper to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    
    const lines = doc.splitTextToSize(text, maxWidth);
    if (yPos + (lines.length * fontSize * 0.4) > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(lines, margin, yPos);
    yPos += lines.length * fontSize * 0.4 + 5;
  };
  
  // Title
  addText("SEO Analysis Report", 18, true, [0, 0, 0]);
  yPos += 5;
  
  // URL
  addText(`URL: ${url}`, 10, false, [0, 0, 255]);
  yPos += 5;
  
  // Score
  const scoreColor = result.score >= 80 ? [0, 128, 0] : result.score >= 60 ? [255, 165, 0] : [255, 0, 0];
  addText(`Overall SEO Score: ${result.score}/100`, 16, true, scoreColor);
  yPos += 10;
  
  // Summary
  addText("Summary", 14, true);
  addText(`Passed: ${result.passed.length}`, 10);
  addText(`Warnings: ${result.warnings.length}`, 10);
  addText(`Failed: ${result.failed.length}`, 10);
  yPos += 10;
  
  // Detailed checks
  const sections = [
    { title: "Meta Tags", checks: result.details.metaTags },
    { title: "Open Graph", checks: result.details.openGraph },
    { title: "Twitter Cards", checks: result.details.twitter },
    { title: "Robots & Indexing", checks: result.details.robots },
    { title: "Technical SEO", checks: result.details.technical },
  ];
  
  if (result.details.performance) {
    sections.push({ title: "Performance", checks: result.details.performance });
  }
  if (result.details.security) {
    sections.push({ title: "Security", checks: result.details.security });
  }
  if (result.details.accessibility) {
    sections.push({ title: "Accessibility", checks: result.details.accessibility });
  }
  if (result.details.analytics) {
    sections.push({ title: "Analytics", checks: result.details.analytics });
  }
  if (result.details.caching) {
    sections.push({ title: "Caching", checks: result.details.caching });
  }
  
  sections.forEach(section => {
    if (yPos > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPos = 20;
    }
    
    addText(section.title, 12, true);
    Object.entries(section.checks).forEach(([key, check]) => {
      const statusColor = check.status === "pass" ? [0, 128, 0] : check.status === "warn" ? [255, 165, 0] : [255, 0, 0];
      addText(`  ${key}: ${check.message}`, 9, false, statusColor);
      if (check.recommendation) {
        addText(`    Recommendation: ${check.recommendation}`, 8, false, [128, 128, 128]);
      }
    });
    yPos += 5;
  });
  
  // Links section
  if (yPos > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    yPos = 20;
  }
  addText("Links", 12, true);
  addText(`  Total Links: ${result.details.links.totalLinks}`, 9);
  addText(`  Internal Links: ${result.details.links.internalLinks}`, 9);
  addText(`  External Links: ${result.details.links.externalLinks}`, 9);
  if (result.details.links.brokenLinks.length > 0) {
    addText(`  Broken Links: ${result.details.links.brokenLinks.length}`, 9, false, [255, 0, 0]);
    result.details.links.brokenLinks.slice(0, 10).forEach(link => {
      addText(`    - ${link.url} (${link.status})`, 8, false, [255, 0, 0]);
    });
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount} - Generated ${new Date().toLocaleString()}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }
  
  // Save
  const filename = `seo-analysis-${url.replace(/[^a-z0-9]/gi, "-").substring(0, 50)}-${Date.now()}.pdf`;
  doc.save(filename);
}

/**
 * Generates PDF from PageReport array
 */
export async function exportCrawlResultsToPDF(pages: PageReport[]): Promise<void> {
  // Dynamic import to avoid SSR issues
  const { jsPDF } = await import("jspdf");
  
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  
  // Helper to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    
    const lines = doc.splitTextToSize(text, maxWidth);
    if (yPos + (lines.length * fontSize * 0.4) > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(lines, margin, yPos);
    yPos += lines.length * fontSize * 0.4 + 5;
  };
  
  // Title
  addText("SEO Crawl Analysis Report", 18, true);
  yPos += 5;
  addText(`Total Pages Analyzed: ${pages.length}`, 12);
  addText(`Generated: ${new Date().toLocaleString()}`, 10, false, [128, 128, 128]);
  yPos += 10;
  
  // Summary statistics
  const passCount = pages.filter(p => p.status === "pass").length;
  const warnCount = pages.filter(p => p.status === "warn").length;
  const failCount = pages.filter(p => p.status === "fail").length;
  
  addText("Summary", 14, true);
  addText(`Passed: ${passCount}`, 10, false, [0, 128, 0]);
  addText(`Warnings: ${warnCount}`, 10, false, [255, 165, 0]);
  addText(`Failed: ${failCount}`, 10, false, [255, 0, 0]);
  yPos += 10;
  
  // Page details
  addText("Page Details", 14, true);
  yPos += 5;
  
  pages.forEach((page, index) => {
    if (yPos > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPos = 20;
    }
    
    const statusColor = page.status === "pass" ? [0, 128, 0] : page.status === "warn" ? [255, 165, 0] : [255, 0, 0];
    addText(`Page ${index + 1}: ${page.url}`, 11, true, statusColor);
    addText(`  Status: ${page.status.toUpperCase()}`, 9, false, statusColor);
    addText(`  H1 Count: ${page.h1Count}`, 9);
    if (page.meta.title) {
      addText(`  Title: ${page.meta.title}`, 9);
    }
    if (page.meta.description) {
      addText(`  Description: ${page.meta.description.substring(0, 100)}...`, 9);
    }
    if (page.issues.length > 0) {
      addText(`  Issues: ${page.issues.slice(0, 3).join(", ")}`, 9, false, [255, 0, 0]);
    }
    yPos += 5;
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${pageCount} - Generated ${new Date().toLocaleString()}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }
  
  // Save
  const filename = `seo-crawl-report-${Date.now()}.pdf`;
  doc.save(filename);
}
