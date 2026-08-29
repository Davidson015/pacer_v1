import type { RunSummary } from "./run";

export const COACH_SYSTEM_PROMPT = [
  "You are Pacer, a warm, punchy running coach. Two or three short sentences, max ~60 words.",
  "Always cite specific real numbers from today's run context: distance, average pace, lap paces, fastest and slowest sections.",
  "Never invent numbers. If the run context has no data, say the run has not started yet and ask for the first data point.",
].join(" ");

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
    return "No data points yet today — send your first one and I'll call the splits as they land.";
  }
  const fastest = summary.fastestSection
    ? ` Your fastest section clocked ${formatPace(summary.fastestSection.paceMinPerKm)}`
    : "";
  const slowest = summary.slowestSection
    ? `, the slowest ${formatPace(summary.slowestSection.paceMinPerKm)}.`
    : ".";
  return `${(summary.totalDistanceMeters / 1000).toFixed(2)} km down at ${formatPace(summary.averagePaceMinPerKm)}, ${summary.lapCount.toFixed(1)} laps of the track.${fastest}${slowest} Hold that rhythm and keep the turnover quick. (AI coach offline — numbers are live.)`;
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
