import { TRACK_LAP_METERS, distanceMeters, type RunPoint } from "./run";

export type Commit = {
  hash: string;
  isoDate: string;
  subject: string;
  body?: string;
};

export type Pin = {
  commit: Commit;
  /** Metres run when the commit landed, null when there is no run data to match. */
  distanceMeters: number | null;
  lapNumber: number;
  runnerName: string | null;
  teamName: string | null;
  matchedTimestamp: string | null;
  latitude: number | null;
  longitude: number | null;
  metersIntoLap: number | null;
  /** Seconds between the commit and its matched run point. */
  matchOffsetSeconds: number | null;
  x: number;
  y: number;
};

// A 400 m track: two 84.39 m straights joined by two 36.5 m radius bends.
const STRAIGHT_METERS = 84.39;
const BEND_RADIUS_METERS = 36.5;
const BEND_METERS = Math.PI * BEND_RADIUS_METERS;

export const TRACK_VIEWBOX = { width: 1000, height: 620 };

const SCALE =
  (TRACK_VIEWBOX.width - 120) / (STRAIGHT_METERS + 2 * BEND_RADIUS_METERS);
const CENTRE_Y = TRACK_VIEWBOX.height / 2;
const LEFT_BEND_X = TRACK_VIEWBOX.width / 2 - (STRAIGHT_METERS * SCALE) / 2;
const RIGHT_BEND_X = TRACK_VIEWBOX.width / 2 + (STRAIGHT_METERS * SCALE) / 2;
const RADIUS = BEND_RADIUS_METERS * SCALE;

/**
 * Maps metres into a lap onto the oval, starting on the home straight and
 * running clockwise: bottom straight, right bend, top straight, left bend.
 */
export function trackPosition(metresIntoLap: number): { x: number; y: number } {
  const d =
    ((metresIntoLap % TRACK_LAP_METERS) + TRACK_LAP_METERS) % TRACK_LAP_METERS;

  if (d < STRAIGHT_METERS) {
    const t = d / STRAIGHT_METERS;
    return {
      x: LEFT_BEND_X + t * (RIGHT_BEND_X - LEFT_BEND_X),
      y: CENTRE_Y + RADIUS,
    };
  }
  if (d < STRAIGHT_METERS + BEND_METERS) {
    const angle = ((d - STRAIGHT_METERS) / BEND_METERS) * Math.PI;
    return {
      x: RIGHT_BEND_X + RADIUS * Math.sin(angle),
      y: CENTRE_Y + RADIUS * Math.cos(angle),
    };
  }
  if (d < 2 * STRAIGHT_METERS + BEND_METERS) {
    const t = (d - STRAIGHT_METERS - BEND_METERS) / STRAIGHT_METERS;
    return {
      x: RIGHT_BEND_X - t * (RIGHT_BEND_X - LEFT_BEND_X),
      y: CENTRE_Y - RADIUS,
    };
  }
  const angle =
    ((d - 2 * STRAIGHT_METERS - BEND_METERS) / BEND_METERS) * Math.PI;
  return {
    x: LEFT_BEND_X - RADIUS * Math.sin(angle),
    y: CENTRE_Y - RADIUS * Math.cos(angle),
  };
}

export function trackPath(): string {
  const steps = 240;
  return (
    Array.from({ length: steps + 1 }, (_, index) => {
      const position = trackPosition((index / steps) * TRACK_LAP_METERS);
      return `${index === 0 ? "M" : "L"}${position.x.toFixed(1)} ${position.y.toFixed(1)}`;
    }).join(" ") + " Z"
  );
}

/** Cumulative metres run at each point, so a matched point gives a lap and position. */
function cumulativeDistances(points: RunPoint[]): number[] {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + distanceMeters(points[i - 1], points[i]),
    );
  }
  return cumulative;
}

/**
 * Pins every commit onto the track at the position of the run point closest in
 * time. Without run data, commits are spread evenly around the lap in order so
 * the map still reads, with distance left null to mark the position as unknown.
 */
export function buildPins(commits: Commit[], points: RunPoint[]): Pin[] {
  const cumulative = cumulativeDistances(points);
  const times = points.map((point) => Date.parse(point.timestamp));

  return commits.map((commit, index) => {
    const commitTime = Date.parse(commit.isoDate);

    if (points.length === 0 || Number.isNaN(commitTime)) {
      const spread = (index / Math.max(1, commits.length)) * TRACK_LAP_METERS;
      return {
        commit,
        distanceMeters: null,
        lapNumber: 0,
        runnerName: null,
        teamName: null,
        matchedTimestamp: null,
        latitude: null,
        longitude: null,
        metersIntoLap: null,
        matchOffsetSeconds: null,
        ...trackPosition(spread),
      };
    }

    let closest = 0;
    for (let i = 1; i < times.length; i++) {
      if (
        Math.abs(times[i] - commitTime) < Math.abs(times[closest] - commitTime)
      ) {
        closest = i;
      }
    }

    const metres = cumulative[closest];
    return {
      commit,
      distanceMeters: metres,
      lapNumber: Math.floor(metres / TRACK_LAP_METERS) + 1,
      runnerName: points[closest].runnerName,
      teamName: points[closest].teamName,
      matchedTimestamp: points[closest].timestamp,
      latitude: points[closest].latitude,
      longitude: points[closest].longitude,
      metersIntoLap: metres % TRACK_LAP_METERS,
      matchOffsetSeconds: Math.round(
        Math.abs(times[closest] - commitTime) / 1000,
      ),
      ...trackPosition(metres),
    };
  });
}
