# Pacer

**The coach built by the run.**

Pacer is a live GPS running board and data-honest coach. The live deployment
is **https://pacer-gules.vercel.app**.

## Is the data real?

Yes. Nothing is simulated or seeded. When no points have been recorded, every
surface says so rather than displaying invented distance, pace, laps, or
sections.

The `/track` page uses the browser Geolocation API with
`watchPosition({ enableHighAccuracy: true })`. Roughly every ten seconds it
posts an accepted fix to `POST /api/points` containing:

```json
{
  "latitude": 51.5,
  "longitude": -0.12,
  "timestamp": "2025-01-01T12:00:00.000Z",
  "pace": 5.2,
  "runnerName": "Alex Morgan",
  "teamName": "Pacer Track Club"
}
```

Distance is the haversine distance between consecutive fixes. Laps are
distance divided by 400 metres. Pace comes from `coords.speed` when the device
supplies a finite positive value; otherwise it is derived from distance divided
by the time between accepted fixes. If neither source can measure pace
honestly, no point is sent. GPS accuracy depends on the device, browser,
permissions, signal, and environment.

## Pages

- `/` — explains Pacer and accepts an email signup.
- `/coach` — chat with the coach using the current run, with optional
  microphone input and spoken replies.
- `/live` — a big-screen board with the route, current and average pace,
  distance, laps, active runner, signup count, and registered runner count.
  It describes the single runner associated with the most recent point.
- `/track` — register a runner/team pair, start a high-accuracy GPS watch, and
  send measurable points to the live board.
- `/leaderboard` — ranks registered runners by their own distance, pace, laps,
  and deterministic data-honest comment. It includes a QR code to `/track`.
- `/build-map` — places the build's commits on a 400 m track and shows the
  matched GPS point, coordinates, lap position, and full commit message.

## API

All GET responses are dynamic and use `Cache-Control: no-store` where live data
is returned.

### Run points

- `POST /api/points` — append one point. Request shape:
  `{ latitude, longitude, timestamp, pace, runnerName, teamName }`.
  On success, returns `201` with `{ point, pointCount }`. Invalid data returns
  `400`; storage failures return `502`.
- `GET /api/points` — returns `{ points, pointCount }` in storage order.
- `GET /api/run` — returns a `RunSummary` with `points`, `pointCount`,
  `totalDistanceMeters`, `averagePaceMinPerKm`, `lapCount`,
  `elapsedSeconds`, `laps`, `fastestSection`, and `slowestSection`.
  Distances are summarized across all stored points for this low-level route;
  the live board and coach scope themselves to the latest runner.

### Coach and greeting

- `POST /api/coach` — request:
  `{ "messages": [{ "role": "user" | "assistant", "content": "..." }] }`.
  Returns `{ reply, source, dataQuality, context }`, where `source` is
  `model` or `fallback`.
- `GET /api/admin/greeting` — public response `{ greeting }`, with `null` when
  no greeting is configured.
- `POST /api/admin/greeting` — request `{ "greeting": "Short line" }`.
  Authenticate with `x-admin-token: <RUN_LOG_TOKEN>` or
  `Authorization: Bearer <RUN_LOG_TOKEN>`. The trimmed greeting must be
  non-empty and at most 140 characters. Success returns
  `{ greeting, updatedAt }`. Missing server configuration returns `503`,
  invalid credentials return `401`, invalid JSON or greeting content returns
  `400`, and storage errors return `502`.

Example:

```bash
curl -X POST https://pacer-gules.vercel.app/api/admin/greeting \
  -H 'content-type: application/json' \
  -H 'x-admin-token: <RUN_LOG_TOKEN>' \
  -d '{"greeting":"Hold that rhythm through the next lap."}'
```

### Signups and runners

- `POST /api/signups` — request `{ "email": "runner@example.com" }`.
  Returns `{ email, alreadySignedUp, signupCount }`; the first signup is
  `201`, a duplicate is `200`, invalid email is `400`, and storage failure is
  `502`.
- `GET /api/signups` — returns `{ signupCount }`.
- `POST /api/runners` — request `{ "runnerName": "Alex", "teamName": "Pacer" }`.
  Returns `201` with `{ runnerName, teamName, runnerCount }`. Empty names
  return `400`; storage failure returns `502`. Re-registering the same pair is
  idempotent.
