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
import { createPortal } from "react-dom";
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

function playChatChime() {
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtx = window.AudioContext || audioWindow.webkitAudioContext;
  if (!AudioCtx) return;

  const context = new AudioCtx();
  const now = context.currentTime;
  const notes = [523.25, 659.25, 783.99];

  notes.forEach((frequency, index) => {
    const start = now + index * 0.07;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.24);
  });

  window.setTimeout(() => {
    void context.close();
  }, 700);
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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <section
          className="flex h-[min(32rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl"
          role="dialog"
          aria-label="SEO chat"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-700 bg-gradient-to-r from-blue-950 to-indigo-950 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Ask your SEO audit</h2>
              <p className="text-xs text-gray-400">
                Grounded in {pages.length} crawled {pages.length === 1 ? "page" : "pages"}
              </p>
            </div>
            {messages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([WELCOME]);
                  setError(null);
                }}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
              >
                New chat
              </button>
            )}
          </div>

          <div
            ref={transcriptRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-blue-600 text-white"
                      : "rounded-bl-md border border-gray-700 bg-gray-800 text-gray-200"
                  }`}
                >
                  <ChatMessageContent content={message.content} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-gray-700 bg-gray-800 px-3.5 py-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-700 px-4 py-3">
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
              <p className="mb-3 rounded-xl border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this website’s SEO…"
                rows={1}
                maxLength={2000}
                disabled={loading}
                className="max-h-24 min-h-[44px] flex-1 resize-none rounded-2xl border border-gray-600 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-500"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
          </div>
        </section>
      )}

      <div className="relative flex h-12 w-12 items-center justify-center">
        {!open && (
          <>
            <span className="chat-wave pointer-events-none absolute inset-0 rounded-full" />
            <span className="chat-wave chat-wave-2 pointer-events-none absolute inset-0 rounded-full" />
            <span className="chat-wave chat-wave-3 pointer-events-none absolute inset-0 rounded-full" />
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen((current) => {
              if (!current) playChatChime();
              return !current;
            });
          }}
          aria-expanded={open}
          aria-label={open ? "Close chat" : "Open SEO chat"}
          className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-white transition duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-gray-950 ${
            open
              ? "bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 shadow-lg shadow-indigo-900/40"
              : "chat-fab"
          }`}
        >
          <span className="pointer-events-none absolute inset-[3px] rounded-full bg-white/15" />
          {open ? (
            <svg className="relative h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg className="relative h-5 w-5 drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8A2.5 2.5 0 0117.5 16H9l-3.8 3.2A.8.8 0 014 18.6V5.5z" />
            </svg>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}
