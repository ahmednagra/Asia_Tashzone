# features/games

Catalogue, game page, ways to play and bot setup (mockup screens `games`, `detail`, `ways`, `setup`; `home` lives in `features/home`).

- `copy.ts` - all strings in every language (`T`, a `localized("games")` table) plus pure helpers (`playable`, `defaultSetup`, `playParams`).
- `GameTile.tsx` - the one game tile, used by Home and the catalogue.
- `GamesScreen`, `DetailScreen`, `WaysScreen`, `SetupScreen` - screens; route files in `src/app` only pass the `id` param.
- `MiniCard`, `CardFan`, `GameArt` - decorative card art.
- Navigation lives in `src/hooks/useGameNav.ts`. Catalogue data (suit, seats, tags, rules) is in `constants/games.ts`.

Flow: Home/Games tile -> `/game/<id>` -> Play -> `/game/<id>/ways` -> bots: `/game/<id>/setup` -> `/play/[game]` with string params
`game, preset, length (index into SETUP.lengths), players, level, handicap`. The tile play button and Quick play skip setup using the same defaults.
