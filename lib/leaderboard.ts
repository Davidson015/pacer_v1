import { leaderboardComment } from "@/lib/coach";
import { summarize, type RunPoint } from "@/lib/run";
import type { Runner } from "@/lib/store";

export type LeaderboardEntry = {
  runnerName: string;
  teamName: string;
  totalDistanceMeters: number;
  averagePaceMinPerKm: number | null;
  lapCount: number;
  pointCount: number;
  comment: string;
};

function runnerKey(runnerName: string, teamName: string): string {
  return `${runnerName}|${teamName}`;
}

export function buildLeaderboard(
  points: RunPoint[],
  runners: Runner[],
): LeaderboardEntry[] {
  const pointsByRunner = new Map<string, RunPoint[]>();
  for (const point of points) {
    const key = runnerKey(point.runnerName, point.teamName);
    const group = pointsByRunner.get(key) ?? [];
    group.push(point);
    pointsByRunner.set(key, group);
  }

  const registered = new Map(
    runners.map((runner) => [runnerKey(runner.runnerName, runner.teamName), runner]),
  );
  const identities = new Map(registered);
  for (const point of points) {
    const key = runnerKey(point.runnerName, point.teamName);
    if (!identities.has(key)) {
      identities.set(key, {
        runnerName: point.runnerName,
        teamName: point.teamName,
        joinedAt: "",
      });
    }
  }

  const entries = [...identities].map(([key, runner]) => {
    const summary = summarize(pointsByRunner.get(key) ?? []);
    return {
      runnerName: runner.runnerName,
      teamName: runner.teamName,
      totalDistanceMeters: summary.totalDistanceMeters,
      averagePaceMinPerKm: summary.averagePaceMinPerKm,
      lapCount: summary.lapCount,
      pointCount: summary.pointCount,
      comment: leaderboardComment(summary),
    };
  });

  return entries.sort(
    (a, b) =>
      b.totalDistanceMeters - a.totalDistanceMeters ||
      b.pointCount - a.pointCount ||
      a.runnerName.localeCompare(b.runnerName) ||
      a.teamName.localeCompare(b.teamName),
  );
}
