import type { ContentValidationResult } from "@/lib/content-types";
import { compareContent } from "@/lib/content-diff";
import { extractDocxContent } from "@/lib/docx-content";
import { extractContentFromHtml } from "@/lib/content-extract";
import { fetchPublicPage } from "@/lib/fetch-public-page";
import { ContentCheckError } from "@/lib/content-error";

export async function validatePageContent(input: {
  url: string;
  documentName: string;
  docx: Buffer;
}): Promise<ContentValidationResult> {
  const page = await fetchPublicPage(input.url);
  const document = await extractDocxContent(input.docx, input.documentName, page.finalUrl);
  const pageContent = extractContentFromHtml(page.html, page.finalUrl);
  if (pageContent.units.length === 0) {
    throw new ContentCheckError("No readable content was found on that page");
  }

  const { rows, links } = compareContent(document.units, pageContent.units);
  const warnings = page.warning ? [page.warning] : [];
  if (document.truncated || pageContent.truncated) {
    warnings.push("Only the first 800 content blocks from each source were compared.");
  }

  return {
    url: page.finalUrl,
    documentName: input.documentName,
    pageTitle: page.title,
    renderedWith: page.renderedWith,
    warnings,
    rows,
    links,
  };
}
