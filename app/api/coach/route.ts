import { NextResponse } from "next/server";
import {
  askModel,
  dataQuality,
  fallbackReply,
  runContext,
  type ChatMessage,
} from "@/lib/coach";
import { latestRunnerPoints, summarize } from "@/lib/run";
import { getGreeting, listPoints } from "@/lib/store";

export const dynamic = "force-dynamic";

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
  const [points, greeting] = await Promise.all([listPoints(), getGreeting()]);
  const scopedPoints = latestRunnerPoints(points);
  const summary = summarize(scopedPoints);
  const runnerCount = new Set(
    points.map((point) => `${point.runnerName}|${point.teamName}`),
  ).size;
  const otherRunnerCount = Math.max(
    0,
    runnerCount - (scopedPoints.length > 0 ? 1 : 0),
  );
  const context = [
    runContext(summary),
    scopedPoints.length > 0
      ? `Other runners tracked today: ${otherRunnerCount} (their numbers are not included here).`
      : null,
    greeting
      ? `GREETING DIRECTIVE: open your first reply of a new conversation with: "${greeting}"`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  const quality = dataQuality(summary);
  const openAiKey = process.env.OPENAI_API_KEY;
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  const apiKey = openAiKey ?? gatewayKey;
  const baseUrl =
    process.env.AI_BASE_URL ??
    (apiKey?.startsWith("sk-")
      ? "https://api.openai.com/v1"
      : "https://ai-gateway.vercel.sh/v1");
  const configuredModel =
    process.env.COACH_MODEL ?? process.env.AI_MODEL ?? "gpt-4o-mini";
  const model = /api\.openai\.com\/v1/i.test(baseUrl)
    ? configuredModel.replace(/^[^/]+\//, "")
    : configuredModel;

  if (!apiKey) {
    return NextResponse.json({
      reply: fallbackReply(summary),
      source: "fallback",
      dataQuality: quality,
      context,
    });
  }

  try {
    const reply = await askModel(apiKey, context, history, { baseUrl, model });
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
