# I Call On - Agent Handoff and Architecture Review

Last updated: 2026-03-07 (Europe/London)
Repository root: `/Users/qudus-mac/WebstormProjects/i-call-on-game`
Latest known deployed commit at time of writing: `c5f4168`

## 1. Executive Summary
I Call On is a realtime multiplayer word game built as a two-app monorepo:
- Web client: React + TypeScript + Vite (Cloudflare Pages).
- Backend/realtime: Cloudflare Worker + Durable Object + D1 (Cloudflare Workers).

Primary architecture choice: **one Durable Object instance per room code**. This object owns all mutable game state and websocket fanout for that room.

Current product maturity:
- Lobby creation/join/admission flow is implemented.
- Turn lifecycle and round flow are implemented.
- Host scoring workflow (mark -> publish/discard) is implemented.
- Leaderboard and final results views are implemented.
- Local and server draft protections are implemented to reduce answer loss on submit/reconnect/refresh.
- Mobile-first responsive rearrangement exists (panel tabs, stacked forms/tables, touch-target adjustments).

## 2. Monorepo Structure

```text
.
|- apps/
|  |- web/                  # React app
|  |  |- src/App.tsx        # Main UI and route/view state machine
|  |  |- src/api.ts         # Typed API/WebSocket client
|  |  |- src/styles.css     # Design system + responsive/mobile behavior
|  |  |- src/sound.ts       # Non-blocking game sound effects/music
|  |  |- public/audio/*     # OGG assets
|  |
|  |- worker/               # Cloudflare Worker backend
|     |- src/index.ts       # API router + DO proxy + CORS
|     |- src/room.ts        # Domain rules + Durable Object runtime
|     |- migrations/0001_init.sql
|     |- wrangler.toml
|
|- scripts/
|  |- deploy-preflight.sh
|  |- deploy-cloudflare.sh
|
|- README.md
|- ARCHITECTURE.md          # Older architecture summary
|- GAME_FLOW.md             # Older game flow summary (partially stale)
|- UI_UX_RESEARCH.md
```

## 3. Technology Stack

### Frontend
- React 18
- TypeScript
- Vite 5
- Vitest + Testing Library
- CSS (single main stylesheet, no utility framework)

### Backend
- Cloudflare Workers runtime
- Durable Objects (room state + websocket coordination)
- D1 (room metadata table; not full game source-of-truth)
- Wrangler CLI
- Vitest (unit + integration)

### Tooling/Quality
- npm workspaces
- Husky pre-commit hook (`npm run check`)
- TypeScript typecheck for both apps
- Functional tests for web, unit/integration tests for worker

## 4. Product and Game Process (Implemented)

## 4.1 Lobby phase (implemented)
1. Host creates room (name + max participants 1..10).
2. Host receives room code and shares `/join/{ROOM_CODE}`.
3. Players submit join request with name.
4. Host admits/rejects each pending request.
5. Host starts game when ready.

Important constraints:
- Game start is blocked while pending requests exist.
- Minimum 2 admitted players required to start.
- Join link expires once status is not `LOBBY`.

## 4.2 Round phase (implemented)
1. Turn order is derived from admitted join order.
2. Current caller selects number `1..26` (`A..Z`).
3. Letter modal appears globally with 3-second countdown.
4. Answer inputs unlock after countdown.
5. Round ends by policy:
   - timer,
   - first submission,
   - whichever-first,
   - optional manual-end authority policy.
6. Missing participants are force-submitted using saved draft (or blank).

## 4.3 Scoring/review phase (implemented)
1. Completed round enters scoring queue.
2. Host marks each field per player as correct/wrong.
3. Score mode options:
   - `FIXED_10`: each correct field = 10.
   - `SHARED_10`: matching correct answers share 10 points (`10 / count`).
4. Host must either:
   - publish round to leaderboard, or
   - discard round results.
5. New round cannot start while an unpublished round exists.

## 4.4 Game end lifecycle (implemented)
- Host can `cancel` game (link expires / room closed).
- Host can `finish` game (locks final results; auto-publishes fully reviewed unpublished rounds).
- After cancelled/finished, host can return to home to create a new room.

## 5. Backend Architecture Deep Dive

## 5.1 Worker gateway (`/apps/worker/src/index.ts`)
The worker is intentionally thin:
- Handles CORS and `/health`.
- Validates/normalizes room codes.
- Routes API calls to a room-specific Durable Object via `idFromName(roomCode)`.
- Persists room metadata to D1 on room creation.

HTTP API surface:
- `POST /api/rooms`
- `GET /api/rooms/:roomCode`
- `POST /api/rooms/:roomCode/join`
- `POST /api/rooms/:roomCode/admissions`
- `POST /api/rooms/:roomCode/start`
- `POST /api/rooms/:roomCode/call`
- `POST /api/rooms/:roomCode/submit`
- `POST /api/rooms/:roomCode/draft`
- `POST /api/rooms/:roomCode/end`
- `POST /api/rooms/:roomCode/score`
- `POST /api/rooms/:roomCode/publish`
- `POST /api/rooms/:roomCode/discard`
- `POST /api/rooms/:roomCode/cancel`
- `POST /api/rooms/:roomCode/finish`
- `GET /ws/:roomCode`

