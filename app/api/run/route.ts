import { NextResponse } from "next/server";
import { summarize } from "@/lib/run";
import { listPoints } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(summarize(await listPoints()), {
    headers: { "Cache-Control": "no-store" },
  });
}
