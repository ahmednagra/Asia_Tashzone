# features/multiplayer

Room, Quick Match, same-Wi-Fi and pass-and-play screens (mockup `wifihost`, `wifijoin`, `pin`, `hotspot`, `room`, `wait`, `match`, `pass`).

## Layout
- `session.ts` – the single session store (online room, Quick Match or same-Wi-Fi table), read with `hooks/useOnlineSession` / `hooks/useWifiSession`. Owns the `MatchClient` (`startClient`, shared by both transports), the 3 s lobby roster poll and 2 s queue poll (online only), and the run teardown. `state.transport` is `online` or `wifi`; `state.wifi` holds PIN, QR, address and roster of a Wi-Fi table.
- `wifiSession.ts` – `hostTable`, `joinTable`, `kickSeat`. Host: compile rules, `makePin`, `HostTable`, TCP server, mDNS advert, own seat via `hostSeat`. Guest: `lanGuest` over a buffered TCP link. Every resource is closed by the run's teardown.
- `lanLogic.ts` (+ test) – pure: PIN generation, engine compatibility values, private-LAN dial validation, buffering link factory, error-code mapping.
- `http.ts` – room/matchmaking calls (online only). `copy.ts` – all English strings. `roomCode.ts`, `standings.ts` – pure, tested.
- `WifiScreens.tsx` (host lobby, join, PIN, hotspot help), `WifiNotice.tsx` (`ParentLocked`), `PassCurtain.tsx`, `SeatList.tsx`. Lobby screens live in `features/lobby/` (`RoomEntry`, `WaitRoom`, `OnlineTable`, `MatchSummary`, `TableSetup`).
- Hooks: `useOnlineSession`, `useWifiSession` (same shape plus `active`; also `useNearbyTables`), `useParentGate`, `useBackAction`.

## Flow
Online: `/room` -> `/wait` -> `/online/<game>` -> `/match`.
Wi-Fi host: `/wifi/host` (choose game, rules, length; open the table; PIN + QR + address + seats; Start; Close) -> `/online/<game>` -> `/match`.
Wi-Fi guest: `/wifi/join` (nearby tables, scan QR) or `/wifi/pin` (PIN keypad, plus a typed `ip:port` when no table was picked) -> `/wait` -> `/online/<game>` -> `/match`.
Leaving a lobby frees the seat; leaving a live table hands the seat to a bot; the host leaving a Wi-Fi table ends it for everyone.

## Same-Wi-Fi: what is real
- Real (in code, unit-tested in `shared/match` and `lanLogic.test.ts`): host table with bots filling empty seats, host plays too, PIN gate with lockout, QR and manual address, mDNS advert and scan, reconnect by resume token, host-gone and unreachable states, wrong PIN / locked / full / update-required messages, Parent controls lock (`parent.wifi`), quick-chat only, protected mode advertises no nickname.
- Not verified on hardware: everything that touches `react-native-tcp-socket`, `react-native-zeroconf`, `expo-network` and the camera. Needs a dev/release build; Expo Go does not include the native modules.
- Compatibility check: guests send an app-wide engine hash (VERSION_CODE) and a hash of all profile definitions, not the server's simulated digest. Bump `VERSION_CODE` on every release.

## Known limits and risks
- Discovery is best effort: Android NSD can miss services on some routers/guest networks (client isolation blocks everything LAN). QR and typed address always work.
- The host must stay in the foreground: a backgrounded or sleeping host phone drops the table (guests see "table ended" after 45 s). The advert lists seats at open time only.
- A hotspot host may not learn its own address (`expo-network` returns nothing on some Android versions); the host screen then says no Wi-Fi.
- The TCP port is chosen by the OS (`port: 0`); it is shown in the address and QR.
- A guest leaving in the lobby may not deliver `Leave` before the socket closes; the seat shows "Away" and the host can remove it.
- The join token of an online room has a TTL (`MatchClient` reuses it on reconnect); a long outage needs a fresh join.
- Pass-and-play: `/pass?name=Sana&next=/path` is a working curtain, but nothing routes through it yet.
- Not built (no backend support): host approval of joiners, typed chat, QR of the online room code.
