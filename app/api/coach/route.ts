import { NextResponse } from "next/server";
import {
  askModel,
  dataQuality,
  fallbackReply,
  runContext,
  type ChatMessage,
} from "@/lib/coach";
import { getPoints, summarize } from "@/lib/run";

function parseHistory(body: unknown): ChatMessage[] | string {
  if (typeof body !== "object" || body === null) {
    return "body must be a JSON object";
  }
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages) || messages.length === 0) {
    return "messages must be a non-empty array";
  }
  const history: ChatMessage[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null) {
      return "each message must be an object";
    }
    const { role, content } = message as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      return "message role must be 'user' or 'assistant'";
    }
    if (typeof content !== "string" || content.trim() === "") {
      return "message content must be a non-empty string";
    }
    history.push({ role, content });
  }
  return history;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const history = parseHistory(body);
  if (typeof history === "string") {
    return NextResponse.json({ error: history }, { status: 400 });
  }

  // Today's real run data is loaded fresh on every reply.
  const summary = summarize(getPoints());
  const context = runContext(summary);
  const quality = dataQuality(summary);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      reply: fallbackReply(summary),
      source: "fallback",
      dataQuality: quality,
      context,
    });
  }

  try {
    const reply = await askModel(apiKey, context, history);
    return NextResponse.json({
      reply,
      source: "model",
      dataQuality: quality,
      context,
    });
  } catch {
    return NextResponse.json({
      reply: fallbackReply(summary),
      source: "fallback",
      dataQuality: quality,
      context,
    });
  }
}
