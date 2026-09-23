# Same-Wi-Fi play (no server)

The host phone runs `HostTable`: an authoritative `Room` (the class `backend/match-server` also runs, from
`shared/match/src/room/`) with in-memory stores. Guests reuse `MatchClient` unchanged. Everything here is pure
TypeScript (`@noble/hashes` only, no Node modules), so it runs on Hermes and is tested with in-memory links.

```
guest MatchClient -> linkSocket -> Link (TCP, app) ..LAN.. HostTable.accept(link) -> Room
host  MatchClient -> linkSocket -> memoryLink ------------ HostTable.acceptHost(link) -> Room
```

## Layers

- `Link { send(text), close() }` / `LinkHandlers { onText, onClose }`: one connection carrying whole JSON texts.
  The app supplies the TCP `Link` (length-prefixed frames, `framing.ts`, 4-byte big-endian length, 64 KiB cap).
- `LinkFactory = (handlers) => Link`: how the app opens a connection. A link still connecting must buffer `send`
  (`linkSocket` reports open as soon as the factory returns). Call `handlers.onClose()` once on end or failed connect.
- `linkSocket(open, session?) -> SocketLike`: makes a `Link` look like a WebSocket. `onclose` is delivered
  asynchronously, exactly once. With a `session` it also implements the PIN gate client side (below).
- `lanGuest(open, { pin, name })` -> `{ url, joinToken, socket, session }`, spreadable into `MatchClientOptions`.
- `hostSeat(table)` -> `{ url, joinToken, socket }`, the same for the host's own player over `memoryLink`.

## Wire protocol

Exactly the online protocol (`@tashzone/protocol`, major 2): `Hello`, `Welcome`, `TableSnapshot`, `ViewEvents`,
`SeedRequest`/`Ready`, `Intent`/`IntentResult`, `Start`, `Chat`, `Leave`, `Ping`... Frames are validated with
`parseClientFrame` (16 KiB max, strict schemas). One LAN-only server frame exists:

```json
{ "type": "LanSeated", "seat": 1, "resume_token": "<16 hex>-<seat>-<64 hex>" }
```

sent once after admission, before `Welcome`. `linkSocket` consumes it (MatchClient never sees it).

## PIN flow

There is no extra first message: the PIN rides in the standard `Hello.join_token`, which is a free-form 10-2048
character string. Format: `lan1:<pin>:<resume token or "->:<display name>` (name: ASCII `[A-Za-z0-9 _-]`, at most
16, may be empty). `linkSocket` rewrites the token of every outgoing Hello from its `LanSession`, so the
`joinToken` given to MatchClient is only a placeholder.

Host checks, in order, on the first frame (which must be `Hello`, within `helloTimeoutMs`, default 5 s):

1. Protocol negotiation, else `UPDATE_REQUIRED`.
2. Authentication: a valid resume token, or else the PIN. The PIN is compared in constant time.
   A wrong PIN, a malformed join token and a locked table all answer with the identical bare
   `{"type":"Error","code":"UNAUTHORIZED"}` and a close. Nothing about seats, roster, room code or fullness is
   revealed before the PIN is correct.
3. Only after authentication: free seat (else `ROOM_LOCKED`, sent only to someone who knows the PIN),
   then engine build hash and behaviour digest (else `UPDATE_REQUIRED`, and the guest is not seated).

Lockout: every failed authentication increments a table-wide counter. At `MAX_WRONG_PINS` (10) the table refuses
every PIN-based join for its remaining life (the host opens a new table with a new PIN). It never resets on success.
Resume tokens bypass the counter, so strangers guessing cannot evict a seated friend.

## Token flow

- The host holds a random secret (`randomHex(32)`). A seated guest's token is
  `<playerId>-<seat>-<HMAC-SHA256(secret, "tz/lan/resume/v1/<room>/<seat>/<playerId>")>` (noble, hex).
  `playerId` is 8 random bytes. The token is stateless-verifiable and also requires that the seat is still held by
  that `playerId`; tokens die when the guest sends `Leave`, is kicked, or the table closes.
- `LanSeated` delivers the token; `LanSession.resumeToken` keeps it in memory across sockets. On reconnect
  (`MatchClient` backoff loop) the new Hello carries it and `last_view_seq`, so `Room` replays the missed batches
  or sends a snapshot, exactly as for a WebSocket resume.
- A reclaim supersedes any still-open link of that seat (the old one is closed with "superseded").

## Seats and roles

Seat 0 is the host (`acceptHost`, in-process, not reachable from the network, no PIN). Guests take seats
`1..seats-1` in order during the lobby; empty seats are bots (Room default). `Start` is honoured only from the host
seat (`Room.start` checks the host flag); anyone else gets `Error NOT_SEATED`. After `Start` no new player can join
(`ROOM_LOCKED`); only token reclaims are accepted. The host ends the table with `table.close()`; a `Leave` from
the host seat is ignored. `Chat` is quick-chat only (no free text on a LAN table). In the lobby every connected seat
gets a fresh `TableSnapshot` whenever the roster changes. Names come from the Hello; bots keep `Bot n`.

## Failure modes

| Situation | Behaviour |
| --- | --- |
| Guest drops (Wi-Fi blip, app in background) | seat stays reserved (`playerId` kept); `PresenceChanged offline`; a turn timeout hands the seat to the hand-over bot; reconnect by token resumes, guest sends `ResumeControl` to take it back |
| Guest never returns in the lobby | host calls `table.kick(seat)` |
| Guest leaves mid-match | seat becomes a bot for the rest of the match, token invalid |
| Wrong PIN x10 | table locked to newcomers (see above) |
| Guest on another build | `UPDATE_REQUIRED`, close, not seated |
| Malformed or oversized frame, non-Hello first frame, no Hello in time | `BAD_FRAME` / `UNAUTHORIZED` and close |
| More than 20 frames/s sustained (burst 40) | `RATE_LIMITED` frames until the bucket refills |
| Host phone sleeps or is killed | the table is gone (there is no persistence); guests see their link close and cannot reconnect |
| Journal | in memory only; hand seeds are not sealed at rest (`sealSeed` is the identity on the host) |

## QR

`tashzone://wifi?h=<ip>&p=<port>&k=<pin>`. `tableQrPayload` throws and `parseTableQr` returns `null` unless the
host is a canonical dotted-quad private IPv4 (10/8, 172.16/12, 192.168/16, 169.254/16; no percent-encoding, no
leading zeros), the port is 1024-65535 and the PIN is 4 digits. No trailing parameters are accepted.
