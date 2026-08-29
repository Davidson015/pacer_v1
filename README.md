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
- `POST /api/signups` — `{ email }`; stores a landing-page signup (deduped, lowercased). `GET /api/signups` returns the count only.
- `POST /api/runners` — `{ runnerName, teamName }`; registers a runner/team pair for the leaderboard (deduped). `GET /api/runners` returns all registered runners and the count.
- `GET /api/leaderboard` — builds the ranked runner table from registered runners and their run points, including deterministic data-honest coach comments.
- `GET /api/speak` — `{ available }`, whether text to speech is configured.
- `POST /api/speak` — `{ text }`; returns `audio/mpeg` spoken by ElevenLabs (the API key never leaves the server). Running shorthand is expanded for speech only — `5:12/km` becomes "five minutes twelve seconds per kilometre", `km 3` becomes "kilometre three" — so on-screen text stays compact.

Run points and signups are stored durably in Vercel Blob. When
`BLOB_READ_WRITE_TOKEN` is not set, the app falls back to in-process memory for
local development and tests; that fallback resets when the server restarts and
is per-instance on serverless.

## Coach page

`/coach` is a chat interface. Each reply reloads today's run and passes distance, average pace, per-lap paces and fastest/slowest sections to the model.

Set `OPENAI_API_KEY` (optionally `COACH_MODEL`, default `gpt-4o-mini`) to enable the AI coach. Without a key the endpoint returns a deterministic reply built from the same real numbers.

The microphone button dictates a question with the browser's Web Speech API (Chrome, Edge, Safari) and sends it as soon as speech ends, so the loop is voice in, text plus voice out.

Every coach reply is spoken aloud with ElevenLabs, and a speaker button replays any message. Set `ELEVENLABS_API_KEY` to enable it (optionally `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`, defaults Rachel / `eleven_turbo_v2_5`); without a key the buttons are disabled and the chat still works.

With no points, a single point, or points that cover no measurable distance or less than one 400 m lap, the context marks the data as thin: the coach says so, quotes only what was recorded, skips lap and section analysis, and asks for more points. The page shows the same warning.

## Live

`/live` is a big-screen board for today's run: the route drawn from the recorded coordinates, current pace, total distance, lap count, average pace, who is running now, today's signup count and registered runner count. It refreshes from `/api/run`, `/api/signups` and `/api/leaderboard` every ten seconds.

## Track

`/track` registers a runner and team, remembers them in the browser, and uses a high-accuracy geolocation watch to send an honest GPS point at most every ten seconds. Pace comes from the device speed or the distance and time between accepted fixes; points are skipped when neither is available.

## Leaderboard

`/leaderboard` ranks registered runners and any point contributors by total distance, with average pace, laps and a deterministic comment based on data quality. It includes a scannable QR code whose URL is the current host's `/track` page. Values that cannot be measured yet are shown as `—`.

## Build map

`/build-map` pins every commit onto a 400 m track. Each commit is matched to the run point closest in time, which gives the lap, the metres run and the teammate who was running; the pin card shows the commit message and time, and flags when the nearest run point is more than two minutes away. Commits that predate any run data are spread around the lap in order and marked as unpositioned.

The git history is snapshotted into `data/commits.json`, because the git directory is not available at runtime. Refresh it with `npm run commits` after committing.

## Deployment

Deployed on [Vercel](https://vercel.com).
