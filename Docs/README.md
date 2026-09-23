# TashZone documentation

**Current (this repo):**
- `IMPLEMENTATION_STATUS.md`: what is built and verified, and the port programme (old TashZone → this repo, phases 1–4)
- `specs/01_GAME_RULES.md` … `specs/06_PRODUCT_UX_BLUEPRINT.md`: the specification set (rules, engine, platform, quality, deployment, UX)
- `design/TashZone_mehfil_table.html`: the mehfil visual design the app follows
- `HTML_TO_PRODUCT_TRACEABILITY.md`, `IMPLEMENTATION_READINESS.md`

**TashZone v1 reference (kept as-is):** the numbered documents `00`–`12`, `design-system/`, `screen-designs/`, `tools/` and
the research pages. `02-product-brief.md` (locked decisions L1–L41), `08-store-compliance.md` and
`12-urdu-language-standard.md` still apply. `00`, `04`, `06` and `07` describe the v1 architecture and carry a note.

---

# TashZone: Project Docs

Twelve documents, read in order. Decisions are recorded only in the product brief.

| File | What it is |
|---|---|
| `01-research.md` | All research: market (A), competitor Bhabhi apps (B), their feature list (C), app name (D), visual references and art rules (E) |
| **`02-product-brief.md`** | **Source of truth:** locked decisions L1–L31, game phases, release plan, Families and legal rules, architecture; appendix reviews the original prompt |
| `03-screen-spec.md` | v1.0 screens, contents, flows, states, localization glossary, React Native notes |
| `04-technical-plan.md` | Engine research (A), app foundation research (B), directory structure and flow diagrams (C) |
| `05-skills-playbook.md` | Which skills to use at each stage, plus the full skill inventory |
| **`06-deployment.md`** | **Deployment runbook:** live server facts, server setup from zero, releases and daily commands, backups and point-in-time recovery, app builds and Play Store, troubleshooting, voice chat, and what Oracle Cloud specifically requires (Part I) |
| `07-improvement-plan.md` | Phase-by-phase implementation plan and remaining risks |
| **`08-store-compliance.md`** | **Store compliance pack:** Play Console declarations, Data safety answers grounded in the code, the moderation policy, a privacy policy draft, the pre-submission checklist, and what still needs the owner or a lawyer |
| **`09-app-review-plan.md`** | **Review procedure:** step-by-step audit of the built app against the product brief (L1–L40) and the Bhabhi/Thulla market research — decision conformance, rules correctness, fairness, three-mode parity, duplication, pain-point coverage, compliance, device tests |
| **`10-research-implementation-audit.md`** | **Audit result:** the built code measured against the Bhabhi/Thulla market research — rules, architecture, bots, screens, pain points and "where to win", with the gaps and the prioritised actions |
| **`11-ui-ux-audit-and-screen-improvements.md`** | **UI/UX audit:** the 25 boards and the shipped screens measured against `03-screen-spec.md`, the brief (§5.1, §5.2, §9.1) and WCAG 2.2 AA — corrected design system, per-screen work, acceptance gate |
| **`12-urdu-language-standard.md`** | **Urdu copy standard:** Karachi register, card-game glossary, sentence style, UI microcopy, and the review checklist every Urdu string must pass |
| `tools/po_audit.py` | Reports untranslated strings and any Latin left inside a translation, per locale |
| `Mobile live app screenshots/` | Device captures from the live app, `before/` and `after/`, plus the Urdu localisation audit |
| `design-system/` | Design-system canvas: Main, System, Contrast, Laws boards (moved out of the repo root, 18 Sep 2026) |
| `carousel-redesign.html` | UI/UX carousel redesign artifact (moved out of the repo root, 18 Sep 2026) |
| `screen-designs/` | Source of the 25 canvas boards (24 screens + component and motion sheet). Live canvas: https://claude.ai/artifact/UN74wBMwRsjd6dfxC1B8gp |

Reference images are in `../Research`.

