import { NextResponse } from "next/server";
import { getPoints, summarize } from "@/lib/run";

export async function GET() {
  return NextResponse.json(summarize(getPoints()));
}
