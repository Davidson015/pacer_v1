import { NextResponse } from "next/server";
import { buildLeaderboard } from "@/lib/leaderboard";
import { listPoints, listRunners } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const [points, runners] = await Promise.all([listPoints(), listRunners()]);
  return NextResponse.json(
    {
      entries: buildLeaderboard(points, runners),
      runnerCount: runners.length,
      updatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
