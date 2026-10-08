import mammoth from "mammoth";
import { ContentCheckError } from "@/lib/content-error";
import { extractContentFromHtml } from "@/lib/content-extract";
import type { ContentUnit } from "@/lib/content-types";

const MAX_DOCX_BYTES = 8 * 1024 * 1024;

export async function extractDocxContent(
  buffer: Buffer,
  filename: string,
  baseUrl: string
): Promise<{ units: ContentUnit[]; truncated: boolean }> {
  assertDocx(buffer, filename);
  let html = "";
  try {
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        ignoreEmptyParagraphs: true,
        externalFileAccess: false,
        convertImage: mammoth.images.imgElement(async (image) => {
          const altText = (image as { altText?: unknown }).altText;
          return {
            src: "about:blank",
            alt: typeof altText === "string" ? altText : "",
          };
        }),
      }
    );
    html = result.value;
  } catch {
    throw new ContentCheckError("That Word document could not be read. Save it as .docx and try again.");
  }

  const extracted = extractContentFromHtml(html, baseUrl);
  if (extracted.units.length === 0) {
    throw new ContentCheckError("No readable text was found in that document");
  }
  return extracted;
}

export function assertDocx(buffer: Buffer, filename: string) {
  if (!filename.toLowerCase().endsWith(".docx")) {
    throw new ContentCheckError("Upload a .docx file. Older .doc files need to be saved as .docx first.");
  }
  if (buffer.length === 0) {
    throw new ContentCheckError("That document is empty");
  }
  if (buffer.length > MAX_DOCX_BYTES) {
    throw new ContentCheckError("The document must be 8 MB or smaller");
  }
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new ContentCheckError("That file is not a valid .docx document");
  }
}
