export type RunPoint = {
  latitude: number;
  longitude: number;
  timestamp: string;
  pace: number;
  runnerName: string;
  teamName: string;
};

export type RunSummary = {
  points: RunPoint[];
  pointCount: number;
  runnerName: string | null;
  teamName: string | null;
  totalDistanceMeters: number;
  averagePaceMinPerKm: number | null;
  lapCount: number;
  elapsedSeconds: number;
};

export const TRACK_LAP_METERS = 400;

const points: RunPoint[] = [];

export function addPoint(point: RunPoint): RunPoint {
  points.push(point);
  return point;
}

export function getPoints(): RunPoint[] {
  return [...points];
}

export function parsePoint(body: unknown): RunPoint | string {
  if (typeof body !== "object" || body === null) {
    return "body must be a JSON object";
  }
  const raw = body as Record<string, unknown>;
  const numbers: Array<keyof RunPoint> = ["latitude", "longitude", "pace"];
  for (const field of numbers) {
    if (typeof raw[field] !== "number" || !Number.isFinite(raw[field])) {
      return `${field} must be a finite number`;
    }
  }
  const strings: Array<keyof RunPoint> = ["timestamp", "runnerName", "teamName"];
  for (const field of strings) {
    if (typeof raw[field] !== "string" || raw[field] === "") {
      return `${field} must be a non-empty string`;
    }
  }
  const latitude = raw.latitude as number;
  const longitude = raw.longitude as number;
  const timestamp = raw.timestamp as string;
  if (latitude < -90 || latitude > 90) {
    return "latitude must be between -90 and 90";
  }
  if (longitude < -180 || longitude > 180) {
    return "longitude must be between -180 and 180";
  }
  if (Number.isNaN(Date.parse(timestamp))) {
    return "timestamp must be a parseable date string";
  }
  return {
    latitude,
    longitude,
    timestamp,
    pace: raw.pace as number,
    runnerName: raw.runnerName as string,
    teamName: raw.teamName as string,
  };
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: RunPoint, b: RunPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function summarize(run: RunPoint[]): RunSummary {
  let totalDistanceMeters = 0;
  for (let i = 1; i < run.length; i++) {
    totalDistanceMeters += distanceMeters(run[i - 1], run[i]);
  }

  const first = run[0];
  const last = run[run.length - 1];
  const elapsedSeconds =
    run.length > 1
      ? Math.max(
          0,
          (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 1000,
        )
      : 0;

  const averagePaceMinPerKm =
    totalDistanceMeters > 0 && elapsedSeconds > 0
      ? elapsedSeconds / 60 / (totalDistanceMeters / 1000)
      : run.length > 0
        ? run.reduce((sum, point) => sum + point.pace, 0) / run.length
        : null;

  return {
    points: run,
    pointCount: run.length,
    runnerName: first?.runnerName ?? null,
    teamName: first?.teamName ?? null,
    totalDistanceMeters,
    averagePaceMinPerKm,
    lapCount: totalDistanceMeters / TRACK_LAP_METERS,
    elapsedSeconds,
  };
}