## 5.2 Durable Object (`/apps/worker/src/room.ts`)
`GameRoom` is the source of truth for each room.

Responsibilities:
- Stores full room/game state in DO storage key `room`.
- Applies all game rules and validations.
- Broadcasts websocket events after successful mutations.
- Schedules timer alarms for timer-based rounds.

Key domain enums:
- `GameStatus`: `LOBBY | IN_PROGRESS | CANCELLED | FINISHED`
- `RoundEndRule`: `TIMER | FIRST_SUBMISSION | WHICHEVER_FIRST`
- `ManualEndPolicy`: `HOST_OR_CALLER | CALLER_ONLY | CALLER_OR_TIMER | NONE`
- `ScoringMode`: `FIXED_10 | SHARED_10`

Core constants:
- `DEFAULT_ROUND_SECONDS = 20`
- `ROUND_COUNTDOWN_SECONDS = 3`
- `SCORE_PER_CORRECT_FIELD = 10`

## 5.3 State model
High-level object:
- `meta`: roomCode, hostName, maxParticipants.
- `hostToken`: shared host control token.
- `participants[]`: includes host and player statuses.
- `game`:
  - status/timestamps
  - config (round + scoring controls)
  - turnOrder + currentTurnIndex
  - `activeRound` (or null)
  - `completedRounds[]`

`activeRound` includes:
- caller identity, called number/letter
- `countdownEndsAt`, optional `endsAt`
- submissions list
- `drafts` map by participantId

## 5.4 Scoring fairness and round caps
Fair-round formula:
- `roundsPerPlayer = floor(26 / admittedCount)`
- `maxRounds = roundsPerPlayer * admittedCount`

Behavior:
- Cannot call new letters after fair round limit reached.
- Used letters are tracked and cannot be reused.

## 5.5 WebSocket event model
Server emits typed events such as:
- `snapshot`, `presence`
- `join_request`, `admission_update`, `game_started`
- `turn_called`, `submission_received`, `round_ended`
- `submission_scored`, `round_scores_published`, `round_scores_discarded`
- `game_cancelled`, `game_ended`

Connection behavior:
- On connect: sends `connected`, then initial `snapshot`, then presence update.

## 5.6 Timer/alarm behavior
- Timer rounds set DO alarm at `endsAt`.
- Alarm validates round still active and due.
- On trigger: finalizes with forced submissions and emits `round_ended` reason `TIMER`.

## 6. Frontend Architecture Deep Dive

## 6.1 View/routing model (`/apps/web/src/App.tsx`)
No react-router; route-like behavior is pathname-based:
- `/` -> host create/lobby bootstrap view.
- `/join/:roomCode` -> join request flow.
- `/game/:roomCode` -> game board.

Major UI components in one file:
- `HostCreateCard`
- `JoinRoomCard`
- `GameBoardCard`

## 6.2 State sync model
`GameBoardCard` combines:
- initial HTTP snapshot (`getRoomState`)
- websocket updates for realtime synchronization
- optimistic local interaction state (loading/action keys)

## 6.3 Submission durability strategy
To protect player answers:
- Local draft persistence in `localStorage` key prefix `i-call-on:draft:`.
- Per-round draft restore on reload/reconnect.
- Debounced server draft sync (`/draft`) while typing.
- Pre-submit best-effort draft flush.
- Submit-failure recovery: app refetches room state and checks if submission already recorded before showing failure.

This makes answer loss significantly less likely under network jitter or ambiguous submit responses.

## 6.4 Session identity persistence
- Per-room session key prefix: `i-call-on:session:`.
- Stores participant identity and optional host token.

## 6.5 Mobile UX architecture
Responsive behavior in `/apps/web/src/styles.css`:
- Breakpoints: 980px, 760px, 640px.
- Compact mode introduces mobile panel tabs (`Play`, `Scores`, `Details`).
- Status strip prioritizes timer and score summary at point-of-action.
- Answer grids collapse from 5 columns to 2/1 with explicit field labels.
- Results tables convert into stacked card-like rows on narrow screens.
- Leaderboard in compact mode becomes horizontal scroll tiles.
- Coarse pointer mode increases touch target sizes.

## 6.6 Audio model (`/apps/web/src/sound.ts`)
- WebAudio oscillators for short UI cues.
- Looping round timer track (`/audio/round-theme.ogg`) during open timer rounds.
- Audio failures are swallowed intentionally (should not block gameplay).

## 7. Data Persistence and Infra Boundaries

D1 currently stores only room metadata:
- table: `rooms(code, host_name, max_participants, status, created_at)`

