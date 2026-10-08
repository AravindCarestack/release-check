"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import ContentReport from "@/components/ContentReport";
import type { ContentValidationResult } from "@/lib/content-types";

function withProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const host = value.split("/")[0].split(":")[0].toLowerCase();
  const local = host === "localhost" || host.endsWith(".localhost") || host.startsWith("127.");
  return `${local ? "http" : "https"}://${value}`;
}

export default function ContentPage() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ContentValidationResult | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter the page URL");
      return;
    }
    if (!file) {
      setError("Upload the Word document for this page");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Upload a .docx file. Older .doc files need to be saved as .docx first.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("The document must be 8 MB or smaller");
      return;
    }

    const normalizedUrl = withProtocol(trimmed);
    const form = new FormData();
    form.set("url", normalizedUrl);
    form.set("file", file);

    setIsLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/content/validate", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as ContentValidationResult & { error?: string };
      if (!response.ok) {
        setError(data.error || "Content check failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Content check failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#070b12] text-gray-200">
      <header className="shrink-0 border-b border-white/10 bg-[#0c121c]">
        <div className="flex items-center gap-3 px-4 h-11">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-200">
            Tools
          </Link>
          <span className="text-gray-700">/</span>
          <h1 className="text-sm font-medium text-gray-100">Content diff</h1>
          <p className="hidden sm:block text-xs text-gray-500 truncate">
            Approved Word document against the live page
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-3">
          <input
            id="page-url"
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError("");
            }}
            placeholder="https://example.com or http://localhost:3000"
            aria-label="Page URL"
            disabled={isLoading}
            className="min-w-0 flex-1 h-9 px-3 border border-white/10 rounded-md bg-[#070b12] text-sm text-gray-100 placeholder:text-gray-600 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
          <label className="flex items-center gap-2 h-9 px-3 border border-white/10 rounded-md bg-[#070b12] text-sm text-gray-300 cursor-pointer hover:border-white/20 shrink-0">
            <span className="text-gray-500">Document</span>
            <span className="max-w-[220px] truncate">{file ? file.name : "Choose .docx"}</span>
            <input
              id="docx"
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={isLoading}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError("");
              }}
              className="sr-only"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-sm font-medium text-white shrink-0"
          >
            {isLoading ? "Comparing…" : "Compare"}
          </button>
        </form>
        {error && <p className="px-4 pb-3 text-sm text-red-400">{error}</p>}
      </header>

      <main className="flex-1 min-h-0">
        {isLoading && (
          <div className="h-full grid place-items-center text-sm text-gray-500">
            Reading the document and the live page…
          </div>
        )}
        {!isLoading && result && <ContentReport result={result} />}
        {!isLoading && !result && (
          <div className="h-full grid place-items-center px-6">
            <div className="max-w-md text-center">
              <p className="text-sm text-gray-300">Paste a page URL and attach its Word document.</p>
              <p className="mt-2 text-xs text-gray-500 leading-5">
                The diff fills this window. Changed words are marked in place. Navigation, footer, and cookie
                banners on the page are left out.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
