# TashZone

South Asian card games — **Callbreak / Call Bridge, Court Piece (Rung) and Bhabhi (Thulla)** — with an authoritative,
deterministic engine shared by phone and server, and Easy / Medium / Hard bots.

This repo is the base into which the old live TashZone is being ported phase by phase (see
`Docs/IMPLEMENTATION_STATUS.md`). Phase 1 (games and bots) is done.
This tree follows the live repository layout: `app/`, `shared/*`, `backend/api`, `backend/match-server`, `backend/deploy`.

> **Built from the specs, without the live code.** Push this to a **new branch** and merge by hand
> (see "Merging into the live repo"). Do not overwrite `main`, the live Compose file or the live
> Alembic history.

## What is here (same layout as TashZone v1)

| Path | What | Tests |
|---|---|---|
| `shared/engine` | deterministic engine. `src/core` (contract, types, RNG tz-rng-v1, journal, replay), `src/families/trick-taking`, `src/games/{callbreak,courtpiece,bhabhi}`, `src/bots` (Easy/Medium/Hard), `src/profiles` (rule profiles + presets), `src/testing` drivers; `scripts/` bundle, digest, profile bundles; `tests/` | 121 |
| `shared/match` | table runners: offline `LocalTable` for every game, reconnecting online `MatchClient` | 6 |
| `shared/protocol` | protocol major 2 schemas (strict), view hash, negotiation | 5 |
| `shared/config` | shared ESLint (determinism + boundary rules) and TypeScript base config | — |
| `backend/api` | FastAPI in the v1 layout: `main.py`, `config/`, `routes/api/v1/`, `app/{Core,Http/Controllers,Middleware,Models,Schemas,Services,Utils,Workers}`, `infrastructure/docker/`, `scripts/`, Alembic | 34 (×2 databases) |
| `backend/match-server` | WebSocket match server for every game: queue, journal-first, `view_seq`, seeds, hand-over, fencing, drain, PostgreSQL adapters; tests beside the code in `src/` | 20 |
| `backend/deploy` | `docker-compose.prod.yml`, `Caddyfile`, `livekit.yaml`, `server-setup.sh`, `deploy.sh`, `rollback.sh`, `backup.sh`, `initdb/`, `.env.example` | build steps simulated |
| `app` | Expo app: `src/{design,ui,platform,features/{home,lobby,play,play/table,settings}}` | 14 + typecheck |
| `Docs/` | specs, status, mehfil design, and the TashZone v1 reference documents | — |
| `.github/` | `workflows/ci.yml`, `scripts/e2e-fullstack.mjs` | — |

## Setup

Requirements: Node 22, pnpm 9.15 (`corepack enable`), Python 3.12 with `uv`, PostgreSQL 16+ for the database tests.

```bash
pnpm install
pnpm check                 # lint + typecheck + all TypeScript tests
pnpm bundle:engine         # dist/bundle/engine.mjs + engine_build_hash
pnpm digest                # behaviour_manifest.json (engine build hash + behaviour digests)
pnpm bundle:profiles       # backend/api/app/Schemas/contracts/profile_bundles/*.json (commit these)
cd backend/api && uv sync && uv run pytest
```

PostgreSQL-backed tests:

```bash
createuser tz_api -P && createuser tz_match -P && createdb -O tz_api tashzone
cd backend/api && DATABASE_URL=postgresql+psycopg://tz_api:…@127.0.0.1/tashzone uv run alembic upgrade head
TZ_TEST_DATABASE_URL=postgresql+psycopg://tz_api:…@127.0.0.1/tashzone uv run pytest
TZ_TEST_PG_URL=postgres://tz_match:…@127.0.0.1/tashzone pnpm --filter @tashzone/match-server test
```

Run locally (three terminals):

```bash
# API (port 8000)
cd backend/api && PLAYER_TOKEN_SECRET=… JOIN_TOKEN_SECRET=… INTERNAL_API_TOKEN=… \
  DATABASE_URL=… ENGINE_MANIFEST=$PWD/../../shared/engine/dist/bundle/behaviour_manifest.json \
  MATCH_SERVER_URL=ws://127.0.0.1:8787/match uv run uvicorn main:app --port 8000
# Match server (port 8787)
cd backend/match-server && pnpm build && JOIN_TOKEN_SECRET=… INTERNAL_API_TOKEN=… \
  SEED_ENCRYPTION_KEY=$(openssl rand -hex 32) DATABASE_URL=postgres://tz_match:…@127.0.0.1/tashzone \
  API_INTERNAL_URL=http://127.0.0.1:8000 node dist/main.js
# Full-stack smoke, one match per game
pnpm e2e
PROFILE=courtpiece.tz@1 SETTINGS='{"target_points":2}' pnpm e2e
PROFILE=bhabhi.tz@1 SETTINGS='{"players":5,"rounds":1}' pnpm e2e
```

App: `cd app && EXPO_PUBLIC_API_URL=http://<your-ip>:8000 npx expo start`.

Secrets are at least 32 characters and distinct; the services refuse to start otherwise.

## Deploying (Oracle VM 141.148.193.78)

This repository is the base: every old TashZone feature is being ported into it (see `Docs/IMPLEMENTATION_STATUS.md`).
On the reinstalled VM: run `backend/deploy/server-setup.sh` once on the server, then `bash backend/deploy/deploy.sh`
from your PC for every release (`--publish-apk` to offer an APK update). Details: `Docs/specs/05_DEPLOYMENT_RUNBOOK.md`,
section "Quick path".

## Rules decisions in this slice

Callbreak gaps were resolved following common practice and written back into `Docs/specs/01_GAME_RULES.md` §3.3:
canonical must-beat and must-trump-if-winning by default (relaxed play is a room toggle) · a void player whose trumps cannot win may play any card · tied totals share a placement · at most 3 consecutive redeals · 256-action hand cap (annul, same dealer) · Call Bridge 5 hands.

## Games and profiles

| Profile | Game | Presets (first = app default) | Notes |
|---|---|---|---|
| `callbreak.np@1` | Callbreak | Classic (v1), Easy follow (v1), Call Bridge (v1), Nepal standard, Lakdi | Classic: calls 1–8, no-spade hands redealt automatically, +0.1 per overtrick |
| `callbridge.bd@1` | Call Bridge (Bangladesh) | Standard | calls 2–12, made if call or call+1 |
| `courtpiece.tz@1` | Court Piece / Rung | Double Sir, Single Sir, Double Sir with Ace | points to win 3/5/7; losing side deals |
| `bhabhi.tz@1` | Bhabhi / Thulla / Get Away | Standard, Full trick, Quick escape, Take-the-hand | 3–8 players; two decks for 7–8; handicap offline only |
