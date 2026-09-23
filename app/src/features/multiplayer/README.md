# features/multiplayer

Room, Quick Match, same-Wi-Fi and pass-and-play screens (mockup `wifihost`, `wifijoin`, `pin`, `hotspot`, `room`, `wait`, `match`, `pass`).

## Layout
- `session.ts` – the single online session (module store, read with `hooks/useOnlineSession`). Owns the `MatchClient`, the 3 s lobby roster poll, the 2 s Quick Match poll; ignores answers from a superseded run. Actions: `createRoom`, `joinRoom`, `quickMatch`, `startTable`, `sendMove`, `leaveSession`.
- `http.ts` – room/matchmaking calls with the API's stable error code, a 10 s timeout, and a guest token kept in AsyncStorage (re-registered once on 401).
- `copy.ts` – all English strings, one block per screen. `roomCode.ts`, `standings.ts` – pure, tested.
- `WifiScreens.tsx`, `WifiNotice.tsx`, `PassCurtain.tsx`, `SeatList.tsx` – screens/pieces. Lobby screens live in `features/lobby/` (`RoomEntry`, `WaitRoom`, `OnlineTable`, `MatchSummary`).
- Shared UI added to `components/ui`: `CodeCard`, `SeatRow`, `StatusBanner`, `StepRow` (and hooks `useOnlineSession`, `useParentGate`, `useBackAction`). `Keypad` is the shared one.

## Flow
`/room` (create / join / Quick Match) -> `/wait` (lobby or queue) -> `/online/<game>` (table, `TableScreen`) -> `/match` (standings, recorded once via `recordResult`). Leaving a lobby frees the seat; leaving a live table hands the seat to a bot.

## Real vs UI-only
- Real: private rooms, join by code, Quick Match (bot backfill from the server), lobby roster, start (host), reconnect banner and retry, pause/update banners, match summary, Parent Settings lock (`parent.online`, `parent.wifi`).
- UI-only / unavailable: same-Wi-Fi host, join, PIN and QR. This build has no native TCP/mDNS module and `shared/match` has no host/guest transport. The screens are built; the actions are disabled with an explanation (`WIFI_TABLES_SUPPORTED = false` in `WifiNotice.tsx`). When a transport lands, flip that flag and wire `WifiHostScreen` / `WifiPinScreen`.
- Pass-and-play: `/pass?name=Sana&next=/path` is a working curtain, but `LocalTable` drives one human seat only, so nothing routes through it yet.
- Not built (no backend support): host approval of joiners and "lock room once play begins", QR of the room code (would need a QR dependency), typed chat in the lobby.

## Known limits
- The join token has a TTL; `MatchClient` reuses it on reconnect, so a very long outage needs a fresh join (leave and rejoin by code).
- Quick Match auto-start is not visible in the match server code; a non-host waits for the host's Start.
