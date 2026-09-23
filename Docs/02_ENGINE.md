# 02 — Engine

**TashZone · Universal card engine specification**
Version 2.0 · 22 Sep 2026 · Status: frozen for implementation. Priority order for every engine decision: correctness → determinism → extensibility → regional variants → multiplayer fairness → simplicity. Rules: `01_GAME_RULES.md`. Platform decisions (C-xx): `03_PLATFORM.md`.

---

## 1. Layering

| Layer | Contains | May depend on |
|---|---|---|
| **Core** (pure, deterministic) | primitives P-01…P-18 | nothing |
| **Rules** | RuleProfiles (data), family policies, two plugins (§7) | Core |
| **Runtime Reducer** (shared, pure) | table lifecycle, seat control, deadlines as data, window bookkeeping, journal and seal commands — identical on every host | Core, Rules |
| **Runtime Shell** (one per host: match server, phone, same-Wi-Fi host, replay, simulator) | clocks, networking, persistence, seed sources, timers, bot execution, delivery, runtime projection guard | Runtime Reducer |
| **Clients** | rendering, input, localisation | projections only |

```
step(state, action) -> (state', events[])        # total, deterministic, no I/O
project(state, viewer) -> SeatView               # pure; the only exit for game data
legal_actions(SeatView-derived context) -> Action[]
```

Rule code has three tiers: **primitives** (game-agnostic; a parameter may not name a game), **family policies** (shared by a family), **plugins** (game-specific). Extension ladder for new games: new profile or preset = data; new parameter value = engine minor release; new primitive or plugin = engine minor release with its own golden suite.

---

## 2. Primitives

| ID | Primitive | Contract |
|---|---|---|
| P-01 | Card identity and DeckSpec | builds the deck from `{base, ranks, suits, copies, jokers, extras, remove_by_seats}`; internal `CardUID` stable within a hand; conservation (Σ zones = deck) at every step; CardUID never exposed for a card the viewer cannot see |
| P-02 | Orders | `trick_order(card, context)`, `sequence_adjacency`, `rank_order`; context = led suit, trump, trump active, promotions; pure; does not decide trump activation or duplicate ties |
| P-03 | Value tables | named integer tables; fixed-point units declared per profile; no floating point anywhere |
| P-04 | Zones and CardGroups | every card in exactly one zone and at most one group; zones: Hand, Stock, Discard, Waste, Trick, Centre, Team/SeatPile, Floor, LayoutRows, SetAside, IndicatorSlot, BottomOfStock, Removed; groups: House, Meld, TrickBundle, Arrangement, Claim; zones carry no visibility |
| P-05 | Visibility and projection | per-card visibility sets changed only by reveal/transfer events; per-seat knowledge flags and derived-fact rules; hidden attributes with per-seat visibility; **opaque handles** re-issued on every move; per-zone `post_hand ∈ {reveal_all, reveal_to_owner, conceal}` (default `reveal_all`) |
| P-06 | Seats, teams, participation | ring, direction, teams (none, fixed pairs, alternating, hidden by called cards); flags ACTIVE, ESCAPED, FOLDED, SITTING_OUT, FINISHED; "next seat" always skips non-participants; hidden membership never revealed by ordering, colour or scoring |
| P-07 | Scheduler | `WaitingOn{mode: TURN \| WINDOW \| AUTO, seats}` derived from state, never from a clock |
| P-08 | Deal engine | schedules with triggers that suspend the deal for a phase and event-triggered continuation; redeal/annulment predicates (full-state, public outcome); dealer rotation from `HandResult` |
| P-09 | Randomness | the only randomness; `hand_seed` derived by HMAC over server seed, ordered client seeds (or logged substitutes) and hand id; commitment published before client seeds are requested; `draw(purpose_label, pool)` over canonical order, every draw logged; fresh server seed per hand |
| P-10 | Actions and events | `Action{hand_id, seq (server), actor: seat \| system \| host, type, public_payload, private_payload}`; envelope metadata `intent_id`, `origin`, `epoch` never affects `step`; validation: schema → may act now → legality → plugin invariants → effects; no effect without an event |
| P-11 | Legality | composable predicates reading **only the actor's SeatView plus public state**; full-state predicates (annulments, end-of-hand checks) are `server_only` with public outcomes; `validate` required, `enumerate` optional; rejection reasons never reveal hidden data |
| P-12 | Round resolver | one round for tricks, interrupts and group comparisons: `unit`, `participants`, `early_termination`, `winner` with trump activation `immediate \| trick_inclusive \| card_level`, `tie: first \| last`, `destination`, `collection`, post-round hooks |
| P-13 | Evaluators and solvers | 3-card classes and `best3`; pair matcher with wild predicate; run/set validators; sum-partition enumerator; meld exact-cover (plugin); pure and bounded; wild predicates receive knowledge-scoped input |
| P-14 | Ledger | integer entries with reasons; multipliers; zero-sum settlement; no currency semantics |
| P-15 | Event log and replay | per hand: profile hash, engine build, seed commitment, ordered actions, draw records, events; hash-chained, canonical serialisation, no timestamps in state; `replay(seed, profile, actions) == recorded events`; bots are never re-run |
| P-16 | Interaction windows | every out-of-turn or multi-party input; spec `{eligible_seats, ordering, visibility: open \| sealed, close_rule, default_response, max_responses_per_seat, standing_responses, default_deadline_ms, eligibility: public \| hidden}`; concurrent responses ordered by server sequence; sealed commits revealed together; a window blocks the turn scheduler; standing responses are logged actions and close windows early; their existence is never projected. **Hidden eligibility:** when the window's `eligibility` is `hidden` (who may respond depends on hidden cards), the window opens for every hand whether or not any seat is eligible, runs a **fixed duration** identical for all viewers, never closes early and allows no standing responses; ineligible viewers see the same neutral state |
| P-17 | Transfers | `open`, `private_to(receiver)`, `private_to(both)`, `blind_pick`, `bulk`, `pile_to_hand`; conservation; handles re-issued; third parties learn counts only |
| P-18 | MatchState | ledgers, streaks, baazi, pips, debts, dealer, tallies; `apply(HandResult)`, `dealer_next`, `match_over`, `guard_outcome`; a hand starts from (MatchState, seed, profile) only |

