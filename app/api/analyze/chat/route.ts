import { NextRequest, NextResponse } from "next/server";
import {
  generateSeoChatResponse,
  isAiInsightsConfigured,
  type SeoChatMessage,
} from "@/lib/ai-insights";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MAX_CONTEXT_LENGTH = 200_000;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_LENGTH = 12;

function parseMessages(value: unknown): SeoChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (message): message is SeoChatMessage =>
        !!message &&
        typeof message === "object" &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_LENGTH)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));
}

export async function POST(request: NextRequest) {
  if (!isAiInsightsConfigured()) {
    return NextResponse.json(
      { error: "SEO assistant unavailable. Please contact support." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      context?: unknown;
      messages?: unknown;
    };
    const context =
      typeof body.context === "string" ? body.context.trim() : "";
    const messages = parseMessages(body.messages);

    if (!context) {
      return NextResponse.json(
        { error: "No crawl results were provided" },
        { status: 400 }
      );
    }
    if (context.length > MAX_CONTEXT_LENGTH) {
      return NextResponse.json(
        { error: "The crawl is too large for chat. Narrow the audit and try again." },
        { status: 413 }
      );
    }
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json(
        { error: "Please enter a question" },
        { status: 400 }
      );
    }

    const answer = await generateSeoChatResponse(context, messages);
    return NextResponse.json({ answer });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "SEO assistant failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