## Status (18 Sep 2026)
- **Phase:** build. Steps 1–7 built. Gates green: `build`, `test` (24/24 suites, **411 TypeScript tests** — engine 105, match 64, match-server 48, protocol 26, app 168), `typecheck`, `lint` (5 packages). Backend live on Oracle Cloud Always Free (Docker Compose + Caddy, HTTPS verified). Next: Android build against the live API and a two-phone online match.
- **Open before release:** the spectator client, the reconnect catch-up, and the real-device passes. Full list: `10-research-implementation-audit.md` §9.
- **Deployment (18 Sep 2026):** LiveKit keys, host firewall and Oracle security-list rules are all in place, and a deploy is under way from `backend/deploy/deploy.sh` (`06-deployment.md` Part J1). Until it completes the server still runs code from 17 Sep 08:00 UTC on the initial database migration with four pending, and `room-maintenance` and `livekit` have never started there — so room expiry has never run in production. **Voice remains unproven either way:** the path is configured end to end, but nobody has heard a call. That needs two phones, one on mobile data.
- **Signing:** release builds are signed from `app/credentials/` (gitignored, generated 18 Sep 2026). That keystore is irreplaceable — `06-deployment.md` Part K explains why and how to back it up.
- **Backend (L23):** FastAPI core backend from day one; live matches in a TypeScript match server that shares the app's engine.
- **Android package name:** `com.tashzone.app` (provisional; permanent after the first Play upload).

## Improvement pass (17 Sep 2026)
Plan and status: `07-improvement-plan.md`. Decisions L32–L35 added to the brief. Commits on `main`: engine rules and shuffle, Bhabhi table rebuild, online chat/fair deal/rematch/feedback, API hardening, sliced Hard bots, message extraction. Match server and runner hardening (`5c40e05`).

## Build checklist
Tick items as they are done. Details for each are in `04-technical-plan.md` Part C.

**1. Repository setup**
- [x] Create `tashzone/` with git, pnpm workspaces, Turborepo, `.gitignore`, `.editorconfig`, README
- [x] `shared/config`: shared tsconfig, ESLint, Prettier
- [x] Workspaces: `app`, `backend/api`, `backend/match-server`, `shared/engine`, `shared/match`, `shared/protocol` (realigned into app / backend / shared on 17 Sep 2026)
- [x] Root scripts: build, test, lint, typecheck through Turborepo

**2. Engine (`shared/engine`)**
- [x] Core: cards, seeded random, contract, error codes, replay (events are typed per game)
- [x] Trick-taking family: follow / beat / trump rules, trick winner, void inference, determinize
- [x] Callbreak: config, calling, scoring (L13, L18), redeal on no spade
- [x] Court Piece: config, five-card trump choice, dealer rotation, Single Sir, Double Sir (L15, L20)
- [x] Bhabhi: config, first-trick discard, thulla pickup, power holder and waste pile (L14, L19)
- [x] Bots: Easy, Medium per game, Hard (PIMC with budget) (L21)
- [ ] Hard bot: tune budget and add a time cap on the reference phone (desktop slowest decision 370 ms); add Bhabhi to the strength check
- [x] Tests: rules, scoring tables, property tests, determinism, golden replays, bot legality and strength
- [x] Engine README: contract, layout, config options, bots, strength results

**3. Match runner and protocol**
- [x] `shared/protocol`: JSON Schema messages, generated TypeScript types, precompiled validators and Pydantic models, version check, TCP framing
- [x] `shared/match`: runner, seats, timers, reconnect, resume, bot fallback, tests