**Projection law.** For any viewer V and states S1, S2 differing only in data V may not know, `project(S1, V) == project(S2, V)`, including legal actions and hints. **View-legality equivalence:** `legal(project(S, seat)) == legal_server(S, seat)`.

**Post-hand limit.** Seeds are revealed after the hand for verification, so any participant can recompute the deal. `conceal` is a presentation policy only and is never promised as confidential.

---

## 3. Journal commit contract

Normative for every authoritative shell.

1. **Seed first.** Encrypted seed material and commitment are persisted before the commitment is broadcast or client seeds are requested.
2. **Step on a copy.** One journal transaction per accepted intent: `InputRecord{hand_id, server_seq, epoch, intent_id, actor, origin, action bytes, previous-record hash, post-step state hash}` plus the step's draw records.
3. **Commit, swap, publish.** Events are released only after commit. On commit failure the copy is discarded and the table pauses (`TABLE_PAUSED`; deadlines stop; retry with backoff).
4. **Epoch-checked writes.** A write succeeds only under the room's current ownership epoch (C-20); a stale owner cannot commit and therefore cannot publish.
5. **Rejected intents** change nothing and go to the incident log (C-25), not the journal.
6. **Duplicate intents** `(seat, hand_id, intent_id)` return the committed outcome; uniqueness is enforced by the journal.
7. **Seal.** The final record and `HandSeal{seeds, chain root, result, MatchState checkpoint digest}` commit together; `HandSealed` is published afterwards.
8. **Recovery.** The next owner (epoch + 1) replays each live hand under the same engine build; clients resynchronise by snapshot. If that build is unavailable the match ends `MATCH_INTERRUPTED`.
9. **Deadlines** restart in full whenever play resumes after a pause, recovery or hand-over, as a logged system action.

---

## 4. Determinism rules

1. `step` is total and pure.
2. All randomness through P-09 with canonical pools and purpose labels.
3. Time enters only as logged `Timeout` actions; no module reads a clock.
4. Concurrency is serialised by server sequence numbers.
5. Bots, hints and hand-over decisions live outside the core and enter as actions.
6. Integers only.
7. Profile hash and engine build are pinned per **match**; a match continues in another process only under the identical `engine_build_hash`, otherwise it ends `MATCH_INTERRUPTED`.
8. Iteration over sets is canonical (CardUID, seat order), including plugins.
9. Every hand has a finite action cap with a profile-declared outcome (G-57).
10. Saved games are `{profile ref, effective_profile_hash, engine_build_hash, seed material, input log, state hashes}`; loading under another build replays and compares hashes; on divergence the game cannot continue.

Enforcement: the deterministic TypeScript subset (`03_PLATFORM.md` §3) and three-engine replay tests (`04_QUALITY_RELEASE_ROADMAP.md`).

---

## 5. Reconnect contract

- A reconnecting client receives a projection snapshot; no client state is trusted.
- While disconnected: pending TURN → `Timeout` → hand-over bot on the seat's SeatView; pending WINDOW → default response.
- Hand-over is announced and labelled; in auctions hand-over bots pass rather than bind an absent player.
- A draining host keeps accepting reconnections for tables it owns.
- Clients never apply predicted or optimistic state.

---

## 6. Information-security checklist

