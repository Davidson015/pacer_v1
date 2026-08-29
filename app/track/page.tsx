"use client";

import { useEffect, useRef, useState } from "react";
import { formatPace } from "@/lib/coach";
import { summarize, type RunPoint, type RunSummary } from "@/lib/run";

const STORAGE_KEY = "pacer-runner";
const POST_INTERVAL_MS = 10000;

type RunnerIdentity = {
  runnerName: string;
  teamName: string;
};

type AcceptedFix = {
  latitude: number;
  longitude: number;
  timestampMs: number;
};

function distanceMeters(
  first: Pick<GeolocationCoordinates, "latitude" | "longitude">,
  second: Pick<GeolocationCoordinates, "latitude" | "longitude">,
): number {
  const radius = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(second.latitude - first.latitude);
  const dLon = toRadians(second.longitude - first.longitude);
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function paceFromFix(
  position: GeolocationPosition,
  previous: AcceptedFix | null,
): number | null {
  const speed = position.coords.speed;
  if (typeof speed === "number" && Number.isFinite(speed) && speed > 0) {
    return 1000 / speed / 60;
  }

  if (!previous) return null;
  const elapsedSeconds = (position.timestamp - previous.timestampMs) / 1000;
  const distance = distanceMeters(previous, position.coords);
  if (
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds <= 0 ||
    distance <= 0
  ) {
    return null;
  }
  return elapsedSeconds / 60 / (distance / 1000);
}

function geolocationMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Allow it in your browser to track.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your location is unavailable right now. Trying again.";
  }
  if (error.code === error.TIMEOUT) {
    return "Location took too long to arrive. Trying again.";
  }
  return "We could not read your location. Trying again.";
}

