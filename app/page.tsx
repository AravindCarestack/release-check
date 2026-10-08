import Link from "next/link";

const tools = [
  {
    href: "/seo",
    eyebrow: "Current tool",
    title: "SEO Validation",
    description: "Crawl a website and audit meta tags, indexing, links, and technical SEO.",
    points: ["Single or multi-page crawl", "Pass, warning, and fail checks", "AI explanations of the audit"],
    accent: "text-blue-300",
    border: "hover:border-blue-500",
  },
  {
    href: "/content",
    eyebrow: "New",
    title: "Content Validation",
    description: "Side-by-side diff of an approved Word document and the live page built from it.",
    points: ["One .docx for one page URL", "Word-level highlights of changed text", "Missing and extra sentences"],
    accent: "text-emerald-300",
    border: "hover:border-emerald-500",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 max-w-2xl">
            <h1 className="text-3xl font-semibold text-gray-100 mb-2">Website Validator</h1>
            <p className="text-base text-gray-400">
              Check technical SEO, or check that a built page still contains the approved copy.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={`bg-gray-900 border border-gray-700 rounded-md p-6 shadow-sm transition ${tool.border} hover:bg-gray-900/80`}
              >
                <p className={`text-xs font-medium uppercase tracking-wide mb-3 ${tool.accent}`}>
                  {tool.eyebrow}
                </p>
                <h2 className="text-xl font-semibold text-gray-100 mb-2">{tool.title}</h2>
                <p className="text-sm text-gray-400 mb-5">{tool.description}</p>
                <ul className="space-y-1.5 text-sm text-gray-300">
                  {tool.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="text-gray-500">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
