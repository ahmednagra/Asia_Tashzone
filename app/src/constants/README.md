# constants/ — fixed values

Data that never changes at runtime. `games.ts` is the game catalogue (`GAMES`), the per-profile setup choices (`SETUP`) and the rule-error messages. Shapes are in `types/game.ts`. Player-facing text is per language: English lives next to the data, the other languages in `lang/<code>.ts`, and every table goes through `localized()` so `i18n.test.ts` checks it is complete.
