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
  const scoreColor: [number, number, number] = result.score >= 80 ? [0, 128, 0] : result.score >= 60 ? [255, 165, 0] : [255, 0, 0];
  addText(`Overall SEO Score: ${result.score}/100`, 16, true, scoreColor);
  yPos += 10;
  
  // Summary
  addText("Summary", 14, true);
  addText(`Passed: ${result.passed.length}`, 10);
  addText(`Warnings: ${result.warnings.length}`, 10);
  addText(`Failed: ${result.failed.length}`, 10);
  yPos += 10;
  
  // Detailed checks
  type CheckSection = { title: string; checks: Record<string, { status: string; message: string; value?: string | number | boolean; recommendation?: string }> };
  const sections: CheckSection[] = [
    { title: "Meta Tags", checks: result.details.metaTags as any },
    { title: "Open Graph", checks: result.details.openGraph as any },
    { title: "Twitter Cards", checks: result.details.twitter as any },
    { title: "Robots & Indexing", checks: result.details.robots as any },
    { title: "Technical SEO", checks: result.details.technical as any },
  ];
  
  if (result.details.performance) {
    sections.push({ title: "Performance", checks: result.details.performance as any });
  }
  if (result.details.security) {
    sections.push({ title: "Security", checks: result.details.security as any });
  }
  if (result.details.accessibility) {
    sections.push({ title: "Accessibility", checks: result.details.accessibility as any });
  }
  if (result.details.analytics) {
    sections.push({ title: "Analytics", checks: result.details.analytics as any });
  }
  if (result.details.caching) {
    sections.push({ title: "Caching", checks: result.details.caching as any });
  }
  
  sections.forEach(section => {
    if (yPos > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPos = 20;
    }
    
    addText(section.title, 12, true);
    Object.entries(section.checks).forEach(([key, check]) => {
      const statusColor: [number, number, number] = check.status === "pass" ? [0, 128, 0] : check.status === "warn" ? [255, 165, 0] : [255, 0, 0];
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

/** Options for crawl results PDF export */
export interface ExportCrawlPDFOptions {
  pages: PageReport[];
  locale?: string;
  localeLabel?: string;
  totalPagesInCrawl?: number;
}

const PDF = {
  margin: 20,
  headerHeight: 18,
  footerHeight: 14,
  primaryColor: [15, 23, 42] as [number, number, number],   // slate-900
  secondaryColor: [71, 85, 105] as [number, number, number], // slate-600
  successColor: [22, 163, 74] as [number, number, number],   // green-600
  warnColor: [234, 179, 8] as [number, number, number],      // amber-500
  failColor: [220, 38, 38] as [number, number, number],      // red-600
};

/**
 * Enterprise-style PDF: header bar, footer, and addText helper with page break
 */
function addPageHeader(doc: any, pageNum: number, totalPages: number, title: string, pageWidth: number, pageHeight: number) {
  doc.setFillColor(...PDF.primaryColor);
  doc.rect(0, 0, pageWidth, PDF.headerHeight, "F");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(title, PDF.margin, 12);
  doc.setFont("helvetica", "normal");
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - PDF.margin, 12, { align: "right" });
}

function addPageFooter(doc: any, pageWidth: number, pageHeight: number) {
  const y = pageHeight - PDF.footerHeight / 2;
  doc.setFontSize(8);
  doc.setTextColor(...PDF.secondaryColor);
  doc.text(
    `SEO Crawl Report · Generated ${new Date().toLocaleString()} · Confidential`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
}

/**
 * Generates enterprise-style PDF from PageReport array
 */
export async function exportCrawlResultsToPDF(
  options: ExportCrawlPDFOptions | PageReport[]
): Promise<void> {
  const pages = Array.isArray(options) ? options : options.pages;
  const opts: Partial<ExportCrawlPDFOptions> = Array.isArray(options) ? {} : options;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF.margin;
  const maxWidth = pageWidth - margin * 2;
  const contentTop = margin + 4;
  const contentBottom = pageHeight - PDF.footerHeight - 10;
  const lineHeight = 5;
  const reportTitle = "SEO Crawl Analysis Report";
  const localeLabel = opts.localeLabel ?? "All Countries";
  const generatedAt = new Date().toLocaleString();

  let yPos = contentTop;
  let currentPage = 1;

  function drawTableHeader() {
    const headerY = yPos;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF.primaryColor);
    doc.setFillColor(248, 250, 252);
    doc.rect(tableLeft, headerY - 5, maxWidth, rowHeight + 2, "F");
    doc.text("#", colStarts[0] + cellPad, headerY + 2, { align: "left" });
    doc.text("URL", colStarts[1] + cellPad, headerY + 2, { align: "left" });
    doc.text("Status", colStarts[2] + cellPad, headerY + 2, { align: "left" });
    doc.text("H1", colStarts[3] + cellPad, headerY + 2, { align: "left" });
    doc.text("Title", colStarts[4] + cellPad, headerY + 2, { align: "left" });
    doc.text("Issues", colStarts[5] + cellPad, headerY + 2, { align: "left" });
    yPos = headerY + rowHeight + 4;
    doc.setFont("helvetica", "normal");
  }

  const tableLeft = margin;
  const rowHeight = 8;
  const cellPad = 3;
  const cw = { num: 8, url: 58, status: 14, h1: 8, title: 48, issues: 34 };
  const colStarts = [
    tableLeft,
    tableLeft + cw.num,
    tableLeft + cw.num + cw.url,
    tableLeft + cw.num + cw.url + cw.status,
    tableLeft + cw.num + cw.url + cw.status + cw.h1,
    tableLeft + cw.num + cw.url + cw.status + cw.h1 + cw.title,
  ];

  function needNewPage(requiredSpace: number = 30) {
    if (yPos + requiredSpace > contentBottom) {
      addPageFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      currentPage++;
      addPageHeader(doc, currentPage, 0, reportTitle, pageWidth, pageHeight);
      yPos = contentTop;
      drawTableHeader();
      return true;
    }
    return false;
  }

  function addText(
    text: string,
    fontSize: number = 10,
    isBold: boolean = false,
    color: [number, number, number] = [0, 0, 0],
    x: number = margin
  ) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth - (x - margin));
    for (const line of lines) {
      needNewPage(lineHeight * 1.5);
      doc.text(line, x, yPos);
      yPos += lineHeight;
    }
    yPos += 2;
  }

  // ----- Cover / Title section -----
  addPageHeader(doc, 1, 0, reportTitle, pageWidth, pageHeight);
  yPos = contentTop + 10;

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF.primaryColor);
  doc.text("SEO Crawl Analysis Report", margin, yPos);
  yPos += 14;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF.secondaryColor);
  doc.text(`Region: ${localeLabel}`, margin, yPos);
  yPos += 7;
  doc.text(`Pages in this report: ${pages.length}`, margin, yPos);
  if (opts.totalPagesInCrawl != null && opts.totalPagesInCrawl !== pages.length) {
    yPos += 7;
    doc.text(`Total pages crawled: ${opts.totalPagesInCrawl}`, margin, yPos);
  }
  yPos += 7;
  doc.text(`Generated: ${generatedAt}`, margin, yPos);
  yPos += 20;

  // ----- Executive summary -----
  const passCount = pages.filter((p) => p.status === "pass").length;
  const warnCount = pages.filter((p) => p.status === "warn").length;
  const failCount = pages.filter((p) => p.status === "fail").length;

  addText("Executive Summary", 14, true, PDF.primaryColor);
  yPos += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  addText(`Passed: ${passCount}`, 11, false, PDF.successColor);
  addText(`Warnings: ${warnCount}`, 11, false, PDF.warnColor);
  addText(`Failed: ${failCount}`, 11, false, PDF.failColor);
  yPos += 6;

  // ----- Page details (table-style) -----
  addText("Page Details", 14, true, PDF.primaryColor);
  yPos += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Table header (first page)
  drawTableHeader();

  for (let i = 0; i < pages.length; i++) {
    needNewPage(rowHeight + 4);
    const page = pages[i];
    const statusColor =
      page.status === "pass" ? PDF.successColor : page.status === "warn" ? PDF.warnColor : PDF.failColor;
    const urlLine = doc.splitTextToSize(page.url, cw.url - cellPad * 2)[0] ?? "";
    const urlShort = urlLine.length > 48 ? urlLine.substring(0, 45) + "…" : urlLine || "—";
    const titleStr = page.meta.title ?? "—";
    const titleLine = doc.splitTextToSize(titleStr, cw.title - cellPad * 2)[0] ?? "";
    const titleShort = titleLine.length > 45 ? titleLine.substring(0, 42) + "…" : titleLine || "—";
    const issuesStr = page.issues.length > 0 ? page.issues.slice(0, 2).join("; ") : "—";
    const issuesLine = doc.splitTextToSize(issuesStr, cw.issues - cellPad * 2)[0] ?? "";
    const issuesShort = issuesLine.length > 25 ? issuesLine.substring(0, 22) + "…" : issuesLine || "—";

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(String(i + 1), colStarts[0] + cellPad, yPos, { align: "left" });
    doc.text(urlShort, colStarts[1] + cellPad, yPos, { align: "left" });
    doc.setTextColor(...statusColor);
    doc.text(page.status.toUpperCase(), colStarts[2] + cellPad, yPos, { align: "left" });
    doc.setTextColor(0, 0, 0);
    doc.text(String(page.h1Count), colStarts[3] + cellPad, yPos, { align: "left" });
    doc.text(titleShort, colStarts[4] + cellPad, yPos, { align: "left" });
    doc.setTextColor(...(page.issues.length > 0 ? PDF.failColor : PDF.secondaryColor));
    doc.text(issuesShort, colStarts[5] + cellPad, yPos, { align: "left" });
    yPos += rowHeight;
  }

  // Update total page count for headers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(0, 0, 0);
    addPageHeader(doc, i, totalPages, reportTitle, pageWidth, pageHeight);
    addPageFooter(doc, pageWidth, pageHeight);
  }

  const filename = `seo-crawl-report-${localeLabel.replace(/\s+/g, "-")}-${Date.now()}.pdf`;
  doc.save(filename);
}
