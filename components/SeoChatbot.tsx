"use client";

import {
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PageReport } from "@/lib/page-analyzer";
import { buildCrawlChatContext } from "@/lib/ai-insights-summary";
import type { SeoChatMessage } from "@/lib/ai-insights";

interface SeoChatbotProps {
  pages: PageReport[];
}

const STARTERS = [
  "What should I fix first?",
  "Which pages have the biggest SEO risks?",
  "Show me the quickest wins",
  "Summarize this audit for a client",
];

const WELCOME: SeoChatMessage = {
  role: "assistant",
  content:
    "I’ve reviewed this crawl. Ask me about priority fixes, affected pages, technical SEO risks, or quick wins.",
};

function formatInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-gray-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

function ChatMessageContent({ content }: { content: string }) {
  return (
    <>
      {content.split("\n").map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-2" />;
        const bullet = line.match(/^\s*[-•]\s+(.+)/);
        return bullet ? (
          <div key={index} className="flex gap-2">
            <span className="text-blue-400">•</span>
            <span>{formatInline(bullet[1])}</span>
          </div>
        ) : (
          <div key={index}>{formatInline(line)}</div>
        );
      })}
    </>
  );
}

export default function SeoChatbot({ pages }: SeoChatbotProps) {
  const context = useMemo(() => buildCrawlChatContext(pages), [pages]);
  const [messages, setMessages] = useState<SeoChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const nextMessages = [
      ...messages,
      { role: "user" as const, content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/analyze/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          messages: nextMessages.slice(-12),
        }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
      };
      if (!response.ok || !data.answer) {
        throw new Error(data.error || "The SEO assistant could not answer");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.answer as string },
      ]);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The SEO assistant could not answer"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void ask(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(input);
    }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-blue-800 bg-gray-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 bg-gradient-to-r from-blue-950 to-indigo-950 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-lg text-white">
            ✦
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Ask your SEO audit</h2>
            <p className="text-xs text-gray-400">
              Answers are grounded in {pages.length} crawled {pages.length === 1 ? "page" : "pages"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setMessages([WELCOME]);
                setError(null);
              }}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
            >
              New chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-900/60"
            aria-expanded={expanded}
          >
            {expanded ? "Hide" : "Open chat"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4">
          <div
            ref={transcriptRef}
            className="mb-3 max-h-80 space-y-3 overflow-y-auto pr-1"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-sm bg-blue-600 text-white"
                      : "rounded-bl-sm border border-gray-700 bg-gray-800 text-gray-200"
                  }`}
                >
                  <ChatMessageContent content={message.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-xl rounded-bl-sm border border-gray-700 bg-gray-800 px-3.5 py-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          {messages.length === 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void ask(starter)}
                  className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 transition hover:border-blue-600 hover:text-blue-300"
                >
                  {starter}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this website’s SEO…"
              rows={2}
              maxLength={2000}
              disabled={loading}
              className="min-h-[44px] flex-1 resize-none rounded-md border border-gray-600 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-11 rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
            >
              Send
            </button>
          </form>
          <p className="mt-2 text-[11px] text-gray-500">
            Based only on this crawl. Verify recommendations before making production changes.
          </p>
        </div>
      )}
    </section>
  );
}