export default function TrackPage() {
  const [runnerName, setRunnerName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [registered, setRegistered] = useState<RunnerIdentity | null>(null);
  const [registering, setRegistering] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [pointsSent, setPointsSent] = useState(0);
  const [lastFixTime, setLastFixTime] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishedRun, setFinishedRun] = useState<RunSummary | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPostAtRef = useRef(0);
  const lastAcceptedFixRef = useRef<AcceptedFix | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const identity = JSON.parse(saved) as Partial<RunnerIdentity>;
      if (
        typeof identity.runnerName === "string" &&
        typeof identity.teamName === "string"
      ) {
        const timeout = window.setTimeout(() => {
          setRunnerName(identity.runnerName as string);
          setTeamName(identity.teamName as string);
        }, 0);
        return () => window.clearTimeout(timeout);
      }
    } catch {
      // A missing or malformed local preference should not block tracking.
    }
  }, []);

  useEffect(
    () => () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    },
    [],
  );

  async function registerRunner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registering) return;

    const trimmedRunnerName = runnerName.trim();
    const trimmedTeamName = teamName.trim();
    setRegistering(true);
    setError(null);
    try {
      const response = await fetch("/api/runners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runnerName: trimmedRunnerName,
          teamName: trimmedTeamName,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "could not join");

      const identity = {
        runnerName: trimmedRunnerName,
        teamName: trimmedTeamName,
      };
      setRunnerName(identity.runnerName);
      setTeamName(identity.teamName);
      setRegistered(identity);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
      setStatusMessage("You are on the leaderboard. Start when you are ready.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "could not join");
    } finally {
      setRegistering(false);
    }
  }

  function clearWatch() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
  }

  function stopTracking() {
    clearWatch();
    setStatusMessage("Tracking stopped.");
  }

  async function finishRun() {
    if (!registered || finishing) return;

    setFinishing(true);
    setError(null);
    clearWatch();
    try {
      const response = await fetch("/api/run", { cache: "no-store" });
      const data = (await response.json()) as {
        points?: RunPoint[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "could not load your finished run");
      }

      const runnerPoints = Array.isArray(data.points)
        ? data.points.filter(
            (point) =>
              point.runnerName === registered.runnerName &&
              point.teamName === registered.teamName,
          )
        : [];
      setFinishedRun(summarize(runnerPoints));
      setStatusMessage(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "could not load your finished run",
      );
    } finally {
      setFinishing(false);
    }
  }

  function startAnotherRun() {
    setFinishedRun(null);
    setPointsSent(0);
    setLastFixTime(null);
    setStatusMessage(null);
    setError(null);
    lastPostAtRef.current = 0;
    lastAcceptedFixRef.current = null;
  }

  function startTracking() {
    if (!registered || tracking) return;
    if (!("geolocation" in navigator)) {
      setError("This browser does not support location tracking.");
      return;
    }

    setError(null);
    setStatusMessage("Waiting for your first location fix.");
    setTracking(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (watchIdRef.current === null) return;
        setLastFixTime(new Date(position.timestamp).toLocaleTimeString());

        const now = Date.now();
        if (now - lastPostAtRef.current < POST_INTERVAL_MS) return;

        const pace = paceFromFix(position, lastAcceptedFixRef.current);
        if (pace === null || !Number.isFinite(pace) || pace <= 0) {
          // Without a pace there is nothing honest to send, but this fix is the
          // baseline the next one measures against.
          lastAcceptedFixRef.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestampMs: position.timestamp,
          };
          setStatusMessage(
            "Location received; waiting for movement so I can measure honestly.",
          );
          return;
        }

        lastPostAtRef.current = now;
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date(position.timestamp).toISOString(),
          pace,
          runnerName: registered.runnerName,
          teamName: registered.teamName,
        };

        fetch("/api/points", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(point),
        })
          .then(async (response) => {
            const data = (await response.json()) as { error?: string };
            if (!response.ok)
              throw new Error(data.error ?? "could not save point");
            lastAcceptedFixRef.current = {
              latitude: point.latitude,
              longitude: point.longitude,
              timestampMs: position.timestamp,
            };
            setPointsSent((count) => count + 1);
            setStatusMessage("Tracking live.");
          })
          .catch((caught: unknown) => {
            setError(
              caught instanceof Error ? caught.message : "could not save point",
            );
          });
      },
      (geolocationError) => {
        setError(geolocationMessage(geolocationError));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
    watchIdRef.current = watchId;
  }

  return (
    <div className="flex flex-1 flex-col bg-black text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-8 sm:py-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em] text-[#c6ff00] uppercase sm:text-sm">
            Pacer track
          </p>
          <h1 className="mt-2 text-3xl leading-none font-black tracking-tight sm:text-6xl">
            Put your run <span className="text-[#c6ff00]">on the board.</span>
          </h1>
        </div>
      </header>

      {finishedRun ? (
        <FinishedRun
          summary={finishedRun}
          runner={registered}
          onStartAnotherRun={startAnotherRun}
        />
      ) : (
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 sm:gap-10 sm:px-8 sm:py-10">
          {!registered ? (
            <section className="max-w-xl rounded-3xl border border-[#c6ff00]/30 bg-[#c6ff00]/[0.06] p-6 sm:p-10">
              <p className="text-sm font-semibold tracking-[0.2em] text-[#c6ff00] uppercase">
                Join the run
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Who is running today?
              </h2>
              <form
                onSubmit={registerRunner}
                className="mt-8 flex flex-col gap-4"
              >
                <label className="flex flex-col gap-2 text-sm font-semibold text-white/60">
                  Your name
                  <input
                    required
                    value={runnerName}
                    onChange={(event) => setRunnerName(event.target.value)}
                    placeholder="Alex Morgan"
                    className="min-w-0 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg text-white placeholder:text-white/30 focus:border-[#c6ff00] focus:outline-none"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-white/60">
                  Team name
                  <input
                    required
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="Pacer Track Club"
                    className="min-w-0 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg text-white placeholder:text-white/30 focus:border-[#c6ff00] focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={registering}
                  className="mt-2 min-h-11 rounded-full bg-[#c6ff00] px-6 py-4 text-lg font-black text-black hover:brightness-110 disabled:opacity-60"
                >
                  {registering ? "Joining…" : "Join leaderboard"}
                </button>
              </form>
            </section>
          ) : (
            <section className="rounded-3xl border border-[#c6ff00]/30 bg-[#c6ff00]/[0.06] p-6 sm:p-10">
              <p className="text-sm font-semibold tracking-[0.2em] text-[#c6ff00] uppercase">
                Ready to run
              </p>
              <h2 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-6xl">
                {registered.runnerName}
              </h2>
              <p className="mt-2 text-2xl font-bold text-white/50">
                {registered.teamName}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                {!tracking ? (
                  <button
                    type="button"
                    onClick={startTracking}
                    className="min-h-11 rounded-full bg-[#c6ff00] px-7 py-4 text-lg font-black text-black hover:brightness-110"
                  >
                    Start tracking
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={stopTracking}
                      className="min-h-11 rounded-full border border-red-400/60 px-7 py-4 text-lg font-black text-red-300 hover:border-red-300"
                    >
                      Stop
                    </button>
                    <button
                      type="button"
                      onClick={() => void finishRun()}
                      disabled={finishing}
                      className="min-h-11 rounded-full bg-[#c6ff00] px-7 py-4 text-lg font-black text-black hover:brightness-110 disabled:opacity-60"
                    >
                      {finishing ? "Finishing…" : "Finish run"}
                    </button>
                  </>
                )}
                <a
                  href="/leaderboard"
                  className="min-h-11 rounded-full border border-white/20 px-7 py-4 text-lg font-semibold hover:border-[#c6ff00] hover:text-[#c6ff00]"
                >
                  Leaderboard
                </a>
              </div>
            </section>
          )}

          <section className="grid gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:grid-cols-3 sm:gap-8 sm:p-10">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
                Points sent
              </p>
              <p className="mt-2 text-5xl font-black tabular-nums text-[#c6ff00]">
                {pointsSent}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
                Last fix
              </p>
              <p className="mt-2 break-words text-2xl font-bold">
                {lastFixTime ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
                Status
              </p>
              <p className="mt-2 break-words text-lg font-semibold text-white/70">
                {tracking ? "Listening for GPS" : (statusMessage ?? "Ready")}
              </p>
            </div>
          </section>

          {(statusMessage || error) && (
            <p
              role="status"
              className={
                error ? "text-base text-red-300" : "text-base text-[#c6ff00]"
              }
            >
              {error ?? statusMessage}
            </p>
          )}
          <p className="max-w-2xl text-sm leading-relaxed text-white/40">
            GPS fixes are sent at most once every ten seconds. Pace comes from
            your device or the distance between accepted fixes; if neither is
            available, no point is invented or sent.
          </p>
        </main>
      )}
    </div>
  );
}

