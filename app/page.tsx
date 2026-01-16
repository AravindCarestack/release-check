"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateUrl = (input: string): boolean => {
    if (!input.trim()) {
      setError("Please enter a URL");
      return false;
    }

    // Basic URL validation
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
      // Navigate to results page with URL as query param - always crawl by default
      const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
      const params = new URLSearchParams({ 
        url: normalizedUrl,
        crawl: "true"
      });
      router.push(`/results?${params.toString()}`);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">
              SEO Website Validator
            </h1>
            <p className="text-base text-gray-600">
              Comprehensive SEO and production readiness analysis
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="url"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                  disabled={isLoading}
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  All internal pages will be crawled and analyzed automatically
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-md transition flex items-center justify-center text-sm"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  "Start Analysis"
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-sm text-gray-600">
            <p className="mb-3 font-medium">Analysis includes:</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Meta tags and SEO elements</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Open Graph and Twitter Card tags</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Robots.txt and indexing configuration</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <span>Technical SEO validation</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
