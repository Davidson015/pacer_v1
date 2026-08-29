"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { formatPace } from "@/lib/coach";
import type { LeaderboardEntry } from "@/lib/leaderboard";

const REFRESH_MS = 10000;

type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  runnerCount: number;
  updatedAt: string;
};

function paceLabel(pace: number | null): string {
  return pace === null || !Number.isFinite(pace) ? "—" : formatPace(pace);
}

function distanceLabel(entry: LeaderboardEntry): string {
  return entry.pointCount === 0
    ? "—"
    : `${(entry.totalDistanceMeters / 1000).toFixed(2)} km`;
}

function lapsLabel(entry: LeaderboardEntry): string {
  return entry.pointCount === 0 ? "—" : entry.lapCount.toFixed(1);
}

export default function LeaderboardClient({ qrCode }: { qrCode?: ReactNode }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("could not load the leaderboard");
        return response.json() as Promise<LeaderboardResponse>;
      })
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "could not load the leaderboard",
        );
      });
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const entries = data?.entries ?? [];

  return (
    <div className="flex flex-1 flex-col bg-black text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-8 py-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-[#c6ff00] uppercase sm:text-sm">
            Pacer leaderboard
          </p>
          <h1 className="mt-2 text-4xl leading-none font-black tracking-tight sm:text-6xl">
            Run the board.
          </h1>
        </div>
        <nav className="flex flex-wrap items-center gap-3">
          <a
            href="/track"
            className="rounded-full bg-[#c6ff00] px-5 py-3 text-sm font-black text-black hover:brightness-110"
          >
            Start tracking
          </a>
          <a
            href="/live"
            className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold hover:border-[#c6ff00] hover:text-[#c6ff00]"
          >
            Live run
          </a>
        </nav>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-10 px-8 py-10 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-white/40 uppercase">
                Today&apos;s runners
              </p>
              <p className="mt-2 text-lg text-white/50">
                {error ??
                  `${data?.runnerCount ?? "—"} registered · live every 10s`}
              </p>
            </div>
            {data?.updatedAt && (
              <p className="text-sm text-white/35">
                Updated {new Date(data.updatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <p className="text-2xl font-bold text-white/70">
                No runners yet — scan to join.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry, index) => (
                <article
                  key={`${entry.runnerName}|${entry.teamName}`}
                  className={
                    index === 0
                      ? "rounded-3xl border border-[#c6ff00]/70 bg-[#c6ff00]/[0.08] p-6 sm:p-8"
                      : "rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8"
                  }
                >
                  <div className="grid gap-5 sm:grid-cols-[100px_1fr_auto] sm:items-center">
                    <p
                      className={`text-7xl leading-none font-black tabular-nums ${index === 0 ? "text-[#c6ff00]" : "text-white/25"}`}
                    >
                      {index + 1}
                    </p>
                    <div>
                      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                        {entry.runnerName}
                      </h2>
                      <p className="mt-1 text-lg font-semibold text-white/45">
                        {entry.teamName}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-5 sm:min-w-[290px]">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.15em] text-white/35 uppercase">
                          Distance
                        </p>
                        <p className="mt-1 text-xl font-black tabular-nums">
                          {distanceLabel(entry)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.15em] text-white/35 uppercase">
                          Avg pace
                        </p>
                        <p className="mt-1 text-xl font-black tabular-nums">
                          {paceLabel(entry.averagePaceMinPerKm)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.15em] text-white/35 uppercase">
                          Laps
                        </p>
                        <p className="mt-1 text-xl font-black tabular-nums">
                          {lapsLabel(entry)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-6 border-t border-white/10 pt-4 text-lg font-semibold text-white/65">
                    {entry.comment}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        {qrCode && <aside>{qrCode}</aside>}
      </main>
    </div>
  );
}
