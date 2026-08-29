"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import commitData from "@/data/commits.json";
import {
  TRACK_VIEWBOX,
  buildPins,
  trackPath,
  trackPosition,
  type Commit,
  type Pin,
} from "@/lib/build-map";
import type { RunSummary } from "@/lib/run";

const COMMITS = commitData as Commit[];
const REFRESH_MS = 10000;
const EMPTY_POINTS: RunSummary["points"] = [];
const TRACK = trackPath();

/** Flags pins whose nearest run point is far from the commit, so the lap is a guess. */
function offsetNote(pin: Pin): string | null {
  if (pin.matchOffsetSeconds === null || pin.matchOffsetSeconds <= 120) {
    return null;
  }
  return `nearest run point is ${Math.round(pin.matchOffsetSeconds / 60)} min away`;
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dateTimeLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "medium" });
}

function timeRange(commits: Commit[], points: RunSummary["points"]): string {
  const timestamps = [
    ...commits.map((commit) => commit.isoDate),
    ...points.map((point) => point.timestamp),
  ]
    .map((timestamp) => new Date(timestamp))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (timestamps.length === 0) return "—";
  return `${timeLabel(timestamps[0].toISOString())}–${timeLabel(
    timestamps[timestamps.length - 1].toISOString(),
  )}`;
}