| ID | Channel | Rule |
|---|---|---|
| L-01 | CardUIDs of face-down cards | never sent; opaque re-issued handles |
| L-02 | Aggregates over hidden data | forbidden |
| L-03 | Eligibility prompts | shown only to eligible seats; their existence is not projected |
| L-04 | Rejection messages | generic unless derivable from the actor's view |
| L-05 | Legal-move lists and hints | computed from the actor's SeatView |
| L-06 | Spectators | public-only during the hand |
| L-07 | Escaped, folded, eliminated players | public-only during the hand |
| L-08 | Bots and hand-over bots | same SeatView as a human in that seat |
| L-09 | Hidden-trump owner's partner | sees nothing extra |
| L-10 | Annulment reasons | disclosed only after annulment |
| L-11 | Auto-play of forced moves | opt-in, fixed minimum delay |
| L-12 | Seeds | fresh per hand; revealing one discloses nothing about later hands |
| L-13 | Same-Wi-Fi host | holds full state → tables never rated |
| L-14 | Production projection bugs | the shell checks every outgoing payload against `visible_card_ids(state, viewer)`; a violation blocks the message, pauses the table, annuls the hand and alarms (logged without card data) |
| L-15 | Logs and crash reports | no state, SeatView or payload in messages, breadcrumbs or text logs |
| L-16 | Debug and admin routes | none returns live state, seeds or another viewer's view in any shipped build or production deployment |
| L-17 | Window timing | a window with hidden eligibility has the same duration and presentation whether or not anyone is eligible (P-16) |

---

## 7. Plugins

| Hook | Signature |
|---|---|
| `validate_move` | (SeatView-context, action) → ok \| reason |
| `enumerate_moves` | (SeatView-context) → actions |
| `effects` | (state, action) → effects |
| `check_invariants` | (state′) → ok \| violation |
| `evaluate` | (cards, knowledge) → value |

| Plugin | Scope | Games |
|---|---|---|
| **SeepHouses** | house building, breaking, cementing, co-ownership, ownership invariant, maximal-capture enumeration | Seep |
| **MarriageMelds** | wild derivation from the tiplu, exact-cover meld validation with wilds, dublee path, maal | Marriage (validators reused by Jutpatti, Dhumbal) |

Plugins may not call P-09, read other seats' private zones in `validate_move`, mutate state except through effects, read clocks, network, storage or locale, use floating point, iterate non-canonically or hold state between calls.

**Never inside a game:** randomness; clocks or timers; projection or visibility; networking, persistence, logging or crash handling; turn order outside P-06/P-07; bot logic beyond a SeatView; concurrency resolution outside P-16; card movement outside P-17; match state outside P-18; floating point or currency; hard-coded variants; localised strings; special cases an existing parameter could express.

---

## 8. Bots

- Input: SeatView and the public action log only; output: an action from `legal_actions`.
- Bot randomness uses bot-local seeds outside the core; chosen actions are logged, so replay never re-runs bots.
- Hand-over bots use the departed seat's SeatView and remember nothing the seat could not have seen.
- On the server, every searching tier runs in a worker thread that receives only a serialised SeatView.
- The bots package may import only view types and the engine API (enforced by package boundaries in CI); determinisation uses `determinize(seat_view, assignment)`.

---

## 9. Compatibility

**Identifiers:** `protocol_version` · `engine_build_hash` · `profile_id@version` · `profile_hash` · `effective_profile_hash` · `behaviour_digest(profile version, engine build)` · app `versionCode`.

**Behaviour digest.** CI replays each profile version's golden corpus, variant toggles and a fixed-seed simulation set, and hashes the legal-action sets, state hashes and events. Equal digests mean compatible behaviour for that profile (a strong regression proxy, not a proof).

| Pair | Rule |
|---|---|
| App ↔ match server | negotiated protocol; server supports current and previous major |
| App engine ↔ table | admitted only if digests are equal; otherwise `UPDATE_REQUIRED` before seating |
| Server engine ↔ running match | pinned for the match |
| Profile ↔ engine | profile declares `min_engine_version` |

**Release rule.** An engine change that alters any digest ships app-first; the server adopts it after the adoption threshold (O-07) or a forced-update date. Changes that keep every digest need no coordination. Engine release classes: PATCH (no behaviour change), MINOR (new capabilities, existing profiles unchanged), MAJOR (behaviour change; new profile versions where meaning changed).

---

## 10. Implementation order

1. P-01…P-04, P-06, P-07, P-10, P-15 skeleton, P-09 → determinism harness before any game.
2. P-05 with opaque handles and the projection-law harness.
3. P-12, P-11, P-08 triggers, P-18.
4. P-16 and P-17.
5. P-13, P-04 groups, plugin host.

---

## 11. Open items

| ID | Item | Needed before |
|---|---|---|
| G-57 | action-cap outcome per game | each game's release |
| O-07 | adoption threshold for behaviour-changing engine builds | first behaviour-changing release |
