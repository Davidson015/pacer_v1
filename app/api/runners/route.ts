import { NextResponse } from "next/server";
import { listRunners, saveRunner } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = typeof body === "object" && body !== null ? body : {};
  const runnerName =
    typeof (raw as { runnerName?: unknown }).runnerName === "string"
      ? (raw as { runnerName: string }).runnerName.trim()
      : "";
  const teamName =
    typeof (raw as { teamName?: unknown }).teamName === "string"
      ? (raw as { teamName: string }).teamName.trim()
      : "";

  if (!runnerName) {
    return NextResponse.json(
      { error: "runnerName must be a non-empty string" },
      { status: 400 },
    );
  }
  if (!teamName) {
    return NextResponse.json(
      { error: "teamName must be a non-empty string" },
      { status: 400 },
    );
  }

  try {
    await saveRunner(runnerName, teamName);
    const runners = await listRunners();
    return NextResponse.json(
      { runnerName, teamName, runnerCount: runners.length },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "could not save runner" },
      { status: 502 },
    );
  }
}

export async function GET() {
  const runners = await listRunners();
  return NextResponse.json(
    { runners, runnerCount: runners.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
