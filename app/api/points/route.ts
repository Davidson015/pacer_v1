import { NextResponse } from "next/server";
import { parsePoint } from "@/lib/run";
import { listPoints, savePoint } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = parsePoint(body);
  if (typeof parsed === "string") {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  try {
    await savePoint(parsed);
    const points = await listPoints();
    return NextResponse.json(
      { point: parsed, pointCount: points.length },
      {
        status: 201,
      },
    );
  } catch {
    return NextResponse.json(
      { error: "could not save point" },
      { status: 502 },
    );
  }
}

export async function GET() {
  const points = await listPoints();
  return NextResponse.json(
    { points, pointCount: points.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
