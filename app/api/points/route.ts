import { NextResponse } from "next/server";
import { addPoint, getPoints, parsePoint } from "@/lib/run";

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

  const point = addPoint(parsed);
  return NextResponse.json(
    { point, pointCount: getPoints().length },
    { status: 201 },
  );
}

export async function GET() {
  const points = getPoints();
  return NextResponse.json({ points, pointCount: points.length });
}
