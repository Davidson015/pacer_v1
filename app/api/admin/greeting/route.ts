import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getGreeting, saveGreeting } from "@/lib/store";

export const dynamic = "force-dynamic";

function tokensMatch(expected: string, received: string | null): boolean {
  if (received === null) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

function requestToken(request: Request): string | null {
  const direct = request.headers.get("x-admin-token");
  if (direct !== null) return direct;
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(request: Request) {
  const expectedToken = process.env.RUN_LOG_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "admin token is not configured" },
      { status: 503 },
    );
  }
  if (!tokensMatch(expectedToken, requestToken(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const greeting =
    typeof body === "object" &&
    body !== null &&
    typeof (body as { greeting?: unknown }).greeting === "string"
      ? (body as { greeting: string }).greeting.trim()
      : "";
  if (!greeting) {
    return NextResponse.json(
      { error: "greeting must be a non-empty string" },
      { status: 400 },
    );
  }
  if (greeting.length > 140) {
    return NextResponse.json(
      { error: "greeting must be 140 characters or fewer" },
      { status: 400 },
    );
  }

  try {
    const updatedAt = await saveGreeting(greeting);
    return NextResponse.json({ greeting, updatedAt });
  } catch {
    return NextResponse.json(
      { error: "could not save greeting" },
      { status: 502 },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { greeting: await getGreeting() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
