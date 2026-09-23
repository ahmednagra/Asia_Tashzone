# TashZone app: directory structure

Realigned on 24 Sep 2026 after the layering of the Echooo dashboard (a Next.js web app). Only the layers (types, services, constants, hooks, lib,
context, store, theme, utils) are adopted; its feature folders (campaigns, influencers, billing) do not apply to a card game. Every folder under
`app/src/` has a `README.md` stating its purpose. Screens follow `Docs/design/TashZone_mehfil_table.html`.

**Stack:** Expo SDK 57 · React Native 0.86 (New Architecture) · React 19 · Expo Router (typed routes) · TypeScript strict · Vitest 5.

```text
app/
├── app.json          # Expo config: scheme `tashzone://`, expo-router plugin, typedRoutes, EAS projectId
├── eas.json          # Build profiles: development, preview (APK), production (AAB), EXPO_PUBLIC_API_URL
├── package.json      # main = expo-router/entry
├── babel.config.js  metro.config.js  tsconfig.json  vitest.config.ts
├── assets/  credentials/
└── src/
    ├── app/          # Routes (Expo Router). Thin: params + navigation, render a feature screen
    ├── components/ui # Universal UI kit, reused by every feature (see below)
    ├── config/       # Static non-secret configuration (empty)
    ├── constants/    # Fixed data: games catalogue + setup, rules, how-to, atlas
    ├── context/      # ThemeContext (display preferences, persisted)
    ├── features/     # Screens by area: onboarding, home, games, play, lobby, multiplayer, me, settings, info
    ├── hooks/        # useGameNav, useGo, useBackAction, useParentGate, usePinGate, useOnlineSession
    ├── lib/          # env.ts (build-time config)
    ├── services/     # FastAPI client: api.ts
    ├── store/        # profile (on-device player profile, AsyncStorage) + pure profileModel
    ├── theme/        # Design tokens + contrast test
    ├── types/        # api.ts, game.ts
    └── utils/        # random.ts (CSPRNG seed)
```

## Routes (`src/app/`)

| Group | Routes |
|---|---|
| First run | `onboarding/{welcome,language,age,mode,name}` (root layout redirects here until `profile.onboarded`) |
| Tabs `(tabs)` | `/` Play, `/games`, `/me` (You), `/settings` |
| Game flow | `game/[id]` detail, `game/[id]/ways`, `game/[id]/setup`, `play/[game]` (table; params `preset,length,players,level,handicap` skip the setup sheet), `result/hand`, `result/game` |
| Online | `room`, `wait`, `online/[game]`, `match`; `pass` (pass-the-phone curtain) |
| Wi-Fi | `wifi/{host,join,pin,hotspot}`: wired to a real host table (TCP + mDNS + QR) and guest join; needs a device build (`react-native-tcp-socket`, `react-native-zeroconf`), not verified on hardware. After the lobby the table is the shared `wait` / `online/[game]` / `match` screens |
| Settings | `settings/{appearance,play,sound,parent,parent-pin,account}`, `themes` |
| Reference | `howto`, `rules`, `atlas` |

## Universal UI (`components/ui/`)

Every screen is composed from these; a pattern used twice becomes one component here.
Layout: `Screen`, `Header`, `TabBar`, `Sheet`, `ConfirmSheet`, `Collapsible`. Surfaces: `GlassCard`, `NavRow`, `SeatRow`, `StatBox`, `CodeCard`,
`StatusBanner`, `SelectableCard`, `AvatarPicker`. Controls: `GoldButton`, `GoldGradientBar`, `Chip`, `ChipGroup`, `SearchField`, `ToggleRow`,
`Keypad`, `Settings` (`SettingsScreen`, `SettingsGroup`). Text and marks: `SectionLabel`, `Caption`, `TagPill`, `StepDots`, `StepRow`, `SuitBadge`,
`CardRow`. Colours come only from `theme/tokens.ts`; the exceptions are decorative data (avatar palettes, table-cloth swatches).

## Rules

- Data flow: `app/` route → `features/` screen → `services/` → FastAPI. Features never call `fetch` directly.
- The app talks to the FastAPI backend directly and reads only `EXPO_PUBLIC_*` variables. No secrets in the app.
- Reuse before writing: check `components/ui` and `hooks/` first. No copied styles or handlers.
- Game rules and shuffling live in `shared/engine`, not in the app.
- Text is English, kept in `copy.ts` / `constants/` per area so it can be translated later.

## Not built yet

Audio and haptics playback, in-match chat, concede, table cloth themes applied to the felt, badges/XP, and non-English strings.

Same-Wi-Fi/hotspot play is built (host table, PIN, QR, nearby list, manual address, reconnect) but only tested in code with in-memory links.
It needs a development or release build (not Expo Go) and has not been run on two phones yet: mDNS discovery on Android (NSD), the host
phone in the background, and hotspot hosts that do not report their own address are the open questions. See `features/multiplayer/README.md`.

## Decisions (24 Sep 2026)

- **Call Bridge bonus:** a made call of 8 or more scores a flat 13 points *instead of* the call (matches the engine and `01_GAME_RULES.md`).
- **Avatars:** 8, as in the mockup (`features/onboarding/AvatarView.tsx`).
- **Coming-soon games** (Marriage, Twenty-Nine, Seep, Teen Patti) show a one-line teaser only; no rules are invented, and no betting wording is used
  (store family and age-rating policies).