- `GET /api/runners` — returns `{ runners, runnerCount }`.
- `GET /api/leaderboard` — returns
  `{ entries, runnerCount, updatedAt }`. Each entry contains
  `runnerName`, `teamName`, `totalDistanceMeters`, `averagePaceMinPerKm`,
  `lapCount`, `pointCount`, and `comment`.

### Voice

- `GET /api/speak` — returns `{ available }`.
- `POST /api/speak` — request `{ "text": "Lap 2 was 5:12/km." }`; returns
  `audio/mpeg` from the server-side ElevenLabs proxy. Missing configuration is
  `503`, invalid text is `400`, and an upstream speech failure is `502`.

The browser's Speech Recognition API provides microphone input on supported
Chrome, Edge, and Safari browsers. ElevenLabs provides spoken coach output;
running notation is converted for speech only (`5:12/km` becomes “five
minutes twelve seconds per kilometre”). Playback cancels older clips so
overlapping responses do not continue speaking over one another. On-screen
text remains compact.

## Data honesty

Coach summaries use four `dataQuality` levels:

- `none` — no points exist; no run numbers are available.
- `single` — one point exists; distance, elapsed time, laps, and sections are
  not measurable.
- `thin` — multiple points exist but there is no measurable elapsed distance or
  no complete 400 m lap; the coach quotes only recorded values and does not
  call splits.
- `rich` — measurable points include at least one complete lap, so lap and
  section analysis is valid.

With no model key, `/api/coach` uses a deterministic fallback built from the
same summary. If a model request fails or returns empty content, it also falls
back instead of breaking the page. The coach and live board select the
runner/team pair holding the most recent point; other runners are not merged
into that run's distance or pace.

## Storage

With `BLOB_READ_WRITE_TOKEN` configured, Vercel Blob stores:

- `points/` — one JSON blob per GPS point.
- `signups/<sha256>.json` — deduplicated signup records; email addresses never
  appear in public pathnames.
- `runners/<sha256>.json` — deduplicated runner/team records.
- `config/greeting-<timestamp>-<uuid>.json` — versioned greetings, with older
  records cleaned up after a successful update.

When `BLOB_READ_WRITE_TOKEN` is absent or empty, the app uses an in-memory
fallback for local development and tests. It resets when the server restarts
and is not durable across serverless instances.

## Build Map provenance

`npm run commits` runs `scripts/build-commits.mjs` and writes the build-time git
history snapshot to `data/commits.json`, because the deployed runtime does not
depend on a `.git` directory. `/build-map` cross-references commit timestamps
with the nearest GPS timestamp and calculates each matched pin's position in
that runner's own sequence.

Commit timestamps and GPS timestamps are separate records. A nearest-time
match does not mean a commit happened at a run point.

## Environment variables

| Variable                                | Purpose                                                                                               | When missing                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `BLOB_READ_WRITE_TOKEN`                 | Enables durable Vercel Blob storage                                                                   | Uses in-memory storage                      |
| `OPENAI_API_KEY` / `AI_GATEWAY_API_KEY` | Coach provider key; the selected key's `sk-` shape chooses direct OpenAI, otherwise Vercel AI Gateway | Coach uses deterministic fallback           |
| `AI_MODEL` / `COACH_MODEL`              | Model name; `COACH_MODEL` takes precedence                                                            | Defaults to `gpt-4o-mini`                   |
| `AI_BASE_URL`                           | Overrides the provider base URL                                                                       | Uses the key-selected OpenAI or Gateway URL |
| `ELEVENLABS_API_KEY`                    | Enables server-side coach speech                                                                      | Speech endpoint reports unavailable         |
| `ELEVENLABS_VOICE_ID`                   | ElevenLabs voice                                                                                      | Defaults to Rachel                          |
| `RUN_LOG_TOKEN`                         | Authenticates admin greeting writes                                                                   | Greeting POST returns `503`                 |

No credentials belong in source control or in this documentation.

## Local development and deployment

```bash
npm install
npm run dev
# open http://localhost:3000

npm run lint
npm run build
npm run start
npm run commits
```

Deploy through the project's configured Vercel workflow. The production URL is
https://pacer-gules.vercel.app.

## Known limitations

- `/live` and `/api/coach` describe one latest runner, not a combined
  all-runners run. Use `/leaderboard` for the full board.
- GPS fixes can be inaccurate, delayed, or unavailable, and browser permission
  or battery settings can affect tracking.
- Spoken microphone input has not been verified in automation and depends on
  browser support and permission.
