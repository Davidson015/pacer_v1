"use client";

import { useCallback, useEffect, useState } from "react";
import type { RunSummary } from "@/lib/run";

const REFRESH_MS = 10000;

function paceLabel(paceMinPerKm: number | null): string {
  if (paceMinPerKm === null || !Number.isFinite(paceMinPerKm)) return "—";
  const minutes = Math.floor(paceMinPerKm);
  const seconds = Math.round((paceMinPerKm - minutes) * 60);
  const carry = seconds === 60;
  return `${minutes + (carry ? 1 : 0)}:${String(carry ? 0 : seconds).padStart(2, "0")}`;
}

function currentPace(run: RunSummary): number | null {
  const laps = run.laps;
  const lastLap = laps[laps.length - 1];
  if (lastLap?.paceMinPerKm != null) return lastLap.paceMinPerKm;
  const last = run.points[run.points.length - 1];
  return last ? last.pace : null;
}

type Route = { path: string; head: { x: number; y: number } };

/** Equirectangular projection scaled to the viewBox, aspect corrected by latitude. */
function projectRoute(
  run: RunSummary,
  width: number,
  height: number,
): Route | null {
  const points = run.points;
  if (points.length < 2) return null;

  const latScale = Math.cos((points[0].latitude * Math.PI) / 180) || 1;
  const xs = points.map((point) => point.longitude * latScale);
  const ys = points.map((point) => point.latitude);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-6;
  const spanY = maxY - minY || 1e-6;
  const scale = Math.min((width - 24) / spanX, (height - 24) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const projected = points.map((_, index) => ({
    x: offsetX + (xs[index] - minX) * scale,
    // SVG y grows downward, so flip latitude.
    y: height - (offsetY + (ys[index] - minY) * scale),
  }));

  return {
    path: projected
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      )
      .join(" "),
    head: projected[projected.length - 1],
  };
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold tracking-[0.2em] text-white/40 uppercase sm:text-base">
        {label}
      </span>
      <span className="text-6xl leading-none font-black tracking-tight text-white tabular-nums sm:text-7xl lg:text-8xl">
        {value}
        {unit && (
          <span className="ml-2 text-2xl font-bold text-[#c6ff00] sm:text-3xl">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

export default function LivePage() {
  const [run, setRun] = useState<RunSummary | null>(null);
  const [signupCount, setSignupCount] = useState<number | null>(null);
  const [runnerCount, setRunnerCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [runResponse, signupResponse, leaderboardResponse] =
        await Promise.all([
          fetch("/api/run", { cache: "no-store" }),
          fetch("/api/signups", { cache: "no-store" }),
          fetch("/api/leaderboard", { cache: "no-store" }),
        ]);
      if (!runResponse.ok) throw new Error("could not load the run");
      if (!signupResponse.ok || !leaderboardResponse.ok) {
        throw new Error("could not load today's counts");
      }

      const [summary, signups, leaderboard] = await Promise.all([
        runResponse.json() as Promise<RunSummary>,
        signupResponse.json() as Promise<{ signupCount?: number }>,
        leaderboardResponse.json() as Promise<{ runnerCount?: number }>,
      ]);
      setRun(summary);
      setSignupCount(
        typeof signups.signupCount === "number" ? signups.signupCount : null,
      );
      setRunnerCount(
        typeof leaderboard.runnerCount === "number"
          ? leaderboard.runnerCount
          : null,
      );
      setError(null);
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "unexpected error");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const last = run?.points[run.points.length - 1] ?? null;
  const route = run ? projectRoute(run, 600, 400) : null;

  return (
    <div className="flex flex-1 flex-col bg-black text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-8 py-6">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          Live<span className="text-[#c6ff00]">.</span>
          <span className="ml-4 text-base font-medium text-white/40 sm:text-lg">
            today&apos;s run
          </span>
        </h1>
        <p className="flex items-center gap-3 text-base text-white/40 sm:text-lg">
          <span className="size-3 animate-pulse rounded-full bg-[#c6ff00]" />
          {error ?? `updated ${updatedAt ?? "…"} · every 10s`}
        </p>
      </header>

      <main className="grid flex-1 gap-10 px-8 py-10 lg:grid-cols-[1.1fr_1fr]">
        <section className="flex flex-col gap-4">
          <span className="text-sm font-semibold tracking-[0.2em] text-white/40 uppercase sm:text-base">
            Route
          </span>
          <div className="flex flex-1 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            {route ? (
              <svg
                viewBox="0 0 600 400"
                role="img"
                aria-label="Route of today's run"
                className="h-full max-h-[52vh] w-full"
              >
                <path
                  d={route.path}
                  fill="none"
                  stroke="#c6ff00"
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx={route.head.x} cy={route.head.y} r={9} fill="#fff" />
              </svg>
            ) : (
              <p className="p-10 text-center text-xl text-white/40">
                Waiting for run points — the route draws itself as they arrive.
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-10 sm:grid-cols-2">
          <Stat
            label="Current pace"
            value={run ? paceLabel(currentPace(run)) : "—"}
            unit="/km"
          />
          <Stat
            label="Distance"
            value={run ? (run.totalDistanceMeters / 1000).toFixed(2) : "—"}
            unit="km"
          />
          <Stat
            label="Laps"
            value={run ? run.lapCount.toFixed(1) : "—"}
            unit="× 400 m"
          />
          <Stat
            label="Avg pace"
            value={run ? paceLabel(run.averagePaceMinPerKm) : "—"}
            unit="/km"
          />
          <Stat
            label="Signups"
            value={signupCount === null ? "—" : signupCount.toString()}
          />
          <Stat
            label="Runners"
            value={runnerCount === null ? "—" : runnerCount.toString()}
          />
          <div className="sm:col-span-2">
            <span className="text-sm font-semibold tracking-[0.2em] text-white/40 uppercase sm:text-base">
              Running now
            </span>
            <p className="mt-1 text-5xl leading-tight font-black tracking-tight sm:text-6xl">
              {last ? last.runnerName : "Nobody yet"}
            </p>
            <p className="mt-2 text-2xl font-bold text-[#c6ff00]">
              {last ? last.teamName : "waiting for the first point"}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
