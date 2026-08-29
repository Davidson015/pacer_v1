# Pacer

the coach built by the run

A [Next.js](https://nextjs.org) app written in TypeScript.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint

## API

- `POST /api/points` — append a run data point: `latitude`, `longitude`, `timestamp` (date string), `pace`, `runnerName`, `teamName`.
- `GET /api/points` — the stored points, in the order received.
- `GET /api/run` — the run so far: `totalDistanceMeters` (haversine), `averagePaceMinPerKm`, `lapCount` (400 m track), `elapsedSeconds`.

Storage is in-process and resets when the server restarts (and is per-instance on serverless).

## Deployment

Deployed on [Vercel](https://vercel.com).