function FinishedRun({
  summary,
  runner,
  onStartAnotherRun,
}: {
  summary: RunSummary;
  runner: RunnerIdentity | null;
  onStartAnotherRun: () => void;
}) {
  const hasDistance = summary.totalDistanceMeters > 0;
  const hasAveragePace =
    hasDistance &&
    summary.elapsedSeconds > 0 &&
    summary.averagePaceMinPerKm !== null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 sm:gap-10 sm:px-8 sm:py-10">
      <section className="rounded-3xl border border-[#c6ff00]/30 bg-[#c6ff00]/[0.06] p-6 sm:p-10">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#c6ff00] uppercase">
          Run complete
        </p>
        <h2 className="mt-3 break-words text-3xl font-black tracking-tight sm:text-6xl">
          {runner?.runnerName ?? "Your run"}
        </h2>
        {runner && (
          <p className="mt-2 text-2xl font-bold text-white/50">
            {runner.teamName}
          </p>
        )}

        {summary.pointCount === 0 ? (
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70">
            No run points were recorded, so there is no distance, lap count, or
            pace to report yet.
          </p>
        ) : !hasDistance ? (
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-white/70">
            Points were recorded, but no movement could be measured, so there is
            no distance, lap count, or average pace to report yet.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-3 sm:gap-8">
            <FinishStat
              label="Distance"
              value={`${(summary.totalDistanceMeters / 1000).toFixed(2)} km`}
            />
            <FinishStat
              label="400 m laps"
              value={summary.lapCount.toFixed(1)}
            />
            <FinishStat
              label="Average pace"
              value={
                hasAveragePace ? formatPace(summary.averagePaceMinPerKm) : "—"
              }
            />
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          <a
            href="/coach"
            className="min-h-11 rounded-full bg-[#c6ff00] px-6 py-4 text-lg font-black text-black hover:brightness-110"
          >
            Ask your coach →
          </a>
          <a
            href="/leaderboard"
            className="min-h-11 rounded-full bg-[#c6ff00] px-6 py-4 text-lg font-black text-black hover:brightness-110"
          >
            See the board →
          </a>
        </div>
        <button
          type="button"
          onClick={onStartAnotherRun}
          className="mt-5 min-h-11 rounded-full border border-white/20 px-6 py-3 font-semibold text-white/70 hover:border-[#c6ff00] hover:text-[#c6ff00]"
        >
          Start another run
        </button>
      </section>
    </main>
  );
}

function FinishStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.2em] text-white/50 uppercase">
        {label}
      </p>
      <p className="mt-2 text-4xl font-black tabular-nums text-white sm:text-5xl">
        {value}
      </p>
    </div>
  );
}
