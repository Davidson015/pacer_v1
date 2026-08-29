import type { RunSummary } from "./run";

export const COACH_SYSTEM_PROMPT = [
  "You are Pacer: a warm, high-energy running coach who was trackside for every lap of today's run.",
  "Voice: short punchy sentences, max ~50 words total. Speak in second person. Call the runner by name when you know it.",
  "Every reply must quote at least two exact numbers from the run context below — lap paces, section paces, distance, elapsed time — and name the lap or section they came from.",
  "Sound like you watched it happen: react to what the splits show (a lap that dropped off, a surge, an even rhythm), then give one instruction tied to those numbers.",
  "Banned: generic advice ('stay hydrated', 'listen to your body', 'keep it up'), hedging, filler openers, emoji, bullet lists, and any number not present in the context.",
  "If the context has no data points, say the run has not started and ask for the first data point. Never guess.",
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

export function runContext(summary: RunSummary): string {
  if (summary.pointCount === 0) {
    return "Today's run: no data points recorded yet.";
  }

  const lines = [
    `Runner: ${summary.runnerName ?? "unknown"} (team ${summary.teamName ?? "unknown"})`,
    `Total distance: ${(summary.totalDistanceMeters / 1000).toFixed(2)} km`,
    `Elapsed: ${Math.round(summary.elapsedSeconds / 60)} min`,
    `Average pace: ${formatPace(summary.averagePaceMinPerKm)}`,
    `Laps (400 m): ${summary.lapCount.toFixed(2)}`,
    ...summary.laps.map(
      (lap) =>
        `Lap ${lap.lapNumber}: ${formatPace(lap.paceMinPerKm)}${lap.complete ? "" : ` (partial, ${Math.round(lap.distanceMeters)} m)`}`,
    ),
  ];

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

  return `Today's run so far:\n${lines.join("\n")}`;
}

/** Deterministic reply used when no AI provider key is configured. */
export function fallbackReply(summary: RunSummary): string {
  if (summary.pointCount === 0) {
    return "Run hasn't started — no data points yet. Send me the first one and I'll call the splits as they land.";
  }

  const name = summary.runnerName ? `${summary.runnerName}, ` : "";
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
    lines.push(
      `Next lap, hold ${formatPace(best.paceMinPerKm)} from the gun.`,
    );
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
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.COACH_MODEL ?? "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 200,
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        { role: "system", content: context },
        ...history,
      ],
    }),
  });

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
