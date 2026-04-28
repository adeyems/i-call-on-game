# I Call On

A multiplayer party word game. The host shares a room code, everyone joins, and on each turn one player calls a number `1–26` (which maps to `A–Z`). Once the letter is called, every player races to fill five categories with words starting with that letter:

> **Name · Animal · Place · Thing · Food**

Live at **[icallon.cardgamelobby.com](https://icallon.cardgamelobby.com)** (alias: `i-call-on.cardgamelobby.com`).

---

## Quick start

```bash
npm install
npm run dev:worker   # Cloudflare Worker on :8787 (api)
npm run dev:web      # Next.js web on :3000
```

Open the web app, create a room, share the link with a friend.

> The web app expects the API at `process.env.NEXT_PUBLIC_API_BASE_URL` (defaults to `https://api.icallon.cardgamelobby.com`). For local dev, override it in `apps/web/.env.local`:
> ```
> NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
> ```

---

## Architecture

The whole thing runs on Cloudflare's edge — no traditional server, no database round-trips on the hot path.

```
Browser ──── WebSocket ────►  Worker route handler ──► Durable Object (one per room)
   ▲                                                          │
   │                                                          │
   └────────── snapshot / event broadcasts ◄──────────────────┘
                    (state + serverTime)
```

| Layer | Tech | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind v4 | Static export, served from a Worker with `[assets]` binding |
| API + realtime | Cloudflare Worker + Durable Object | One DO instance per room — single-threaded source of truth, free WebSocket fan-out |
| Storage | DO storage + D1 | DO storage holds in-flight room state; D1 records room metadata |
| Shared protocol | `packages/shared` | Types and constants used by both web and worker |

A round's lifecycle:

1. Host creates room → gets a room code + host token.
2. Players join via `/join?code=XYZ` → host admits each request.
3. Host clicks **Start game** → server picks a turn order.
4. Active player calls a number → server picks the corresponding letter, sets `endsAt` and broadcasts `turn_called`.
5. Every player drafts answers; the client auto-saves drafts to the server every 280ms (and immediately when `< 3s` from `endsAt`) so timer-end can force-submit them.
6. Round ends by configured rule (timer expires, host submits, caller submits, or first submission). Server runs `withForcedSubmissions` — anyone who didn't submit gets their last-known draft auto-submitted.
7. Host scores each answer; everyone sees the live ✓/✕ marks; host publishes.
8. Repeat with the next caller.

---

## Repository layout

```
apps/
  web/              Next.js 16 frontend (static-exported, served via Worker assets)
    app/            Routes: / (home), /lobby, /join, /game
    components/     Feature folders: home, lobby, join, game, shared
    lib/            api client, useRoomSocket (with reconnect), useNowTick (with clock offset),
                    sound, session helpers
  worker/           Cloudflare Worker + Durable Object
    src/index.ts    Route parsing, REST → DO proxy
    src/room.ts     Game logic + DO class (state, alarms, WebSocket fan-out)
    migrations/     D1 schema
packages/
  shared/           Wire-protocol types shared between web and worker
archive/v1/         The original Vite + monolith implementation, kept for reference
```

---

## Game rules (from the lobby)

| Preset | What it means | Sent to server as |
|---|---|---|
| Host submits or timer expires | Round ends as soon as the host submits, or when the timer runs out | `endRule: TIMER`, `manualEndPolicy: HOST_OR_CALLER` |
| Caller submits or timer expires | Round ends when the current caller submits, or on timer | `endRule: TIMER`, `manualEndPolicy: CALLER_OR_TIMER` |
| Timer only | Submissions never end the round, only the clock does | `endRule: TIMER`, `manualEndPolicy: NONE` |
| No timer (first submit ends round) | The very first submission ends the round | `endRule: FIRST_SUBMISSION`, `manualEndPolicy: HOST_OR_CALLER` |

Optional **letter-pick timer** (5–60s): if enabled, when a caller doesn't pick a letter in time the server auto-picks a random unused one.

Scoring modes:
- **Fixed 10/0** — every correct answer = 10 points.
- **Shared 10** — points split among players whose answers match (more original answers earn more).

---

## Resilience features

These are notable because they take real effort and are easy to skip:

- **WebSocket auto-reconnect** with exponential backoff (500ms → 8s cap), plus instant reconnect on tab focus and network restore. Mobile browsers kill backgrounded sockets — the client recovers without a refresh.
- **Server-time clock sync.** The server sends `serverTime` in the `connected` event. Each client computes `clockOffset = serverEpoch - Date.now()` and adds it to all timer math, so devices with skewed system clocks show the same countdown.
- **Host disconnect grace period (30s).** A flaky mobile host doesn't immediately lose ownership — the room waits for them to come back before promoting another player.
- **Host transfer.** If the grace period elapses, the next admitted player with an active socket is promoted; the new host token is sent privately to their socket.
- **Forced submissions.** When a round ends, every un-submitted player has their last-synced draft submitted automatically — no one is left out because they typed slowly.
- **Duplicate-name guard, friendly error messages, removable participants** before the game starts.

---

## Scripts

```bash
# from repo root
npm run dev:web       # next dev (webpack)
npm run dev:worker    # wrangler dev for the api worker
npm run build:web     # next build (static export → apps/web/out)
npm run build:worker  # wrangler dry-run build
npm run deploy:web    # next build + wrangler deploy (Worker assets)
npm run deploy:worker # wrangler deploy
npm run typecheck     # tsc across all workspaces
npm run test          # vitest in workspaces that have it
```

The worker's tests live in `apps/worker/src/{unit,integration}` and cover the entire game state machine (59 tests).

---

## Deploying

Both deploys are Cloudflare Workers behind custom domains, configured in their respective `wrangler.toml`:

- **Worker (API)** — `apps/worker/wrangler.toml`, deployed at `api.icallon.cardgamelobby.com`. `custom_domain = true` auto-provisions DNS.
- **Web (frontend)** — `apps/web/wrangler.toml`, deployed via the Workers `[assets]` binding from `apps/web/out/`, with two custom domains: `icallon.cardgamelobby.com` and `i-call-on.cardgamelobby.com`. SPA fallback (`not_found_handling = "single-page-application"`) sends unknown routes back to `index.html`.

To deploy a change:

```bash
npm run deploy:worker     # if backend changed
npm run deploy:web        # always, after any frontend change
```

Auth is via wrangler OAuth (`npx wrangler login` once per machine).

---

## License

Private project. Not currently open-sourced.