function SummaryStat({
  label,
  value,
  unit,
  compact,
}: {
  label: string;
  value: string;
  unit?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-xs font-semibold tracking-[0.2em] text-white/45 uppercase sm:text-sm">
        {label}
      </span>
      <span
        className={`leading-none font-black tracking-tight text-white tabular-nums ${compact ? "text-2xl sm:text-3xl lg:text-4xl" : "text-3xl sm:text-4xl lg:text-5xl"}`}
      >
        {value}
        {unit && (
          <span className="ml-2 text-base font-bold text-[#c6ff00] sm:text-lg">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * Consecutive laps sit on neighbouring lanes, and commits that matched the same
 * run point are fanned along the track, so every pin stays visible and on the oval.
 */
function placePins(pins: Pin[]): Array<{ x: number; y: number }> {
  const seen = new Map<string, number>();

  return pins.map((pin) => {
    const key = `${pin.matchedTimestamp ?? "none"}:${pin.distanceMeters ?? "none"}`;
    const rank = seen.get(key) ?? 0;
    seen.set(key, rank + 1);

    const base =
      pin.distanceMeters === null || rank === 0
        ? { x: pin.x, y: pin.y }
        : trackPosition(pin.distanceMeters + rank * 16);

    const lane = (Math.max(1, pin.lapNumber) - 1 + rank) % 4;
    const factor = 1 + (lane - 1.5) * 0.04;
    return {
      x: TRACK_VIEWBOX.width / 2 + (base.x - TRACK_VIEWBOX.width / 2) * factor,
      y:
        TRACK_VIEWBOX.height / 2 + (base.y - TRACK_VIEWBOX.height / 2) * factor,
    };
  });
}

export default function BuildMapPage() {
  const [run, setRun] = useState<RunSummary | null>(null);
  const [matched, setMatched] = useState(false);
  const [selected, setSelected] = useState(COMMITS.length - 1);

  const load = useCallback(() => {
    fetch("/api/run", { cache: "no-store" })
      .then((response) => response.json() as Promise<RunSummary>)
      .then((run) => {
        setRun(run);
        setMatched(run.points.length > 0);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const points = run?.points ?? EMPTY_POINTS;
  const pins = useMemo(() => buildPins(COMMITS, points), [points]);
  const positions = useMemo(() => placePins(pins), [pins]);
  const active = pins[selected] ?? pins[pins.length - 1] ?? null;
  const runnerCount =
    points.length === 0
      ? "—"
      : new Set(points.map((point) => point.runnerName)).size.toString();

  return (
    <div className="flex flex-1 flex-col bg-black text-white">
      <header className="flex flex-col gap-2 px-5 pt-8 pb-5 sm:px-8 sm:pt-10 sm:pb-6">
        <p className="text-xs font-semibold tracking-[0.3em] text-[#c6ff00] uppercase sm:text-sm">
          Pacer build map
        </p>
        <h1 className="max-w-5xl text-3xl leading-[0.95] font-black tracking-tight sm:text-6xl lg:text-7xl">
          Every feature on this map{" "}
          <span className="text-[#c6ff00]">shipped on a lap</span>.
        </h1>
        <p className="text-base text-white/50 sm:text-lg">
          {COMMITS.length} commits
          {matched
            ? ` matched to the nearest run point across ${points.length} recorded points`
            : " — waiting for run points, so pins sit in commit order until the run data lands"}
        </p>
        <section
          aria-label="Build map summary"
          className="grid grid-cols-2 gap-4 rounded-2xl border border-[#c6ff00]/35 bg-[#c6ff00]/[0.06] p-4 sm:gap-8 sm:p-8 lg:grid-cols-4"
        >
          <SummaryStat
            label="Total distance"
            value={
              run && points.length > 0
                ? (run.totalDistanceMeters / 1000).toFixed(2)
                : "—"
            }
            unit={run && points.length > 0 ? "km" : undefined}
          />
          <SummaryStat label="Commits" value={COMMITS.length.toString()} />
          <SummaryStat label="Runners" value={runnerCount} />
          <SummaryStat
            label="Time range"
            value={timeRange(COMMITS, points)}
            compact
          />
        </section>
        <p className="text-xs text-white/35">
          Commit timestamps and GPS timestamps are separate records,
          cross-referenced by nearest time — no commit is assumed to have
          happened at a run point.
        </p>
      </header>

      <main className="grid flex-1 gap-6 px-5 pb-10 sm:gap-8 sm:px-8 sm:pb-12 lg:grid-cols-[1.45fr_1fr]">
        <section className="relative rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(198,255,0,0.12),transparent_65%)] p-3 sm:p-4">
          <svg
            viewBox={`0 0 ${TRACK_VIEWBOX.width} ${TRACK_VIEWBOX.height}`}
            role="img"
            aria-label="Running track with a pin for every commit"
            className="block h-auto w-full"
          >
            <path
              d={TRACK}
              fill="none"
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={54}
              strokeLinejoin="round"
            />
            <path
              d={TRACK}
              fill="none"
              stroke="rgba(198,255,0,0.35)"
              strokeWidth={2}
              strokeDasharray="10 10"
            />
            {pins.map((pin, index) => {
              const position = positions[index];
              const isActive = index === selected;
              return (
                <g
                  key={pin.commit.hash}
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" ||
                      event.key === " " ||
                      event.key === "Spacebar"
                    ) {
                      event.preventDefault();
                      setSelected(index);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select commit ${index + 1}: ${pin.commit.subject}`}
                  className="cursor-pointer"
                >
                  {isActive && (
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r={22}
                      fill="rgba(198,255,0,0.25)"
                    />
                  )}
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={isActive ? 13 : 10}
                    fill={isActive ? "#c6ff00" : "#0a0a0a"}
                    stroke="#c6ff00"
                    strokeWidth={3}
                  />
                  <text
                    x={position.x}
                    y={position.y + 5}
                    textAnchor="middle"
                    className="font-mono text-[13px] font-bold"
                    fill={isActive ? "#000000" : "#c6ff00"}
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
            <text
              x={TRACK_VIEWBOX.width / 2}
              y={TRACK_VIEWBOX.height / 2 - 6}
              textAnchor="middle"
              className="text-[22px] font-black tracking-[0.35em] uppercase"
              fill="rgba(255,255,255,0.25)"
            >
              400 m
            </text>
            <text
              x={TRACK_VIEWBOX.width / 2}
              y={TRACK_VIEWBOX.height / 2 + 26}
              textAnchor="middle"
              className="text-[14px] font-semibold tracking-[0.3em] uppercase"
              fill="rgba(255,255,255,0.18)"
            >
              one lap, one ring
            </text>
          </svg>

          {active && (
            <div className="pointer-events-auto relative mt-3 max-h-[60vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[#c6ff00]/40 bg-black/90 p-4 backdrop-blur sm:absolute sm:top-6 sm:right-6 sm:mt-0 sm:p-6">
              <p className="font-mono text-xs text-[#c6ff00]">
                #{selected + 1} · {active.commit.hash} ·{" "}
                {dateTimeLabel(active.commit.isoDate)}
              </p>
              <p className="mt-3 text-xl font-bold tracking-tight">
                {active.commit.subject}
              </p>
              {active.commit.body && (
                <p className="mt-3 whitespace-pre-wrap font-mono text-sm leading-relaxed text-white/70">
                  {active.commit.body}
                </p>
              )}
              <p className="mt-4 text-base font-bold text-white/80">
                {active.distanceMeters === null
                  ? "no run point matched; lap position unavailable"
                  : `lap ${active.lapNumber} · ${active.metersIntoLap?.toFixed(1)} m into the lap · ${active.distanceMeters.toFixed(1)} m total`}
              </p>
              <p className="mt-2 text-sm text-white/60">
                {active.latitude === null || active.longitude === null
                  ? "no run point matched; coordinates unavailable"
                  : `coordinates ${active.latitude.toFixed(5)}, ${active.longitude.toFixed(5)} · GPS ${dateTimeLabel(active.matchedTimestamp ?? "")}`}
              </p>
              {offsetNote(active) && (
                <p className="mt-1 text-xs text-white/40">
                  {offsetNote(active)}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="flex max-h-[70vh] min-h-0 flex-col gap-2 overflow-y-auto pr-1 sm:pr-2">
          {pins.map((pin, index) => (
            <button
              key={pin.commit.hash}
              type="button"
              onClick={() => setSelected(index)}
              className={
                index === selected
                  ? "rounded-2xl border border-[#c6ff00] bg-[#c6ff00]/10 p-4 text-left"
                  : "rounded-2xl border border-white/10 p-4 text-left hover:border-white/30"
              }
            >
              <p className="flex items-center justify-between font-mono text-xs text-[#c6ff00]">
                <span>
                  #{index + 1} {pin.commit.hash}
                </span>
                <span>
                  {pin.distanceMeters === null
                    ? "lap —"
                    : `lap ${pin.lapNumber}`}{" "}
                  · {timeLabel(pin.commit.isoDate)}
                </span>
              </p>
              <p className="mt-1 font-bold tracking-tight">
                {pin.commit.subject}
              </p>
              <p className="mt-1 text-sm text-white/50">
                {pin.runnerName
                  ? `${pin.runnerName} · ${pin.teamName}`
                  : "runner unknown"}
              </p>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}
