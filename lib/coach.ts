import type { Lap, RunSummary } from "./run";

export const COACH_SYSTEM_PROMPT = [
  "You are Pacer: a warm, high-energy running coach who was trackside for every lap of today's run.",
  "Voice: short punchy sentences, max ~50 words total. Speak in second person. Call the runner by name when you know it.",
  "Every reply must quote at least two exact numbers from the run context below — lap paces, section paces, distance, elapsed time — and name the lap or section they came from.",
  "Sound like you watched it happen: react to what the splits show (a lap that dropped off, a surge, an even rhythm), then give one instruction tied to those numbers.",
  "Banned: generic advice ('stay hydrated', 'listen to your body', 'keep it up'), hedging, filler openers, emoji, bullet lists, and any number not present in the context.",
  "Data honesty overrides everything: use only numbers written in the context, never extrapolate, project, or fill a gap.",
  "When the context says data is thin or missing, say so plainly in one line, quote whatever real numbers exist (possibly none), ask for more data points, and give no lap or section analysis.",
].join(" ");

export const STARTER_QUESTIONS = [
  "How was my pacing today?",
  "Where did I struggle?",
  "What should I push on next?",
];

export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null || !Number.isFinite(minPerKm)) return "n/a";
  const minutes = Math.floor(minPerKm);
  const seconds = Math.round((minPerKm - minutes) * 60);
  const carry = seconds === 60;
  return `${carry ? minutes + 1 : minutes}:${String(carry ? 0 : seconds).padStart(2, "0")}/km`;
}

export type DataQuality = "none" | "single" | "thin" | "rich";

/** How much of today's run can actually be described without guessing. */
export function dataQuality(summary: RunSummary): DataQuality {
  if (summary.pointCount === 0) return "none";
  if (summary.pointCount === 1) return "single";
  const measurable =
    summary.totalDistanceMeters > 0 && summary.elapsedSeconds > 0;
  if (!measurable) return "thin";
  return summary.laps.some((lap) => lap.complete) ? "rich" : "thin";
}

export function leaderboardComment(summary: RunSummary): string {
  const quality = dataQuality(summary);

  if (quality === "none") {
    return "No points yet — start tracking and I'll call your splits.";
  }
  if (quality === "single") {
    return "One point in, nothing measurable yet — keep tracking and I'll call your splits.";
  }
  if (quality === "thin") {
    return `${(summary.totalDistanceMeters / 1000).toFixed(2)} km in — no complete lap yet, so I'm holding the split call.`;
  }

  const laps = summary.laps.filter(
    (lap) => lap.complete && lap.paceMinPerKm !== null,
  );
  const fastest = laps.reduce<Lap | null>(
    (best, lap) =>
      best === null ||
      (lap.paceMinPerKm ?? Infinity) < (best.paceMinPerKm ?? Infinity)
        ? lap
        : best,
    null,
  );
  return fastest
    ? `Averaging ${formatPace(summary.averagePaceMinPerKm)}; lap ${fastest.lapNumber} was quickest at ${formatPace(fastest.paceMinPerKm)}.`
    : `Averaging ${formatPace(summary.averagePaceMinPerKm)}; full splits are coming through.`;
}

function reportedPace(summary: RunSummary): string {
  const paces = summary.points.map((point) => point.pace);
  const mean = paces.reduce((sum, pace) => sum + pace, 0) / paces.length;
  return `${mean.toFixed(2)} min/km`;
}

export function runContext(summary: RunSummary): string {
  const quality = dataQuality(summary);

  if (quality === "none") {
    return "Today's run: no data points recorded yet. DATA STATUS: nothing to analyse — no distance, pace, laps or sections exist.";
  }

  const who = `Runner: ${summary.runnerName ?? "unknown"} (team ${summary.teamName ?? "unknown"})`;

  if (quality === "single") {
    return [
      "Today's run so far:",
      who,
      `Data points: 1 (recorded ${summary.points[0].timestamp})`,
      `Device-reported pace at that point: ${reportedPace(summary)}`,
      "DATA STATUS: thin — one point only, so distance, average pace, laps and sections cannot be measured yet. Do not estimate them.",
    ].join("\n");
  }

  const measurable =
    summary.totalDistanceMeters > 0 && summary.elapsedSeconds > 0;

  const lines = [
    who,
    `Data points: ${summary.pointCount}`,
    `Total distance: ${(summary.totalDistanceMeters / 1000).toFixed(2)} km`,
    `Elapsed: ${Math.round(summary.elapsedSeconds / 60)} min`,
    measurable
      ? `Average pace: ${formatPace(summary.averagePaceMinPerKm)}`
      : `Average pace: not measurable yet; device-reported pace averages ${reportedPace(summary)}`,
    `Laps (400 m): ${summary.lapCount.toFixed(2)}`,
  ];

  if (measurable) {
    lines.push(
      ...summary.laps.map(
        (lap) =>
          `Lap ${lap.lapNumber}: ${formatPace(lap.paceMinPerKm)}${lap.complete ? "" : ` (partial, ${Math.round(lap.distanceMeters)} m)`}`,
      ),
    );
    if (summary.fastestSection) {
      lines.push(
        `Fastest section: points ${summary.fastestSection.fromIndex}-${summary.fastestSection.toIndex} at ${formatPace(summary.fastestSection.paceMinPerKm)}`,
      );
    }
    if (summary.slowestSection) {
      lines.push(
        `Slowest section: points ${summary.slowestSection.fromIndex}-${summary.slowestSection.toIndex} at ${formatPace(summary.slowestSection.paceMinPerKm)}`,
      );
    }
  }

  lines.push(
    quality === "rich"
      ? "DATA STATUS: full — lap and section analysis is valid."
      : "DATA STATUS: thin — no complete 400 m lap yet, so there are no lap splits to compare. Quote only the numbers above.",
  );

  return `Today's run so far:\n${lines.join("\n")}`;
}