**4. App foundation (`app`)**
- [x] Expo app (SDK 57, React Native 0.86), Expo Router with typed routes, EAS profiles, target API 36, blocked permissions
- [x] Design tokens, typography (Nastaliq line height), motion presets (Reanimated 4 CSS), reduced motion and animation speed
- [x] UI components and card component, development gallery
- [x] Platform services: MMKV storage, SecureStore (hashed Parent PIN), Lingui with RTL reload, haptics
- [ ] Audio (sound effects arrive with the game tables in step 5)
- [x] Onboarding, Home, Settings, Parent Settings
- [x] Jest tests (16) and Maestro flows for these screens
- [ ] Run on a real Android phone: development build, Maestro flows, performance on the reference phone
- [x] ESLint for the app: `app/eslint.config.mjs` extends `shared/config`, narrowed per file type (asset `require()` by extension, `jest.mock` factories, Node config files); `no-console` stays on so diagnostics go through `telemetry.ts`. React Compiler rules from `eslint-plugin-react-hooks` v7 are installed but not yet enforced — findings in `10-research-implementation-audit.md` §8

**5. Offline bot games**
- [x] Game detail and setup (rule set, bot level, length, player count)
- [x] Table screen for Callbreak, Court Piece and Bhabhi: calling, trump choice, legal-card glow, held last trick, rule messages, orientation lock (L12), cards kept 48 dp wide
- [x] Hand result (paused until you continue), game result, stats on the phone
- [x] Rules for all three games, guided Callbreak hand with coach tips
- [x] Save every move and continue from Home; Pause menu
- [x] Tests: full offline games of all three through the session, table render tests; Maestro bot-game flow
- [x] Sound effects: original sounds generated by `app/scripts/make-sounds.py` (deal, shuffle, play, thulla, pickup, got away, Bhabhi, win, lose)
- [~] Hard bots: search runs in time-capped slices that yield to the app (`chooseActionAsync`); a true worker runtime still needs Bundle Mode and a device test
- [x] Card deal (3D flip), trick landing, thulla slam, sweep to picker or waste pile, moment banners, timer bars (see `07-improvement-plan.md`)
- [ ] Real-phone run of the tables in both orientations

**6. Same Wi-Fi play**
- [x] Host and guest table logic in `shared/match` (PIN check with lockout after 10 wrong PINs, hello timeout, malformed messages close the connection, reconnect tokens, private-LAN-only QR codes)
- [x] TCP transport with length-prefixed frames and mDNS discovery (`react-native-tcp-socket`, `react-native-zeroconf`); the PIN is never advertised
- [x] Host lobby (PIN, QR code, seats, start with bots) and join screen (nearby tables + PIN, QR scan with camera only on request)
- [x] Guest tables: same table screen, disconnect notice, seat-aware results and stats; Parent Settings can turn Same Wi-Fi off
- [x] Tests: host and guest logic, full match between host, guest and bots, app host and join sessions
- [ ] Real-device tests: two Android phones on a router and on a hotspot (discovery, join by PIN and QR, drop and reconnect)
- [ ] Confirm `react-native-zeroconf` and `react-native-tcp-socket` build and run on the New Architecture in a development build

**7. Backend**
- [x] `backend/api`: FastAPI in the echooo-backend layout (routes → controllers → services → models); anonymous players with generated nicknames only, Parent Settings sync enforced on the server, rooms with readable codes and join tokens, idempotent match results and stats, catalogue, room expiry job, initial Alembic migration, 21 tests, Ruff and mypy clean
- [x] `backend/match-server`: WebSocket server using `shared/match`; join token check, hello timeout, message rate limit, host-only start, bots fill seats, reconnect to the same seat, results reported with retries, 4 integration tests
- [x] Protocol: host `start` message; nickname words shared between app and API; shared placements helper
- [x] Dockerfiles for both services and `backend/docker-compose.yml` (PostgreSQL, migrations, API, match server)
- [x] Docker images built and migrations run on PostgreSQL 17 (on the server). API tests on PostgreSQL still to add to CI
- [x] App: online room screens (create, share code, join, lobby) and the API client
- [x] Hosting: Oracle Cloud Always Free A1 VM (Mumbai), `backend/deploy/` (Compose, Caddy, backups); temporary domain `*.141-148-193-78.sslip.io`
- [x] Nightly backup cron on the server; scripted online match verified end to end against the live server
- [ ] Offsite backup copy; real domain; two-phone online match on real phones

**8. Release**
- [ ] Families forms, privacy policy, store listing, closed test (12+ testers, 14 days), production
