import { NextRequest, NextResponse } from "next/server";
import { ContentCheckError } from "@/lib/content-error";
import { validatePageContent } from "@/lib/content-validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const url = String(form.get("url") || "").trim();
    const file = form.get("file");

    if (!url) {
      return NextResponse.json({ error: "Enter the page URL" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload the Word document for this page" }, { status: 400 });
    }

    const documentName = file.name.split(/[/\\]/).pop() || "document.docx";
    const docx = Buffer.from(await file.arrayBuffer());
    const result = await validatePageContent({ url, documentName, docx });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ContentCheckError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Content validation failed", error);
    return NextResponse.json({ error: "Content check failed" }, { status: 500 });
  }
}