Important boundary:
- **Gameplay state is not loaded from D1**.
- Durable Object storage is authoritative for live room state.

Operational implication:
- If a room DO state is lost/replaced, only limited metadata remains in D1.

## 8. Testing and Quality Process

### 8.1 Test types
- Web functional tests:
  - `/apps/web/src/functional/*.test.tsx`
- Worker unit tests:
  - `/apps/worker/src/unit/*.test.ts`
- Worker integration tests:
  - `/apps/worker/src/integration/*.test.ts`

### 8.2 Main commands
- `npm run typecheck`
- `npm run test`
- `npm run test:steps` (unit + functional + integration grouped)

### 8.3 Commit gate
Husky pre-commit (`/.husky/pre-commit`) runs:
- `npm run check` -> typecheck + full tests

## 9. Local Development Runbook

## 9.1 Prerequisites
- Node 20+
- npm 10+
- Cloudflare account + Wrangler auth

## 9.2 Install
```bash
npm install
```

## 9.3 Local ports (project convention)
- Web: `http://localhost:5181`
- Worker: `http://localhost:8787`

## 9.4 Start dev servers
Terminal 1:
```bash
npm run dev:worker
```

Terminal 2:
```bash
npm run dev:web
```

## 10. Deployment Runbook

## 10.1 Current production endpoints (at time of writing)
- Web: [https://i-call-on-web.pages.dev](https://i-call-on-web.pages.dev)
- Worker API: [https://i-call-on-worker.adeyems.workers.dev](https://i-call-on-worker.adeyems.workers.dev)

## 10.2 Manual deploy (currently used and working)
From repo root:
```bash
npm run deploy:worker
npm run deploy:web
```

## 10.3 One-command orchestrated deploy
```bash
npm run deploy:cloudflare
```
What it does:
- ensures D1 DB exists
- updates `wrangler.toml` DB IDs
- applies migration
- ensures Pages project exists
- deploys worker
- updates `apps/web/.env.production` `VITE_API_BASE_URL`
- builds + deploys web

## 10.4 Preflight checks
```bash
npm run deploy:preflight
```
Checks:
- DB IDs configured
- `.env.production` has non-placeholder API URL
- Wrangler auth present

## 10.5 Auto-deploy status
Current deployment path is CLI/manual.
For automatic deployment on push, connect either:
1. Cloudflare Pages Git integration (web only), and/or
2. Workers Builds or GitHub Actions (worker + web)

## 11. Security and Access Control Notes

- Host-only controls are protected by `hostToken`.
- Player actions use `participantId` plus server-side status/turn checks.
- Room code format restricted to `[A-Z0-9]{4,10}`.

Known limitations:
- No user account auth; trust model is token + UUID.
- Host token is effectively bearer auth for room administration.

## 12. Known Gaps / Technical Debt

1. `App.tsx` is large and combines routing, data-fetching, business UI, and interactions in one file.
2. D1 is only metadata; no durable historical game analytics layer yet.
3. No explicit reconnection strategy with backoff/health indicators for websocket drops.
4. Auto-deploy pipelines are not yet codified in repo CI.
5. No browser-level end-to-end tests (Playwright/Cypress) yet.
6. Older docs (`GAME_FLOW.md`) still mention partial implementation and should be refreshed or deprecated.

## 13. Suggested Refactor Plan for Next Agent

## 13.1 Immediate low-risk improvements
1. Split `App.tsx` into view modules (`HostView`, `JoinView`, `GameView`) + hooks.
2. Move gameplay selectors/derived state to a dedicated utilities module.
3. Add API contract tests for edge errors (`409`, `403`, `410`) between web and worker.

## 13.2 Medium-term
1. Add Playwright smoke tests for 2-3 player critical path.
2. Add reconnection UX (socket state banner, retry strategy).
3. Add deployment workflow (GitHub Actions) for repeatable release automation.

## 13.3 Longer-term
1. Persist fuller round history externally (D1 or analytics store) if historical replay/statistics are needed.
2. Add host moderation controls (kick player, rename restrictions, abuse handling).
3. Add per-room settings profile and migration story for backward compatibility.

## 14. Takeover Checklist (First 30 Minutes)

1. Run `npm install`.
2. Run `npm run typecheck`.
3. Run `npm run test`.
4. Start local servers (`npm run dev:worker`, `npm run dev:web`).
5. Play through one room with two tabs:
   - create -> join -> admit -> start -> call letter -> submit -> score -> publish -> finish.
6. Validate production URLs are reachable.
7. Decide whether to implement CI/CD auto deploy next or continue feature/UI iteration.

## 15. Command Cheat Sheet

```bash
# quality
npm run typecheck
npm run test
npm run check

# dev
npm run dev:worker
npm run dev:web

# deploy
npm run deploy:preflight
npm run deploy:worker
npm run deploy:web
npm run deploy:cloudflare
```

