const ONES = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

/** Small whole numbers as words, so paces are read as speech, not digits. */
function words(value: number): string {
  if (value < 20) return ONES[value];
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)];
    const ones = value % 10;
    return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
  }
  return String(value);
}

function spokenClock(minutes: number, seconds: number, unit: string): string {
  const parts = [`${words(minutes)} ${minutes === 1 ? "minute" : "minutes"}`];
  if (seconds > 0) {
    parts.push(`${words(seconds)} ${seconds === 1 ? "second" : "seconds"}`);
  }
  return `${parts.join(" ")}${unit}`;
}

/**
 * Rewrites running shorthand into words a voice can read naturally:
 * "5:12/km" -> "five minutes twelve seconds per kilometre",
 * "km 3" -> "kilometre three", "400 m" -> "400 metres".
 */
export function toSpokenText(text: string): string {
  return (
    text
      // 5:12/km, 5:12 per km, 5:12 min/km
      .replace(
        /(\d{1,3}):([0-5]\d)\s*(?:min\s*)?(?:\/|per\s+)\s*km\b/gi,
        (_match, minutes: string, seconds: string) =>
          spokenClock(Number(minutes), Number(seconds), " per kilometre"),
      )
      // bare clock times: 2:24, 41:07
      .replace(
        /(\d{1,3}):([0-5]\d)\b/g,
        (_match, minutes: string, seconds: string) =>
          spokenClock(Number(minutes), Number(seconds), ""),
      )
      // km 3, Km 12, m 200
      .replace(
        /\bkm\s+(\d+)\b/gi,
        (_match, index: string) => `kilometre ${words(Number(index))}`,
      )
      .replace(
        /\bm\s+(\d+)\b/g,
        (_match, index: string) => `metre ${words(Number(index))}`,
      )
      // units after a number
      .replace(/(\d)\s*km\b/gi, (_match, digit: string) =>
        `${digit} kilometres`,
      )
      .replace(/(\d)\s*(?:m|metres|meters)\b/gi, (_match, digit: string) =>
        `${digit} metres`,
      )
      .replace(/(\d)\s*(?:min|mins|minutes)\b/gi, (_match, digit: string) =>
        `${digit} minutes`,
      )
      .replace(/(\d)\s*(?:s|sec|secs|seconds)\b/gi, (_match, digit: string) =>
        `${digit} seconds`,
      )
      // attributive use: "400 metre lap", not "400 metres lap"
      .replace(/(\d)\s*metres (lap|track|split|section)\b/gi, "$1 metre $2")
      .replace(/\b1 kilometres\b/g, "1 kilometre")
      .replace(/\b1 metres\b/g, "1 metre")
      .replace(/\b1 minutes\b/g, "1 minute")
      .replace(/\b1 seconds\b/g, "1 second")
      // leftover shorthand
      .replace(/\bmin\s*\/\s*km\b/gi, "minutes per kilometre")
      .replace(/\/\s*km\b/gi, " per kilometre")
      .replace(/\bn\/a\b/gi, "not available")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}
