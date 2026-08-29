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
- `GET /api/run` — the run so far: `totalDistanceMeters` (haversine), `averagePaceMinPerKm`, `lapCount` (400 m track), `elapsedSeconds`, per-lap splits, fastest and slowest sections.
- `POST /api/coach` — `{ messages: [{ role, content }] }`; replies as the coach using today's run data as context, plus a `dataQuality` of `none`, `single`, `thin` or `rich`.
- `GET /api/speak` — `{ available }`, whether text to speech is configured.
- `POST /api/speak` — `{ text }`; returns `audio/mpeg` spoken by ElevenLabs (the API key never leaves the server). Running shorthand is expanded for speech only — `5:12/km` becomes "five minutes twelve seconds per kilometre", `km 3` becomes "kilometre three" — so on-screen text stays compact.

Storage is in-process and resets when the server restarts (and is per-instance on serverless).

## Coach page

`/coach` is a chat interface. Each reply reloads today's run and passes distance, average pace, per-lap paces and fastest/slowest sections to the model.

Set `OPENAI_API_KEY` (optionally `COACH_MODEL`, default `gpt-4o-mini`) to enable the AI coach. Without a key the endpoint returns a deterministic reply built from the same real numbers.

Every coach reply is spoken aloud with ElevenLabs, and a speaker button replays any message. Set `ELEVENLABS_API_KEY` to enable it (optionally `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`, defaults Rachel / `eleven_turbo_v2_5`); without a key the buttons are disabled and the chat still works.

With no points, a single point, or points that cover no measurable distance or less than one 400 m lap, the context marks the data as thin: the coach says so, quotes only what was recorded, skips lap and section analysis, and asks for more points. The page shows the same warning.

## Deployment

Deployed on [Vercel](https://vercel.com).