/** Deterministic reply used when no AI provider key is configured. */
export function fallbackReply(summary: RunSummary): string {
  const quality = dataQuality(summary);
  const name = summary.runnerName ? `${summary.runnerName}, ` : "";

  if (quality === "none") {
    return "Run hasn't started — no data points yet. Send me the first one and I'll call the splits as they land.";
  }

  if (quality === "single") {
    return `${name}one data point in, nothing to measure yet — no distance, no laps. Keep them coming and I'll call your splits.`;
  }

  if (quality === "thin") {
    const measured =
      summary.totalDistanceMeters > 0
        ? `${Math.round(summary.totalDistanceMeters)} m over ${Math.round(summary.elapsedSeconds)} s`
        : "no measurable distance yet";
    return `${name}data's thin: ${summary.pointCount} points, ${measured}. Not a full 400 m lap, so I'm not calling splits yet. Send more points.`;
  }

  const lines = [
    `${name}${(summary.totalDistanceMeters / 1000).toFixed(2)} km, ${summary.lapCount.toFixed(1)} laps, ${formatPace(summary.averagePaceMinPerKm)} average.`,
  ];

  const paced = summary.laps.filter((lap) => lap.paceMinPerKm !== null);
  if (paced.length > 1) {
    const best = paced.reduce((a, b) =>
      (a.paceMinPerKm ?? 0) <= (b.paceMinPerKm ?? 0) ? a : b,
    );
    const worst = paced.reduce((a, b) =>
      (a.paceMinPerKm ?? 0) >= (b.paceMinPerKm ?? 0) ? a : b,
    );
    lines.push(
      `Lap ${best.lapNumber} was your sharpest at ${formatPace(best.paceMinPerKm)}; lap ${worst.lapNumber} sagged to ${formatPace(worst.paceMinPerKm)}.`,
    );
    lines.push(`Next lap, hold ${formatPace(best.paceMinPerKm)} from the gun.`);
  } else if (summary.slowestSection && summary.fastestSection) {
    lines.push(
      `Quickest section ${formatPace(summary.fastestSection.paceMinPerKm)}, slowest ${formatPace(summary.slowestSection.paceMinPerKm)}.`,
    );
    lines.push(
      `Take the next 400 m at ${formatPace(summary.fastestSection.paceMinPerKm)}.`,
    );
  }

  return lines.join(" ");
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function askModel(
  apiKey: string,
  context: string,
  history: ChatMessage[],
  {
    baseUrl,
    model,
  }: {
    baseUrl: string;
    model: string;
  },
): Promise<string> {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const messages = [
    { role: "system", content: COACH_SYSTEM_PROMPT },
    { role: "system", content: context },
    ...history,
  ];
  const isGpt4oFamily = /^(?:[^/]+\/)?gpt-4o(?:[-/]|$)/i.test(model);
  const payload: Record<string, unknown> = {
    model,
    messages,
    ...(isGpt4oFamily
      ? { temperature: 0.7, max_tokens: 200 }
      : { max_completion_tokens: 200 }),
  };
  const request = (body: Record<string, unknown>) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

  let response = await request(payload);
  if (response.status === 400) {
    const errorText = await response.text();
    const mentionsUnsupportedParameter =
      /unsupported parameter|parameter.+(?:not supported|unsupported)|(?:temperature|max_tokens|max_completion_tokens).+(?:not supported|unsupported)/i.test(
        errorText,
      );
    if (mentionsUnsupportedParameter) {
      const retryPayload = { ...payload };
      if (/temperature/i.test(errorText)) delete retryPayload.temperature;
      if (/max_tokens/i.test(errorText)) delete retryPayload.max_tokens;
      if (/max_completion_tokens/i.test(errorText)) {
        delete retryPayload.max_completion_tokens;
      }
      response = await request(retryPayload);
    }
  }

  if (!response.ok) {
    throw new Error(`model request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("model returned an empty reply");
  }
  return reply;
}
