"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SeoPage() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setError("Please enter a URL");
      return false;
    }

    try {
      const testUrl = input.startsWith("http") ? input : `https://${input}`;
      new URL(testUrl);
      return true;
    } catch {
      setError("Please enter a valid URL");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateUrl(url)) {
      return;
    }

    setIsLoading(true);
    try {
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
      const params = new URLSearchParams({
        url: normalizedUrl,
        crawl: "true",
      });
      router.push(`/results?${params.toString()}`);
    } catch {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-200">
            All tools
          </Link>
          <div className="mb-10 mt-4">
            <h1 className="text-3xl font-semibold text-gray-100 mb-2">SEO Validation</h1>
            <p className="text-base text-gray-400">
              Comprehensive SEO and production readiness analysis
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-md shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-300 mb-2">
                  Website URL
                </label>
                <input
                  type="text"
                  id="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                  }}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-950 text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                  disabled={isLoading}
                />
                {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
                <p className="mt-2 text-xs text-gray-500">
                  All internal pages will be crawled and analyzed automatically
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-md transition flex items-center justify-center text-sm"
              >
                {isLoading ? "Analyzing..." : "Start Analysis"}
              </button>
            </form>
          </div>

          <div className="mt-8 text-sm text-gray-400">
            <p className="mb-3 font-medium">Analysis includes:</p>
            <ul className="space-y-1.5">
              <li>Meta tags and SEO elements</li>
              <li>Open Graph and Twitter Card tags</li>
              <li>Robots.txt and indexing configuration</li>
              <li>Technical SEO validation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
