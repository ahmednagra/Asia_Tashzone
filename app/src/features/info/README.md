# features/info

Reference screens: **How to play** (`/howto`), **Rules and terms** (`/rules?game=<id>`), **Atlas / All screens** (`/atlas`).

- Content is typed data in `constants/howto.ts`, `constants/rules.ts`, `constants/atlas.ts`. Screens only render it.
- Rules text comes from `Docs/specs/01_GAME_RULES.md` (profiles `callbreak.np@1`, `callbridge.bd@1`, `courtpiece.tz@1`, `bhabhi.tz@1`). Only games with status `play` in `constants/games.ts` get full rules; `soon` games get a teaser. Style lists are generated from `SETUP` so they cannot drift.
- Shared UI: `components/ui/Collapsible` (expandable panel) and `components/ui/CardRow` (illustrative card row, wraps the table's `PlayingCard`). Local helpers in `parts.tsx`.
- Atlas entries open real routes; dialogs (Errors group) have no route and are shown as wording reference.
- `info.test.ts` checks content completeness and that every atlas href resolves to a route file.
