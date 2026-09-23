# features/play: setup, offline table, table widgets, result screens

- `OfflineTable.tsx` runs a `LocalTable` (engine + bots). It shows the setup sheet, or starts at once when the route passes a complete, valid `Choice` (`/play/[game]?preset=&length=&players=&level=&handicap=`, parsed by `setup.ts`). It holds the deal between hands, pushes `/result/hand` and `/result/game`, and calls `profile.recordResult(gameId, won, lostBhabhi)` once when the match ends.
- `table/` draws a SeatView and nothing else: `TableScreen` (top bar, felt, seats, trick with a short hold, own plate, actions, hand), `Felt`, `Seat` (`PlayerAvatar`), `MePlate`, `Hand`, `PlayingCard`, `Controls` (call, trump, take, redeal, between hands), `chrome` (round button, pills, turn bar), `hooks` (turn clock, trick hold, server deadline).
- `table/sheets/` are all `Sheet`s: menu, house rules (the compiled rules, read-only), table info, last trick, arrange (fan/spread, by suit/rank; a view preference only), what has gone, hint. Leaving uses the generic `components/ui/ConfirmSheet`.
- Pure logic (tested in Node, no React Native): `table/logic.ts`, `table/insights.ts` (instruction, what has gone, last trick, voids, hint text, rules list, sorting), `setup.ts`, `result/model.ts`, `session.ts`.
- `result/` holds `ResultLayout` (frame + `ScoreRows`, shared by both screens) and `ResultScreens`. The route files in `app/result/` only re-export them. The table publishes the outcome (data plus actions) through `session.ts`; a screen opened without one redirects home.

Engine limits the UI respects: no concede (there is no engine action, so no "Concede this hand"), no pause, no chat offline. Hints are the Medium bot's move from the player's own view.
