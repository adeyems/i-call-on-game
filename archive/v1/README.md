# I Call On (Bootstrap)

Monorepo bootstrap for a free-tier deployment path:

- `apps/web`: React + TypeScript + Vite (Cloudflare Pages ready)
- `apps/worker`: Cloudflare Worker + Durable Object + D1 wiring

## Prerequisites

- Node.js 20+
- npm 10+
- Cloudflare account (free)

## Install

```bash
npm install
```

`npm install` also runs `prepare`, which installs Husky git hooks.

## Pre-commit gate

Before every commit, Husky runs:

```bash
npm run check
```

This runs both:

- `npm run typecheck`
- `npm run test`

## Run locally

This project uses fixed local ports:

- Web app: `http://localhost:5181`
- Worker/API: `http://localhost:8787`

Start both services in separate terminals:

```bash
# terminal 1
npm run dev:worker

# terminal 2
npm run dev:web
```

Open:

```text
http://localhost:5181
```

## Event-driven lobby behavior

- Host page auto-updates in real time when players send join requests.
- Host sees live admitted/pending/rejected counts without manual refresh.
- Notification sound plays when a new join request arrives.
- Join requester is auto-moved to `/game/{ROOM_CODE}` when approved.
- Game board page is currently a placeholder and updates live room/game status.

## Test suites

Run everything:

```bash
npm run test
```

Run categorized suites for steps 1-5:

```bash
npm run test:steps
npm run test:unit
npm run test:functional
npm run test:integration
```

## Steps 1-5 status

Implemented and covered by tests:

1. Host creates room with max players 1-10 (host included)
2. Host gets share link `/join/{ROOM_CODE}`
3. Participant submits join request with name
4. Host approves/rejects each request (host-token protected)
5. Host starts game when ready (host-token protected)

## API routes

- `GET /health`
- `POST /api/rooms` create room (returns `hostToken`)
- `GET /api/rooms/:roomCode` room state
- `POST /api/rooms/:roomCode/join` submit join request
- `POST /api/rooms/:roomCode/admissions` host admission decision payload `{ hostToken, requestId, approve }`
- `POST /api/rooms/:roomCode/start` host starts game payload `{ hostToken }`
- `GET /ws/:roomCode` websocket connection to room object

## Production Hosting (Cloudflare Free)

This project is configured for:

- API/realtime/state: Cloudflare Workers + Durable Objects + D1
- Web app: Cloudflare Pages

### One-time login

```bash
# from repo root
npm --workspace apps/worker exec wrangler login
```

### One-command deploy

```bash
# from repo root
npm run deploy:cloudflare
```

What `deploy:cloudflare` does automatically:

1. Finds or creates D1 database (`i-call-on`)
2. Updates `apps/worker/wrangler.toml` `database_id` and `preview_database_id`
3. Applies remote migration (`apps/worker/migrations/0001_init.sql`)
4. Finds or creates Pages project (`i-call-on-web`)
5. Sets worker `APP_ORIGIN` to `https://i-call-on-web.pages.dev`
6. Deploys worker and captures its `*.workers.dev` URL
7. Creates/updates `apps/web/.env.production` with `VITE_API_BASE_URL=<worker-url>`
8. Builds and deploys web app to Cloudflare Pages

### Notes

- Local worker dev uses `wrangler dev --env local` (already wired in scripts).
- Join links expire automatically once game starts/cancels/ends.
- To use different names, set env vars before deploy:
  - `D1_DB_NAME=<your-db-name> npm run deploy:cloudflare`
  - `PAGES_PROJECT_NAME=<your-pages-project> npm run deploy:cloudflare`

### Manual deploy (advanced)

If you prefer manual control:

```bash
npm run deploy:preflight
npm run deploy:worker
npm run deploy:web
```

## Next implementation steps

- Turn lifecycle (`A-Z`, timer, and round state)
- Submission form for 5 category boxes per round
- Scoring and leaderboard
