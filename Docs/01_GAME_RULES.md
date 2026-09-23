# 01 — Game Rules

**TashZone · South Asian card games · Rule specification**
Version 2.0 · 22 Sep 2026 · Status: frozen for implementation. Engine primitives (P-xx) are defined in `02_ENGINE.md`.

---

## 0. Conventions

### 0.1 Tags
| Tag | Meaning |
|---|---|
| (untagged) | rule stated by a source; sources are listed per game and indexed, with "Research §x" references, in `MASTER_SOUTH_ASIAN_CARD_GAMES_RESEARCH.md` |
| `DESIGN` | digital adaptation that the sources leave open and that does not change who wins (e.g. sequential order, RNG, timeouts) |
| `UNRESOLVED(G-xx)` | no source settles it; candidates are listed and nothing is silently chosen (§3) |
| `OWNER` | tradition has no rule; a product decision is required (§3) |

### 0.2 Profile schema
```yaml
profile:
  id: <game>.<preset>@<version>          # immutable once frozen
  extends: <profile id>                   # optional; child overrides listed keys only
  status: FROZEN | FROZEN_WITH_GAPS | PROVISIONAL
  family: trick | inflation | capture | compare | layout | claim | draw_discard
  seats: { min, max, teams: none | fixed_pairs_opposite | two_teams_alternating | hidden_by_called_cards }
  direction: clockwise | counter_clockwise
  deck: { base, ranks, suits, copies, jokers, extras, remove_by_seats }
  orders: { trick, sequence, compare }    # see P-02
  values: { ... }                         # see P-03
  deal: { first_dealer, schedule, triggers, redeal, dealer_rotation }
  trump: { mode, activation, indicator }  # see P-12
  phases: [ ... ]                         # see 02
  play: { lead, follow, obligations, round }
  windows: [ ... ]                        # see P-07
  scoring: { hand, match }
  visibility: { ... }                     # see P-05; zones holding concealed cards declare post_hand (P-05)
  randomness: [ named draw points ]       # see P-09
  guards: { max_actions_per_hand }        # G-57
  variants: [ ids in 03 ]
```

Every profile's `match:` block is `OWNER` unless a source defines a match end. Profiles are immutable once frozen; changes create a new version.

### 0.3 Profile status
| Status | Meaning |
|---|---|
| FROZEN | complete; may ship |
| FROZEN_WITH_GAPS | complete for the default; listed gaps affect optional flags or specific presets |
| PROVISIONAL | core rules depend on open gaps; may not ship until they close |

### 0.4 State-machine notation and shared sub-machines
### 0.1 Levels
`MATCH → HAND → PHASE → STATE`. A **state** has exactly one of three waiting modes:

| Mode | Meaning | Resolution |
|---|---|---|
| `TURN(seat)` | One seat must act | Its action, or a `Timeout` system action (P-10) |
| `WINDOW(eligible, order, close_rule)` | Several seats may act (claims, declarations, simultaneous commits) | P-07: server sequence order; close on rule; missing responses → `Decline` system actions |
| `AUTO` | No input; engine computes (resolution, dealing, RNG draws) | Deterministic function of state + P-09 draws |

Every transition is triggered by a logged **action** (seat, system or host) or is `AUTO`. No transition depends on wall-clock time except through a logged `Timeout` action.

### 0.2 Match machine (all games)

| State | Mode | Transition |
|---|---|---|
| `M0 SETUP` | AUTO | seats, profile hash, first dealer (R-*-shuffle or draw) → `M1` |
| `M1 HAND` | — | run the hand machine → `M2` |
| `M2 HAND_RESULT` | AUTO | apply hand result to MatchState (ledger, streaks, debts, baazi, pips) → `M3` |
| `M3 MATCH_END?` | AUTO | profile `match` predicate true → `M4`; else dealer rotation → `M1` |
| `M4 MATCH_OVER` | terminal | |

Profile changes are only accepted in `M3` (EC-47).

### 0.3 Shared sub-machines

**SM-DEAL** `AUTO`: shuffle (P-09) → schedule batches → at each `TRIGGER` step, suspend the deal and enter the named phase; resume after it. Redeal/annulment predicates run at their declared points (server-only, P-11). A redeal returns to `SM-DEAL` with the same or next dealer per profile and logs `HandAnnulled(reason)`.

**SM-TRICK** (P-12 Round, unit = card):

| State | Mode | Legal actions | Transition |
|---|---|---|---|
| `T0 LEAD` | TURN(leader) | `Play(card)` satisfying lead predicates | → `T1` |
| `T1 FOLLOW` | TURN(next participant) | `Play(card)` satisfying follow predicates; game-specific `AskTrump`, `RevealTrump` | if `interrupt(state)` → `T2`; if all participants played → `T2`; else `T1` |
| `T2 RESOLVE` | AUTO | — | winner = profile winner function (trump activation policy); route cards by outcome (P-12 destinations); apply collection policy → `T3` |
| `T3 POST` | WINDOW or AUTO | post-round declarations (e.g. 29 Pair) | → next `T0` or hand end |

**SM-AUCTION**: `A0 BID(seat)` TURN → `Bid(n) | Pass | Ditto(if profile)`; close when the profile's pass count is reached; forced-bid rule on all-pass; → contract.

**SM-ARRANGE-SHOW** (compare family): `C0 ARRANGE` WINDOW(all, simultaneous, hidden) → `Commit(partition)` with validity predicate; close when all committed or timeout → system `AutoArrange` (optimiser, logged) → `C1 SHOW_ROUND(k)` AUTO/TURN → `C2 RESOLVE_ROUND` → next round or hand end.

**SM-DRAW-DISCARD**: `D0 DRAW` TURN → `Draw(stock|discard)`; `D1 ACT` TURN → declarations (show/meld/see-joker/call); `D2 DISCARD` TURN → `Discard(card)`; stock empty → `RESTOCK` AUTO (P-09 draw).

**SM-WINDOW** (P-07): `W0 OPEN(eligible, order, close_rule, default)` → accepts `Respond(seat, action)` in server-sequence order → closes on (first valid claim | all responded or holding a standing response | timeout) → missing seats get `default` as logged system actions → `W1 APPLY`. Standing responses and early close follow P-16; setting a standing response is a logged action.

### 0.4 Terminal-condition vocabulary
`HAND_END(result)` carries: finishing order / trick counts / captured cards / declarations / annulment flag. `HAND_ANNULLED(reason)` returns to `SM-DEAL`. `GUARD_TRIPPED` (action cap, G-57) ends the hand with the profile's guard outcome (OWNER). `MATCH_INTERRUPTED(reason)` is a platform terminal at match level, reached only at a hand boundary (or by annulling the hand in progress) when the match cannot continue under the same engine build (`02_ENGINE.md` §4 rule 7, C-14); it is unrated and recorded distinctly (O-08).

---

## 1. Catalogue

| Profile | Status | Ship-blocking gaps |
|---|---|---|
| getaway.classic | FROZEN_WITH_GAPS | none for default flags (G-01/02 block the take-from-neighbour flag) |
| kazhutha.kasaragod / kazhutha.app | FROZEN_WITH_GAPS | G-10 (which one is "Kazhutha") |
| callbreak.np / callbridge.bd | FROZEN_WITH_GAPS | none for release; G-12 affects defaults |
| rang.single / hidden_trump / double_sar | FROZEN_WITH_GAPS | none (G-16 is UX) |
| rang.hidden_rung | FROZEN_WITH_GAPS | G-17 |
| rang.beranga | FROZEN_WITH_GAPS | G-21 |
| twentynine.pagat | FROZEN_WITH_GAPS | G-23 |
| mendikot.pagat / dehlapakad.pagat | FROZEN_WITH_GAPS | G-26 |
| teendopaanch.pagat | FROZEN | — |
| seep.north100 / seep.punjab30 | FROZEN_WITH_GAPS | G-30 |
| hazari.bd | FROZEN | — (G-34 is a rare final tie) |
| kaliteeri.catsatcards | PROVISIONAL | G-36, G-37, G-38 |
| badamsatti.in | FROZEN_WITH_GAPS | — |
| bluff.base | PROVISIONAL | G-43 |
| kitti.np | PROVISIONAL | G-44, G-45, G-46 |
| marriage.np | FROZEN_WITH_GAPS | G-48 |
| dhumbal.np | PROVISIONAL | G-54 |
| jutpatti.np | PROVISIONAL | G-56 |

## 1.1 Thulla / Bhabhi / Getaway — `getaway.classic@1`

Status: **FROZEN_WITH_GAPS** (gaps affect optional flags and scoring modes only).

```yaml
id: getaway.classic@1
family: inflation
labels: { display: OWNER, aliases: [Thulla, Bhabhi, Getaway, Bhabho, Laad] }   # naming is an owner decision (Research §5.2)
seats: { min: 3, max: 8, teams: none }
direction: clockwise
deck: { base: std52, copies: 1, jokers: 0 }
orders: { trick: natural_A_high }

deal:
  first_dealer: random   # DESIGN ("any player may deal")
  schedule: all_cards_one_at_a_time_from_dealer_next   # "as equally as possible"; start seat DESIGN
  unequal_hands: allowed
  dealer_rotation: next_seat_in_direction   # recommendation

opening_trick:   # trick #1
  leader: holder_of(AS)
  leader_card: AS
  order: sequential_in_direction_from_leader   # DESIGN (physical play allows free order)
  follow: must_follow_suit
  void_play: any_card, does_not_end_trick
  destination: waste (always, even if a void occurred)
  winner: owner_of_highest_spade   # (= AS holder with one deck)

trick:   # trick #2 onward
  leader: power_holder
  lead: any_card_in_hand
  follow: must_follow_suit_if_able
  void_play: any_card_and_ENDS_trick (thulla/tochoo)
  on_interrupt: all_trick_cards -> hand(owner_of_highest_led_suit_card_so_far)
  on_clean: all_trick_cards -> waste
  next_power_holder: owner_of_highest_led_suit_card   # (both outcomes)
  tie_equal_cards: n/a with one deck

escape:
  evaluated_at: trick_resolution   # DESIGN, derived from (a player whose last card is overtaken
                                                     #   escapes; one whose last card stays highest does not)
  rule_non_power_holder_with_0_cards: escaped
  rule_power_holder_with_0_cards: draw_from_waste   # main rule (variants BH-09 = b, BH-11 = c in 03)
  draw_from_waste:
    pool: waste_excluding_current_trick
    selection: uniform_random   # "shuffled"; RNG point R-BH-1
    drawn_card: must_be_led
  hand_end: when at most one non-escaped player remains; that player (if any) is the loser   # derived
  all_others_escape_same_trick_as_empty_power_holder: power_holder_loses   # two-player case "A is the loser"
                                                                             # generalised; with BH-11c see G-04
  finishing_order_ties: UNRESOLVED(G-05)   # matters only for penalty-point scoring
    # provisional: order of play within the trick (earlier card = earlier finish)

two_player:
  continue_normally: true
  shortcut: after_forced_draw   # : after A leads a drawn card and B thullas, A loses at once
  # variant BH-14 (CardzMania): any thulla in a two-player finish ends the hand, thulla player wins

take_from_neighbour: disabled   # variant BH-12, gated by G-01, G-02

errors: prevented   # DESIGN — digital enforcement makes S1 penalties unreachable

scoring:
  hand: { loser: last_non_escaped, finishing_order: recorded }
  mode: loser_tally   # penalty_points is variant BH-15 
match: OWNER   # gives no match end (G-58)

visibility:
  hand_counts: public   # DESIGN (physical play exposes counts)
  waste: face_down, contents_not_projected   # played cards were public when played
  opening_trick, tricks_in_progress: public
  pickup: picker learns nothing new (cards were face up)
  escaped_players_view: public_only   # DESIGN — prevents full-view relay to friends (`02_ENGINE.md` §6)

randomness: [ R-BH-1 draw_from_waste ]
guards: { max_actions_per_hand: OWNER(G-57) }
variants: [BH-01 … BH-19, KZ-01 … KZ-03]   # 03
```

**Default vs variants.** The default above is Pagat's Punjabi description. Everything from CardzMania (penalty points, shootout, draw-rule scope, double deck, second-played-wins) and every app mode is a variant in `03`.

**Hand machine**

**State variables**

| Variable | Type | Visibility |
|---|---|---|
| `hand[s]` | multiset of CardUID | owner (others: count) |
| `waste` | set of CardUID (canonical CardUID order for RNG) | face down; never projected |
| `trick` | ordered list of (seat, card, play_seq) | public |
| `led_suit` | suit | public |
| `power_holder` | seat | public |
| `status[s]` | ACTIVE \| ESCAPED | public |
| `finish_order` | list of seats (ties grouped) | public |
| `forced_draw_lead` | bool (current lead card came from a forced draw) | public |
| `trick_index` | int | public |
| `participants` | seats ACTIVE at trick start (fixed for the trick) | public |

**Transitions**

| ID | From | Trigger | Guard | Effects | To |
|---|---|---|---|---|---|
| BH-T01 | DEAL | AUTO | — | deal all cards (P-08); `power_holder := holder(A♠)` (2 decks: designated A♠ of deck 1) | OPEN_LEAD |
| BH-T02 | OPEN_LEAD | `Play(A♠)` by power_holder | only legal action | append to trick; `led_suit := ♠` | OPEN_FOLLOW |
| BH-T03 | OPEN_FOLLOW | `Play(c)` by next participant (direction) | c is ♠ if seat holds ♠; else any | append | OPEN_FOLLOW or BH-T04 |
| BH-T04 | OPEN_FOLLOW | AUTO | all participants played | `power_holder := owner(highest ♠)` (tie: first played); all trick cards → waste | ESCAPE_EVAL |
| BH-T05 | ESCAPE_EVAL | AUTO | — | every seat with `len(hand)=0` and `≠ power_holder` → ESCAPED, appended to `finish_order` (same-trick ties: G-05) | BH-T06 |
| BH-T06 | ESCAPE_EVAL | AUTO | count(non-escaped) | ≤1 → HAND_END(loser = remaining seat); =2 → TWO_PLAYER_PRE; else PRE_TRICK | … |
| BH-T07 | PRE_TRICK | AUTO | `take_from_neighbour` off | — | LEAD |
| BH-T08 | PRE_TRICK | AUTO | flag on and trick_index ≥ 2 (trick 1 eligibility: G-01) | open TAKE_WINDOW (eligible: non-escaped seats; order: direction from power_holder; one response each; default Decline; standing response `decline` allowed for the hand; closes early per P-16) | TAKE_WINDOW |
| BH-T09 | TAKE_WINDOW | `TakeFromNeighbour` by s | victim := next non-escaped seat with cards in direction from s; victim ≠ power_holder unless G-02 resolved | `hand[s] += hand[victim]` (P-16, visible to s only); victim → ESCAPED | ESCAPE_EVAL |
| BH-T10 | LEAD | `Play(c)` by power_holder | any card in hand (after a forced draw the hand is exactly the drawn card) | `participants := non-escaped seats`; `led_suit := suit(c)` | FOLLOW |
| BH-T11 | FOLLOW | `Play(c)` by next participant | `suit(c)=led_suit` if seat holds led suit | append | FOLLOW or BH-T13 |
| BH-T12 | FOLLOW | `Play(c)` by next participant | seat holds no led suit (any c) | append; **interrupt** | THULLA_RESOLVE |
| BH-T13 | FOLLOW | AUTO | all participants played, no interrupt | — | CLEAN_RESOLVE |
| BH-T14 | THULLA_RESOLVE | AUTO | — | picker := owner(highest led-suit card so far) (2 decks: tie rule); all trick cards → `hand[picker]`; `power_holder := picker` | SHORTCUT_CHECK |
| BH-T15 | SHORTCUT_CHECK | AUTO | two-player mode ∧ profile shortcut = `after_forced_draw` ∧ `forced_draw_lead` ∧ follower still had cards | HAND_END(loser = leader) | HAND_END |
| BH-T15b | SHORTCUT_CHECK | AUTO | two-player mode ∧ shortcut = `any_thulla` (variant BH-14) | HAND_END(loser = non-thulla player) | HAND_END |
| BH-T16 | SHORTCUT_CHECK | AUTO | otherwise | `forced_draw_lead := false` | ESCAPE_EVAL |
| BH-T17 | CLEAN_RESOLVE | AUTO | — | `power_holder := owner(highest led-suit card)` | POWER_EMPTY_CHECK |
| BH-T18 | POWER_EMPTY_CHECK | AUTO | `len(hand[power_holder])>0` | trick → waste | ESCAPE_EVAL |
| BH-T19 | LONE_CHECK | AUTO | every other participant has 0 cards | trick → waste; HAND_END(loser = power_holder) | HAND_END |
| BH-T20 | FORCED_DRAW | AUTO (rule a) | — | P-09 draw `R-BH-1` over waste **excluding the current trick** (canonical order) → `hand[power_holder]`; then trick → waste; `forced_draw_lead := true` | ESCAPE_EVAL |
| BH-T20b | FORCED_DRAW | AUTO (rule b) | — | draw uniformly from hand of next non-escaped seat (variant; victim-escape consequence G-09) | ESCAPE_EVAL |
| BH-T21 | PASS_LEAD | AUTO (rule c, ≥3 non-escaped before trick) | — | power_holder → ESCAPED; `power_holder := next non-escaped seat with cards` | ESCAPE_EVAL |

**Invariant BH-I1.** The power holder is never marked ESCAPED by BH-T05 (only by BH-T21 or a take).
**Invariant BH-I2.** `len(waste excluding current trick) ≥ 1` whenever BH-T20 runs (opening trick ≥ 3 cards; each forced draw removes 1 and the subsequent clean trick adds ≥ 2). Asserted, not assumed.
**Invariant BH-I3.** Card conservation: `Σ len(hand) + len(waste) + len(trick) = deck size`.

**Edge cases (engine-checked)**

| ID | Situation | Machine path | Result | Basis |
|---|---|---|---|---|
| BX-01 | First follower is void (immediate thulla) | T10→T12→T14 | leader picks up own lead + thulla, leads again | S1 |
| BX-02 | Last card played as thulla | T12→T14→T05 | thulla player escapes | S1 |
| BX-03 | Last card is highest led-suit card, then another seat thullas | T14 | that seat picks up; not escaped | S1 |
| BX-04 | Last card is highest in a clean trick | T17→T18/T19/T20/T21 | profile escape rule | S1 |
| BX-05 | Every other participant emptied in the same clean trick as the empty power holder | T19 | power holder loses | S1 (two-player case), generalised |
| BX-06 | Same as BX-05 under rule (c) | T19 applies before T21 | power holder loses | provisional; G-04 |
| BX-07 | Two left; A leads last card from hand, B follows lower with last card | T17→T19 | A loses | S1 |
| BX-08 | Two left; A leads last card, B follows lower with cards left | T20 | A draws and leads | S1 |
| BX-09 | Two left; after forced draw, B follows higher (even with last card) | T17: power → B; A (0 cards, not power) escapes in T05 | B loses | S1 |
| BX-10 | Two left; after forced draw, B thullas | T15 | A loses | S1 |
| BX-11 | Two left; B thullas in a normal (non-draw) trick | T16 (default) / T15b (variant) | default: A picks up and leads; variant: B wins | S1 vs S2 |
| BX-12 | Opening trick: seat void in spades | T03 | plays any card; trick still to waste | S1 |
| BX-13 | Two A♠ (double deck) | T01 designated opener; tie in T04 | first-played wins (default) | S1, S2 |
| BX-14 | Take from neighbour when neighbour escaped | T09 victim search skips escaped | next seat with cards | S1 |
| BX-15 | Take when only two remain | T09 then T05/T06 | victim escapes → taker is last → loses; profile may forbid (G-01) | derived |
| BX-16 | Take where victim = power holder | T09 guard | blocked until G-02 | G-02 |
| BX-17 | Two escapes resolved in the same trick | T05 | tie ordering per G-05 (only affects penalty scoring) | G-05 |
| BX-18 | Disconnect during TAKE_WINDOW | W0 default | logged Decline | P-07 |
| BX-19 | Disconnect on turn | Timeout → system `Play` chosen by the hand-over bot on the seat's information set | logged | P-10 |
| BX-20 | Escaped player remains at table | view = public only; may chat per voice policy | — | `02_ENGINE.md` §6 |
| BX-21 | Hand length unbounded (repeated forced draws) | action cap `GUARD_TRIPPED` | OWNER outcome | G-57 |

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| BH-01 | Seat range | 3–12 (CardzMania), 2–8 (web), 3–6 (app) vs 3–8 | 9–12 requires BH-02 | TOGGLE (3–8); 9–12 PRESET with BH-02 |
| BH-02 | Double deck | 104 cards; CardzMania assigns 2 decks at ≥7 players | requires BH-03, BH-04 | PRESET ("Big table") |
| BH-03 | Equal-card tie | second-played wins (default first-played) | needs BH-02 | TOGGLE |
| BH-04 | Designated A♠ opener | marked A♠ (deck 1) opens | needs BH-02 | automatic with BH-02 |
| BH-05 | Pile-choice deal | dealer splits unseen piles; youngest picks first | needs player ages; digital emulation needs RNG pile sizes | DEFER |
| BH-06 | Handicap deals 16/12, 19/11 | human gets more cards | — | REJECT as a rule; reuse as bot difficulty |
| BH-07 | Anticlockwise play | direction reversed; take-from-neighbour uses the right | affects BH-12 side | TOGGLE / PRESET |
| BH-08 | Opening-trick void causes pickup | — | G-06 | DEFER (candidate only) |
| BH-09 | Escape-with-power (b) | draw random card from next player's hand | victim-empties case G-09 | TOGGLE |
| BH-10 | Escape-with-power (b′) | draw from any chosen player's hand | chooser semantics | DEFER |
| BH-11 | Escape-with-power (c) | with >2 players you escape; lead passes to next seat with cards; with 2 players (a) applies | total-escape case G-04 | TOGGLE; part of "Scored" preset |
| BH-12 | Take all cards from neighbour | before any trick, take all of next-with-cards player's hand; victim escapes | G-01, G-02; collusion vector in public tables (a friend can "free" a friend) | DEFER until G-01/G-02; then TOGGLE private only |
| BH-13 | Draw rule scope | draw-from-waste only head-to-head vs at all counts | same axis as BH-11 | folded into BH-11 |
| BH-14 | Shootout on any thulla | in a two-player finish any thulla ends the hand; thulla player wins | replaces Pagat shortcut | TOGGLE; part of "Scored" preset |
| BH-15 | Penalty points | first 0, second 1, middle 2, last 3; game ends at 6; lowest wins | same-trick ties G-05; final ties G-14 | TOGGLE (scoring mode) |
| BH-16 | Fixed rounds | match = N hands | — | TOGGLE |
| BH-17 | Turn timer 7/15/30/60/off | off only in private rooms | platform | TOGGLE |
| BH-18 | Mini/quick mode | undefined | — | DEFER |
| BH-19 | Loser label / title | "Bhabhi" vs neutral | OWNER | presentation setting |

*Sources:* S1, S2, S4, S5, S7

---

## 1.2 Kazhutha / Donkey (Kasaragod) — `kazhutha.kasaragod@1`

Status: **FROZEN_WITH_GAPS** (regional default G-10).

```yaml
id: kazhutha.kasaragod@1
extends: getaway.classic@1
labels: { display: "Kazhutha", aliases: [Donkey] }
trump:
  mode: emergent_first_void   # : the first card played by a player unable to follow
                                                     #   (opening trick included) fixes the trump suit for the hand
  activation: immediate   # : that card is a trump in the same trick and may win it
opening_trick:
  void_play: any_card, does_not_end_trick
  winner: highest_trump_else_highest_spade
  destination: waste   # "remaining rules are the same as Getaway"
trick:
  follow: must_follow_suit_if_able
  void_with_trump: must_play_trump   # (does not end the trick)
  trump_led: must_play_trump_if_able
  void_without_follow_or_trump: any_non_trump_card_ENDS_trick
  winner: highest_trump_else_highest_led
  on_interrupt: trick -> hand(winner)
  on_clean: trick -> waste   # ("everyone plays led suit or a trump")
  next_power_holder: winner
escape: inherits   # (draw from previous tricks)
scoring:
  loser_label: "donkey with x legs", x = cards held at end incl. last pickup
```

`kazhutha.app@1` (variant KZ-02) = `getaway.classic@1` with the Kerala label, "vettu" terminology and 4–6 seats ``. Which one Kerala players mean by "Kazhutha" is `UNRESOLVED(G-10)`.

**Hand machine**

Same machine as §1 with these changes:

| Change | States affected | Rule |
|---|---|---|
| `trump_suit` state variable (null → suit) | OPEN_FOLLOW, FOLLOW | first card by a seat unable to follow sets `trump_suit`; activation immediate |
| Follow predicate | OPEN_FOLLOW, FOLLOW | must follow; else must play trump if held (once trump exists); else any |
| Interrupt predicate | FOLLOW only | void seat holding no trump plays a non-trump off-suit card (a trump never interrupts) |
| Winner function | OPEN_RESOLVE, THULLA_RESOLVE, CLEAN_RESOLVE | highest trump, else highest led suit |
| Opening trick | OPEN_FOLLOW | a void seat's card creates trump; trick never interrupts; still to waste |
| Trump led | FOLLOW | must play trump if able; otherwise any non-trump card interrupts |
| Loser label | HAND_END | "donkey with x legs", x = cards held |

 **Information:** Trump suit is public once set.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| KZ-01 | Kasaragod Donkey | emergent trump from first void; trumps never interrupt | G-10 | PROFILE `kazhutha.kasaragod` |
| KZ-02 | Kazhutha (app) | identical to Getaway; "vettu"; 4–6 seats | G-10 | PRESET of getaway |
| KZ-03 | Donkey leg count | loser described by cards held | needs KZ-01 | presentation |

*Sources:* S1, S8

---

## 1.3 Callbreak — `callbreak.np@1`

Status: **FROZEN_WITH_GAPS**.

```yaml
id: callbreak.np@1
family: trick
seats: { min: 4, max: 4, teams: none }
direction: counter_clockwise   # (clockwise = variant CB-06)
deck: { base: std52 }
orders: { trick: natural_A_high }
trump: { mode: fixed, suit: spades }
deal:
  first_dealer: random   # DESIGN (card draw)
  schedule: 13_each_one_at_a_time_from_dealer_next
  dealer_rotation: counter_clockwise   # S11 says clockwise → variant CB-07
  redeal:
    on_request: player whose hand has no spades OR no A/K/Q/J may show hand and demand redeal; same dealer
    bid_sum_below_8: off   # variant CB-03 ; prevalence UNRESOLVED(G-15)
windows: [ W-CB-1 redeal_request (after deal, before calls; eligibility: hidden) ]
call:
  order: from_dealer_next_in_direction, each_once
  range: 1..13, no_pass
play:
  first_lead: dealer_next_in_direction
  lead_restrictions: none   # (no-spade first lead = variant CB-05, L)
  obligations:
    - must_follow_suit
    - must_beat_current_winning_card_if_able   # compared with the CURRENT winner (a trump
                                                     #   already in the trick makes the obligation void for led-suit cards)
    - if_void: must_play_spade_if_it_would_become_winner, else any_card
  obligation_default_by_region: UNRESOLVED(G-12)   # players dispute forced play (S51); relaxed rules = variant CB-01
  losing_trump_when_void: UNRESOLVED(G-13)   # S11: any card; some apps may force a trump
scoring:
  unit: tenths_of_a_point (integer)   # DESIGN (EC-01)
  made: +10*call + 1*overtricks   # (+call, +0.1 per overtrick)
  failed: -10*call
match:
  rounds: 5
  winner: highest_total
  tie: UNRESOLVED(G-14)
visibility: { hands: private, tricks: public, calls: public }
randomness: [ R-CB-1 shuffle ]
variants: [CB-01 … CB-12, CBB-01]
```

### 3.1 Call Bridge — `callbridge.bd@1`

```yaml
id: callbridge.bd@1
extends: callbreak.np@1
call: { range: 2..12, no_pass }
play:
  obligations: [ must_follow_suit, if_void: must_play_spade_if_it_would_become_winner ]   # (no must-beat)
scoring:
  made_if: tricks in {call, call+1}
  made: +10*call ; made and call>=bonus_call(8): +130 INSTEAD of +10*call   # flat 13 points, replaces the call (owner decision 24 Sep 2026; engine: callbreak.ts)
  failed (fewer, or call+2 or more): -10*call
match: OWNER   # "set amount of time"
```

**Hand machine**

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL | SM-DEAL | AUTO | — | → REDEAL_WINDOW |
| REDEAL | W-CB-1 | WINDOW(all eligible: no ♠ or no A/K/Q/J) | `RequestRedeal` (reveals hand to all) / Decline | any request → HAND_ANNULLED(same dealer); else → CALL |
| CALL | A0..A3 | TURN in direction from dealer-next | `Call(n)`, n ∈ 1..13 (Bridge 2..12) | 4 calls → (bid-sum<8 variant: annul) → PLAY |
| PLAY | SM-TRICK ×13 | TURN | follow predicates: must follow; must beat current winner if able; if void, must play ♠ if it would become winner, else any | 13 tricks → SCORE |
| SCORE | AUTO | — | integer tenths per §1.3 | HAND_END |

Terminal: after round 5 → MATCH_OVER (tie G-14). Edge: all four fail (legal); a trump in the trick voids the led-suit must-beat obligation (§1.3); redeal loop cap (G-15). **Information:** RequestRedeal intentionally reveals the requester's hand, per rule.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| CB-01 | Relaxed play | no must-beat; no forced trump | conflicts with canonical obligations | TOGGLE; candidate regional default (G-12) |
| CB-02 | Forced trump even when losing | void seat must play a spade even if it cannot win | G-13 | DEFER |
| CB-03 | Bid-sum < 8 → redeal | annul | redeal cap (G-15) | TOGGLE |
| CB-04 | Redeal on request off | disable W-CB-1 | — | TOGGLE |
| CB-05 | First lead not a spade | lead restriction trick 1 | — | TOGGLE |
| CB-06 | Clockwise play | direction | CB-07 | PRESET "Lakdi (India)" |
| CB-07 | Dealer rotates clockwise with CCW play | rotation direction | — | TOGGLE |
| CB-08 | Failure −(call − tricks) | penalty size | — | TOGGLE |
| CB-09 | Blind bid | calls made without seeing others' calls (sealed simultaneous) | needs simultaneous sealed window (P-07) | TOGGLE |
| CB-10 | Super 8 bid | undefined | — | DEFER |
| CB-11 | Round count 3/5/10/25/50/100 | match length | OWNER | TOGGLE |
| CBB-01 | Call Bridge | calls 2–12; score if exact or +1; a made call ≥8 scores a flat 13 instead of the call; no must-beat | — | PROFILE `callbridge.bd` |

*Rejected (not implemented):* CB-12 (Deal constraint "max 3 suits per hand")

*Sources:* S11, S12, S13, S15, S16, S51

---

## 1.4 Court Piece / Rang — `rang.single@1`

Status: **FROZEN_WITH_GAPS**.

```yaml
id: rang.single@1
family: trick
seats: { min: 4, max: 4, teams: fixed_pairs_opposite }
direction: counter_clockwise
deck: { base: std52 }
trump:
  mode: announced_by_trump_caller
  trump_caller: dealer_next_in_direction
  decision_on: first 5 cards
  activation: immediate
deal:
  first_dealer: random
  schedule: [5 each] -> TRUMP_ANNOUNCE -> [4 each] -> [4 each]   # other batch patterns = variant CP-01 (S19)
  dealer_team: team that lost previous deal
  dealer_rotation:
    dealer_team_won: next_seat_in_direction
    caller_team_won_no_court: same_dealer
    caller_team_scored_court: dealer_partner
play:
  first_lead: trump_caller
  obligations: [ must_follow_suit ]   # void → any card
  round: { unit: card, winner: highest_trump_else_led, collect: immediate_to_team_pile }
  early_end: team_reaches_7_tricks   # "normally the play is ended"
  continue_for_52_court: permitted when a team has taken the first 7 tricks
    decision_owner: UNRESOLVED(G-16)
hand_result:
  deal_winner: team with >= 7 tricks
  court_single_deal: team took the first 7 tricks
  goon_court: court_single_deal by dealer's team   # (value: 1 court by default; see variants)
  bavney_52_court: all 13 tricks, counts 52 courts
match_state:
  streak[team]: consecutive deal wins; 7 → court
  reset: streak := 0 whenever any court is scored
match: OWNER   # "agreed length of time"
revoke_rules: unreachable (engine prevents illegal play)   # DESIGN
visibility: { hands: private, tricks: public, trump: public }
randomness: [ R-CP-1 shuffle ]
variants: [CP-01 … CP-18]
```

### 4.1 Hidden trump (face-down rang) — `rang.hidden_trump@1` (variant CP-02 as a profile)

```yaml
extends: rang.single@1
trump:
  mode: hidden_card   # trump caller sets a card of the trump suit face down
  reveal_on: [ AskTrump by a player unable to follow, trump caller's own reveal when void or on lead ]
  after_ask: asker must play a trump if able
  caller_self_reveal: must then play a trump
  activation: card_level   # : trump-suit cards played before the reveal are not trumps
                                                     #   unless the trump suit was the led suit
  indicator_card: returned to caller's hand on reveal
```

### 4.2 Double Sar — `rang.double_sar@1`

```yaml
extends: rang.single@1
play:
  round.collect: consecutive_same_player   # : tricks pile in the centre; collected when the SAME
                                                     #   player wins two tricks in a row; partner's win does not count
  after_collection: next trick starts a new centre pile
  last_trick: winner collects all remaining centre tricks
  early_end: none   # derived: trick counts are only known after collection
hand_result:
  deal_winner: team with >= 7 collected tricks
  court_single_deal: all 13 tricks
  goon_court: dealer's team takes all 13 = 3 courts   # (10 = variant CP-10)
variants_specific: [CP-08 blocked pickups 1–2 and 11–12, CP-09 no pickup on two consecutive aces, CP-11 Ace Rule (UNRESOLVED G-18)]
```

### 4.3 Hidden Rung (Double Sar) — `rang.hidden_rung@1`

```yaml
extends: rang.double_sar@1
trump: { inherits: rang.hidden_trump@1.trump }
trump_caller_void_options: [ reveal_and_play_trump, play_non_trump_face_down ]
face_down_play:
  allowed_suits: UNRESOLVED(G-17)   # S18 says "a card of another suit"
  identity_reveal: UNRESOLVED(G-17)   # never / end of hand
  post_hand: UNRESOLVED(G-17)   # conceal | reveal_all — both supported by P-05; conceal is presentation-only once seeds are revealed
  can_win: false   # derived: not led suit, not an active trump
collection:
  requires: two consecutive wins by same player, and the previous trick's winning card played after the reveal
  no_claim_after_tricks: [1, 2, 12]
  last_trick: winner collects all
  unrevealed_at_callers_13th_play: caller must reveal and play it
```

### 4.4 Be-ranga Double Sar — `rang.beranga@1`

```yaml
extends: rang.double_sar@1
deal: { schedule: 13 each, no trump caller }
first_lead: UNRESOLVED(G-21) provisional dealer_next_in_direction
trump: { mode: emergent_first_void, activation: UNRESOLVED(G-21) }   # likely immediate (same trick); not stated
collection: no claim until the trick AFTER the trump-determining trick (same player winning both collects all)
```

**Hand machine**

### 4.1 `rang.single@1`

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL-1 | SM-DEAL | AUTO | 5 each | → TRUMP |
| TRUMP | TURN(trump caller) | TURN | `AnnounceTrump(suit)` | → DEAL-2 (4, 4) → PLAY |
| PLAY | SM-TRICK | TURN | must follow; void any | after each trick: team reaches 7 → CHECK |
| CHECK | AUTO | — | if a team took the first 7 tricks → COURT_CHASE_WINDOW; else HAND_END | |
| COURT_CHASE | WINDOW(team members of court team; decider G-16) | `Continue` / `Stop` | Continue → PLAY until a trick is lost (then HAND_END as court) or 13 won (bavney) | |
| HAND_END | AUTO | — | deal winner, court type, streak update, dealer rotation (§1.4) | |

Terminal hand results: `deal_win(team)`, `court(team, kind∈{first7, goon, bavney, streak7})`. **Information:** Unplayed cards after early end stay private; end-of-deal reveal is variant CP-14.

### 4.2 Hidden trump / Hidden Rung / Double Sar / Be-ranga deltas

| Profile | Added state | Transition rules |
|---|---|---|
| hidden_trump | `trump_state ∈ {HIDDEN(card), REVEALED(suit, at_play_seq)}` | `AskTrump` legal only for a void follower before playing; reveal → asker must trump if able; caller `RevealTrump` legal when void or on lead, then must play trump. Card-level activation: a card is a trump iff `suit = trump ∧ play_seq > reveal_seq`, or trump suit was led. |
| double_sar | `centre_pile`, `last_trick_winner_seat` | T2 RESOLVE → collection: if winner seat = previous winner seat → move centre + trick to team pile, `last_trick_winner_seat := none` (next trick starts new pile); else trick → centre, record winner. Trick 13 winner collects all. No early end. |
| double_sar + CP-08 | `blocked_claim_indices = {2, 12}`: a claim that would happen at the end of trick 2 (first two tricks) or trick 12 (tricks 11–12) is forbidden | claim skipped when index blocked; trick 13 still collects all |
| hidden_rung | as hidden_trump + face-down play option for caller | caller void: `RevealAndPlayTrump` or `PlayFaceDown(card)` (allowed suits G-17); claim requires previous winning card `play_seq > reveal_seq`; no claims after tricks 1, 2, 12; caller forced reveal on their 13th play if still hidden |
| beranga | `trump_state = NONE → SET(suit)` by first void card | claims forbidden until the trick after the setting trick (if same player wins both, collect all) |

 **Information:** Face-down card identity policy (G-17) must be fixed; until then the card is projected as an opaque handle to all but the caller and revealed to nobody.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| CP-01 | Batch patterns 5-4-2-2, 5-3-3-2 | dealing batches after the first 5 | outcome-irrelevant under a uniform shuffle (only the first-5 timing matters) | REJECT (cosmetic) |
| CP-02 | Hidden trump card | trump set face down; ask to reveal; asker must trump; card-level activation | — | PROFILE `rang.hidden_trump` |
| CP-03 | Trump from second batch | caller declines → random card from caller's second batch sets trump | — | TOGGLE |
| CP-04 | Blind trump from first five | card chosen unseen from caller's first five | with CP-02 even caller is uninformed | TOGGLE |
| CP-05 | Redeal if caller's first five all below J | annul | — | TOGGLE |
| CP-06 | Points game | caller team 1 (7+) / 3 (court), opponents 2 / 4; to target (e.g. 10) | — | PRESET |
| CP-07 | Double Sar | consecutive-same-player collection | disables early end | PROFILE `rang.double_sar` |
| CP-08 | Blocked claims (end of tricks 2 and 12) | see §1.4 hand machine | requires CP-07 | TOGGLE |
| CP-09 | No claim on two consecutive aces | claim forbidden when both winning cards are aces | requires CP-07; overlaps CP-11 | TOGGLE |
| CP-10 | Goon court = 10 courts | value | requires CP-07 | TOGGLE |
| CP-11 | Ace Rule (app) | second consecutive ace-win "does not count", next-highest leads | G-18; conflicts CP-09 semantics | DEFER |
| CP-12 | Be-ranga | emergent trump; delayed claims | requires CP-07; G-21 | PROFILE `rang.beranga` |
| CP-13 | Hidden Rung | CP-02 inside Double Sar with post-reveal claim rules | requires CP-07; G-17 | PROFILE `rang.hidden_rung` |
| CP-14 | Reveal hands at deal end | UX | — | TOGGLE |
| CP-15 | First to 100 | undefined scoring base | — | DEFER |
| CP-16 | Trump challenge | opponent may change trump, then must make seven in a row | G-22 | DEFER |
| CP-17 | Band Rung / Band Turph | undefined | G-19 | DEFER |
| CP-18 | Chooser names the 7th/10th card | Double Sar trump fallback | requires CP-07 | TOGGLE |

*Sources:* S18, S19, S20, S21, S49, S51

---

## 1.5 Twenty-Nine — `twentynine.pagat@1`

Status: **FROZEN_WITH_GAPS** (auction pass rule G-23 is ship-blocking).

```yaml
id: twentynine.pagat@1
family: trick
seats: { min: 4, max: 4, teams: fixed_pairs_opposite }
direction: clockwise   # (counter-clockwise = variant 29-02)
deck: { base: std52, ranks: [J,9,A,10,K,Q,8,7], suits: 4 }
orders: { trick: [J,9,A,10,K,Q,8,7] }
values: { J: 3, 9: 2, A: 1, 10: 1, other: 0, last_trick: 0 }   # (last-trick point = variant 29-03)
deal:
  schedule: [4 each] -> AUCTION -> TRUMP_SELECT -> DOUBLING_WINDOW -> [4 each]
  dealer_rotation: next_seat_in_direction   # DESIGN (S22 silent)  → UNRESOLVED(G-25) regional
auction:
  opener: dealer_next_in_direction
  bids: integer 15..28, strictly higher   # (min 16 = variant 29-01)
  end: three consecutive passes after a bid
  all_pass: dealer forced to bid 15
  pass_is_final: UNRESOLVED(G-23)   # ship-blocking for the auction engine
trump:
  mode: hidden_indicator   # : bidder places an indicator of the chosen suit face down
  indicator_owner_view: bidder only
  reveal_on:
    - first player unable to follow MUST ask; bidder shows the indicator
    - if the bidder is that first player, bidder declares trump at that point
  after_ask_obligation: none (void player may play any card)   # (variant 29-06 optional-ask)
  activation: trick_inclusive   # : from the trick in which trump is declared, highest trump wins
bidder_first_lead_restriction: off   # variant 29-12, UNRESOLVED(G-24)
play:
  first_lead: dealer_next_in_direction
  obligations: [ must_follow_suit ]
  round: { unit: card, winner: per activation, collect: team_pile }
declarations:
  pair:
    requires: trump revealed; K and Q of trump both in declarer's hand
    window: immediately after declarer's side wins a trick (the reveal trick or later)
    effect: bidder side -> target -= 4 (floor 15) ; defenders -> target += 4 (cap 28)
doubling: off   # variants 29-08 (double/redouble/set)
annulment:
  trump_never_revealed: annul (no score)   # (reachable in optional-ask variant; with mandatory ask
                                                     #   only when nobody is ever void)
scoring:
  success (bid side card points >= target): bid side +1
  failure: bid side -1 ; defenders unchanged
match: { end: a team reaches +6 (wins) or -6 (loses) }
visibility:
  indicator: bidder only until reveal; then public
  hands: private ; tricks: public
randomness: [ R-29-1 shuffle ]
variants: [29-01 … 29-23]
```

**Hand machine**

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL-1 | SM-DEAL | AUTO | 4 each | → AUCTION |
| AUCTION | SM-AUCTION | TURN from dealer-next | `Bid(15..28 > current)`, `Pass` (re-entry after pass: G-23) | 3 consecutive passes after a bid → CONTRACT; first 3 pass → dealer `Bid(15)` forced (system action) |
| CONTRACT | TURN(bidder) | TURN | `SetIndicator(suit)` (hidden) · variants: `SeventhCard`, `NoTrump`, `Reverse` | → DOUBLING (variant) → DEAL-2 |
| DOUBLING (29-08) | windows | WINDOW(defenders) → WINDOW(bidder side) → WINDOW(defenders) | `Double` / `Redouble` / `Set` / Decline | → DEAL-2 |
| DEAL-2 | AUTO | — | 4 each; BD annulment predicates (variant) | → PLAY |
| PLAY | SM-TRICK ×8 | TURN | must follow; void seat: if trump hidden and seat is the first void → **must** `AskTrump` before playing (bidder: `DeclareTrump`); then any card | reveal logs `trump_revealed_in_trick = k` |
| POST-TRICK | T3 POST | WINDOW(seats holding K+Q of revealed trump whose side just won; eligibility: hidden — fixed duration, P-16) | `DeclarePair` / Decline | adjusts target → next trick |
| SCORE | AUTO | — | trump never revealed → HAND_ANNULLED; else success/failure ±1 (× multipliers) | HAND_END |

Winner function: `trump_active(card) = trump_revealed ∧ trick_index ≥ reveal_trick` (**trick-inclusive**). Seventh-card variant: the card sits in bidder-owned `set_aside` zone; excluded from follow-suit evaluation until reveal; cannot be led except on the last trick; if its suit is led before reveal the bidder must follow from hand if possible, else may reveal and follow with it (EC-10).

Terminals: team at +6 → wins match; team at −6 → loses match. **Information:** Indicator never projected to non-bidders (including the bidder's partner); annulment reasons disclosed only after annulment; Pair window eligibility is computed server-side and the prompt is shown only to the eligible seat (otherwise its appearance would leak K+Q possession).

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| 29-01 | Minimum bid 16 (apps 14–17) | floor | Pair floor follows | PRESET |
| 29-02 | Counter-clockwise | dealer-right bids/leads | — | PRESET |
| 29-03 | Last-trick point | 29 total; max bid 29 | caps shift | TOGGLE |
| 29-04 | Dealer leads / bids first | first actor | — | TOGGLE |
| 29-05 | No-trump (joker indicator) | no trumps; no Pair | conflicts Pair | TOGGLE |
| 29-06 | Optional ask; asker must trump | changes void obligations; annulment reachable | — | TOGGLE |
| 29-07 | Reverse / reverse-trump | 2 indicator reverses ranking from the reveal trick | needs indicator set 2–5 | PRESET "Kolkata"/"Lucknow" |
| 29-08 | Double / redouble / set | ×2 / ×4 / 6 points | window order (§1.5 hand machine) | TOGGLE |
| 29-09 | Auto-double at bid ≥ 21 | bid value 2; double → 4 max | needs 29-08 | PRESET "Gorakhpur" |
| 29-10 | Seventh card trump | bidder's 7th card fixes trump | EC-10 rules | TOGGLE |
| 29-11 | Seventh-card annulment | annul if bidder holds no other point card of that suit | needs 29-10 | PRESET "Bangladesh" |
| 29-12 | Bidder may not open with trump | lead restriction before reveal | G-24 | TOGGLE |
| 29-13 | Single hand | lone, no trump, 8 tricks, ±3 (±6 West Bengal) | "certain-win hand forbidden" sub-rule needs a solver | TOGGLE (sub-rule DEFER) |
| 29-14 | Tenny | lone 4-card contract ±4; partner exposed | Lucknow preset | PRESET |
| 29-15 | Ditto bids | equal bid allowed once | — | PRESET |
| 29-16 | Bangladesh duel auction | first two duel; partners take over | replaces SM-AUCTION order | PRESET "Bangladesh" |
| 29-17 | Bangladesh annulments | zero-point first-four; dealer cannot bid; defenders lack trumps | — | PRESET "Bangladesh" |
| 29-18 | Marriage only if bid > 18, no trick needed | Pair rule | — | PRESET "Bangladesh" |
| 29-19 | Pair only after trumping a non-trump trick | Pair timing | — | PRESET "Lucknow" |
| 29-20 | Extended pips (6+5+4+3+2 = 20) | match length | — | PRESET "Lucknow" |
| 29-21 | Guess the first trump | no ask; reveal at trick end | — | TOGGLE |
| 29-22 | Under half doubles loss | penalty | — | PRESET "Kolkata" |
| 29-23 | One bid each | single-round auction | conflicts 29-16 | TOGGLE |

*Sources:* S22, S23, S25, S51

---

## 1.6 Mindi family

### 6.1 Mendikot — `mendikot.pagat@1`

Status: **FROZEN_WITH_GAPS** (trump-method default G-26 is ship-blocking).

```yaml
id: mendikot.pagat@1
family: trick
seats: { min: 4, max: 4, teams: fixed_pairs_opposite }   # (6/8 = variant MI-05)
direction: counter_clockwise
deck: { base: std52 }
deal:
  first_dealer: card_draw -> random   # DESIGN
  schedule: [5 each] -> [4 each] -> [4 each]
  dealer_rotation:
    dealer_team_lost: same dealer, unless whitewashed (13 tricks) -> dealer's partner
    dealer_team_won: next_seat_in_direction (right)
trump:
  method: UNRESOLVED(G-26)   # lists, without a default:
    # A random_displayed: dealer-right draws a random card from the shuffled pack before the deal; its suit is trump
    # B band_hukum_a: dealer-right sets a hand card face down; revealed automatically when anyone cannot follow;
    #                 no obligation to trump; revealed card returns to owner's hand
    # C band_hukum_b: as B, but reveal only on request by a void player, who must then trump if able;
    #                 activation card_level (trumps played before the reveal do not count, even in that trick)
    # D cut_hukum: no trump until first void; that card's suit becomes trump
play:
  first_lead: dealer_next_in_direction
  obligations: [ must_follow_suit ]
  round: { collect: immediate_to_team_pile }
hand_result:
  winner: team with 3 or 4 tens ; 2–2 → team with >= 7 tricks
  mendikot: all four tens ; whitewash: all 13 tricks (52-card mendikot)
scoring: none formal
match: OWNER
randomness: [ R-MI-1 shuffle, R-MI-2 random_displayed_trump (method A) ]
```

### 6.2 Dehla Pakad — `dehlapakad.pagat@1`

Status: **FROZEN_WITH_GAPS** (method default G-26).

```yaml
id: dehlapakad.pagat@1
family: trick
seats: { min: 4, max: 4, teams: fixed_pairs_opposite }
direction: counter_clockwise
deck: { base: std52 }
deal:
  schedule: [5 each] -> TRUMP (method) -> [4 each] -> [4 each]
trump:
  method: UNRESOLVED(G-26)   # "players must agree":
    # M1 (play-first): play begins with 5 cards, no trump, dealer-right leads; the suit of the first card played
    #    by a player unable to follow becomes trump (that trick may be won by that card or a higher later trump);
    #    at the END of that trick the dealer deals the remaining 8 each; if all 5 tricks are followed,
    #    a random card from the played tricks fixes trump, then the deal completes
    # M2 (announced): dealer-right announces trump after 5 cards; deal completes; trump maker leads
play:
  first_lead: dealer_next_in_direction   # (M1); trump maker = same seat (M2)
  obligations: [ must_follow_suit ]
  round.collect: consecutive_same_player; last trick collects all
hand_result:
  all_four_tens: kot for that team
  non_dealer_team_2_or_3_tens: non-dealer team wins hand
  dealer_team_3_tens: dealer team wins hand
match_state:
  streak: 7 consecutive hand wins by a team → kot ; streak reset when a four-ten kot is won
dealer_rotation:
  kot_by_dealing_team: next seat (right) ; kot_by_non_dealing: dealer's partner
  non_dealer_wins_hand: same dealer ; dealer_team_wins_hand: next seat (right)
match: OWNER (time or target kots)
randomness: [ R-DP-1 shuffle, R-DP-2 fallback_trump_from_played_tricks (M1) ]
```

**Hand machine**

### 6.1 `mendikot.pagat@1`

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| TRUMP (method A) | AUTO | — | R-MI-2 random card displayed, returned, reshuffled into deal | → DEAL |
| DEAL | SM-DEAL | AUTO | 5, 4, 4 | method B/C: → BAND_HUKUM; D: → PLAY |
| BAND_HUKUM | TURN(dealer-next) | TURN | `SetAside(card)` (hidden) | → PLAY |
| PLAY | SM-TRICK ×13 | TURN | must follow; B: first seat unable to follow triggers AUTO reveal (card returns to owner's hand), no trump obligation; C: void seat may `AskTrump` before playing, then must trump if able; card-level activation; D: first void card sets trump (activation: G-28 for Mendikot, immediate provisional) | → SCORE |
| SCORE | AUTO | — | tens count; 2–2 → trick count ≥ 7; mendikot/whitewash | HAND_END |

Edge: in method B/C the set-aside card is not playable until returned (it is on the table). **Information:** Set-aside card projected as opaque to others.

### 6.2 `dehlapakad.pagat@1`

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL-1 | SM-DEAL | AUTO | 5 each; stock of 32 held back | M1 → PLAY-5; M2 → ANNOUNCE |
| ANNOUNCE (M2) | TURN(dealer-next) | TURN | `AnnounceTrump(suit)` (public) | → DEAL-2 → PLAY-13 (maker leads) |
| PLAY-5 (M1) | SM-TRICK | TURN | must follow; no trump; first void card sets trump (active immediately, may win) | end of the trump-setting trick → DEAL-2 (4, 4) → PLAY-REST; after 5 tricks with no void → R-DP-2 random card from played tricks sets trump → DEAL-2 |
| PLAY-REST | SM-TRICK | TURN | must follow; collection consecutive-same-player; trick 13 collects all | → SCORE |
| SCORE | AUTO | — | tens → hand winner/kot per §1.6; streak | HAND_END |

Key engine requirement: **deal completion triggered by a play event** (P-08 trigger). Trick counts carry across PLAY-5 and PLAY-REST (13 total).

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| MI-01 | Mendikot vs Dehla Pakad | collection rule, 2–2 rule, dealer rules | — | two PROFILES |
| MI-02 | Mendikot trump A/B/C/D | random display / band hukum a / band hukum b / cut hukum | session-level; G-26 default | TOGGLE (per session) |
| MI-03 | Dehla Pakad M1/M2 | play-first / announced | G-26 default | TOGGLE (per session) |
| MI-04 | App "Hide" / "Katte" modes | map to band hukum (a or b unclear) / cut hukum | — | mapped, not new |
| MI-05 | 6 or 8 players (2s removed) | alternate seating | Mendikot only | DEFER |
| MI-06 | 2–4 decks | 8+ tens; thresholds | G-27 | DEFER |
| MI-07 | Clockwise | direction | — | TOGGLE |
| MI-08 | Redeal if no face card or ace | annul | — | DEFER |
| MI-09 | Dehla 2–2 decided by tricks (app) | replaces "non-dealer wins" | conflicts Pagat | TOGGLE |

*Sources:* S26*, S27*, S28, S51

---

## 1.7 2-3-5 (Teen Do Paanch) — `teendopaanch.pagat@1`

Status: **FROZEN** (all rules sourced to one page; regional defaults validated by future play-testing only).

```yaml
id: teendopaanch.pagat@1
family: trick
seats: { min: 3, max: 3, teams: none }
direction: counter_clockwise   # (clockwise = variant TDP-01)
deck: { ranks: [A,K,Q,J,10,9,8] x 4 suits + 7H + 7S }   # 30 cards
orders: { trick: natural_A_high }
roles: { dealer: quota 2, dealer_right: quota 5 (trump maker, leads), dealer_left: quota 3 }
deal:
  first_dealer: random (Pagat suggests drawing 2/3/5 cards)   # DESIGN
  schedule: [5 each: right, left, dealer] -> TRUMP_ANNOUNCE -> [3 each] -> [2 each]
  dealer_rotation: next_seat_to_the_right
trump: { mode: announced_by_role(dealer_right), activation: immediate }
pull_phase:   # from the 2nd deal of a session, after the full deal
  entitlement: over-quota player steals 1 card per trick above quota; under-quota player surrenders 1 per trick below
  order: over-quota stealers in order dealer_right, dealer_left, dealer;
         each steals from under-quota victims in order dealer, dealer_left, dealer_right
  one_steal:
    1. victim may rearrange, then offers hand face down
    2. stealer picks one card unseen (by position)
    3. stealer returns one card face down; must not be the card just taken;
       returned card's suit must leave the stealer >= 2 cards of that suit   # (>=1 = variant TDP-06)
  skip_if: first deal, or everyone met quota exactly
play:
  first_lead: dealer_right
  obligations: [ must_follow_suit ]; no obligation to beat
scoring: { per_trick: +1 }
carry_over: over/under-quota debts → next deal's pull phase
match: OWNER
visibility:
  stolen_card: stealer and victim only ; returned_card: stealer and victim only ; third player: counts only
randomness: [ R-TDP-1 shuffle, R-TDP-2 victim_auto_shuffle (DESIGN default when victim does not rearrange) ]
variants: [TDP-01 … TDP-12]
```

**Hand machine**

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL-1 | SM-DEAL | AUTO | 5 each (right, left, dealer) | → TRUMP |
| TRUMP | TURN(dealer-right) | TURN | `AnnounceTrump(suit)` | → DEAL-2 (3 each, then 2 each) |
| PULL (deal ≥ 2, if debts) | STEAL steps in §1.7 order | TURN(victim), then TURN(stealer) twice | victim `ArrangeHidden(permutation)` or default R-TDP-2; stealer `PickIndex(i)`; stealer `Return(card)` (≠ taken card; stealer keeps ≥ 2 of returned suit) | → PLAY after all debts settled |
| PLAY | SM-TRICK ×10 | TURN | must follow; void any | → SCORE |
| SCORE | AUTO | — | +1 per trick; compute next deal's debts (over/under quota) | HAND_END |

Edge: two creditors/one debtor and one creditor/two debtors follow the sourced order; a player cannot be both creditor and debtor in one deal. Permanent-sevens variant changes follow predicates (sevens count as trump suit). **Information:** Taken and returned card identities projected only to stealer and victim; the third player sees counts only.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| TDP-01 | Clockwise | 5-trick role = dealer-left | — | PRESET |
| TDP-02 | Seventh card trump | middle card of the 3-card batch turned up | — | TOGGLE |
| TDP-03 | Highest card of next 3 sets trump | fallback trump | — | TOGGLE |
| TDP-04 | Random card from remainder of maker's hand | fallback trump | RNG draw | TOGGLE |
| TDP-05 | Permanent sevens | 7♥ > 7♠ > trump A…; sevens follow as trumps | — | TOGGLE |
| TDP-06 | Retain ≥ 1 of returned suit | return constraint | — | TOGGLE |
| TDP-07 | 10-trick bonus +5 | scoring | — | TOGGLE |
| TDP-08 | Transfer a trick instead of being pulled | debtor option | — | TOGGLE |
| TDP-09 | Loser deals next | rotation | tie between losers "presumably" next in rotation | TOGGLE |
| TDP-10 | Net-vs-quota scoring | tricks − quota | — | TOGGLE |
| TDP-11 | Annul if a player holds no trump | redeal | — | TOGGLE |

*Rejected (not implemented):* TDP-12 (Special sevens "last played wins ties")

*Sources:* S29*, S31, S51

---

## 1.8 Seep — `seep.north100@1`

Status: **FROZEN_WITH_GAPS** (capture/auto-cement set choice G-30; ≥9 test scope G-31).

```yaml
id: seep.north100@1
family: capture
seats: { min: 4, max: 4, teams: fixed_pairs_opposite }   # (2-player = variant SP-06)
direction: counter_clockwise
deck: { base: std52 }
values:
  capture: { A: 1, 2..10: face, J: 11, Q: 12, K: 13 }
  points: { all spades: capture value, other aces: 1, 10D: 6 }   # = 100
deal:
  step1: 4 cards to dealer_right (bidder); 4 cards face down to floor
  bid: bidder names v in 9..13 matching a card in hand; if no card above 8 → show, redeal (same dealer)
  floor_reveal: after bid
  bid_play: bidder must (a) build a house of value v (played card may be any), or (b) capture with a card of value v,
            or (c) throw a card of value v
  step2: remaining 44 dealt in 4s counter-clockwise (bidder ends with 11, others 12)
  dealer_rotation: see match_state
turn: play exactly one card as one of { Build, Cement/Add, Break, Capture, Throw }
rules:   # all
  house_values: 9..13 ; one house per value on the floor
  build: played card + loose cards sum to v; builder keeps >=1 card of value v in hand; only for oneself
  break: uncemented house not owned by the breaker; add ONE hand card; new value v' in 9..13; breaker holds v';
         never with a floor card; breaker becomes owner
  cement: (1) add a hand card equal to the house value; (2) hand card + loose cards summing to the value;
          (3) break another house into this value and merge; loose cards/sets equal to the value may be added
  ownership: builder/breaker owns; cementing an opponent's house (without breaking) → co-owner;
             adding to a house partner owns → no ownership
  invariant: every owner holds >= 1 card equal to each owned house's value until it is captured   (global, every move)
  cemented: cannot be broken
  auto_merge: creating/breaking to value v with a house of v present → cemented merge;
              loose single/sets equal to v present → auto-added (cemented)
  capture: played card of value c takes ALL matching items (single loose c, disjoint loose sets summing to c,
           the house of value c as a unit); sets must not overlap
  capture_choice_when_alternatives: player chooses among inclusion-maximal disjoint selections   # example
                                                                                                  #   formal rule UNRESOLVED(G-30)
  auto_merge_choice_when_alternatives: UNRESOLVED(G-30)
  throw: legal only if the card captures nothing and is not equal to an existing house value
  inspection: captured cards viewable until the next player plays   # → UX window, not state
sweeps: { normal: 50, bidder_first_play: 25, last_play_of_deal: 0 }
end_of_deal: remaining loose cards go to the team that captured last
scoring:
  deal_difference: accumulate (team A points+sweeps) - (team B points+sweeps)
  min_9_rule: team scoring < 9 → instant baazi loss, reset   # whether sweeps count toward the 9: UNRESOLVED(G-31)
  baazi: cumulative lead >= 100 → baazi, reset
match_state:
  dealer: losing team deals; if the dealing team is behind or level → same dealer; if it now leads → next right;
          after a baazi → partner of the would-be dealer
match: OWNER (number of baazis)   # "decide in advance"
visibility: { floor: public incl. house contents, initial floor: hidden until bid, captured piles: counts public }
randomness: [ R-SP-1 shuffle ]
```

### 8.1 Punjabi 30-point Seep — `seep.punjab30@1`

```yaml
extends: seep.north100@1
values.points: { 10D: 12, 9S: 9, 2S: 1, each ace: 1, card_majority: 4 }   # = 30
deal.floor_check: if 10D or 9S among the 4 floor cards → take back, reshuffle, restart deal   # (server-side check)
sweeps: { any: capture value of the sweeping card, bidder_first_play: same }
scoring:
  min_9_rule: off
  baazi_lead: 30 (agreed target)
  satthi: team takes all 30 card points → worth 60
randomness: [ R-SP-1 shuffle, R-SP-2 floor_check_reshuffle ]
```

**Hand machine**

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL-1 | AUTO | — | 4 to bidder, 4 face-down floor (30-pt: server floor check → reshuffle, R-SP-2) | → BID |
| BID | TURN(bidder) | TURN | `Bid(v)` v ∈ 9..13 held; if none → system `ShowAndRedeal` | → REVEAL_FLOOR (AUTO) → BID_PLAY |
| BID_PLAY | TURN(bidder) | TURN | `Build(house=v, card, loose_set)` \| `Capture(card of value v, targets)` \| `Throw(card of value v)` | → DEAL-2 (44 in 4s) → TURN_LOOP |
| TURN_LOOP | TURN(next, direction) | TURN | one of `Build`, `Cement`, `Break`, `Capture`, `Throw` validated by plugin SeepHouses: local legality + **global invariant** (every owner keeps a matching card) + maximal-capture rule | sweep detection AUTO; after 48 cards → END_DEAL |
| END_DEAL | AUTO | — | loose remainder → last capturing team; count points + sweeps; 9-point test; difference; baazi check | HAND_END |

Edge cases (engine-checked): EC-17 forced capture exposing a sweep; EC-18 co-ownership; EC-19 invariant blocks moves that orphan a house; EC-20 two loose equals at start; EC-21 <9 instant baazi; sweep on first bid play = 25; sweep on the last play = 0; throw illegal if equal to an existing house value or if it captures anything. **Information:** Floor and house contents are public; initial floor hidden only until the bid; floor-check reshuffle leaks nothing because the deal restarts.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| SP-01 | 30-point Seep | values, floor check, sweep = card value, target 30, Satthi | — | PROFILE `seep.punjab30` |
| SP-02 | Rawalpindi rules | 2♠ = 5, no majority bonus, 10♦/9♠ first-house restrictions | requires SP-01 | PRESET "Rawalpindi" |
| SP-03 | Max two houses | third house illegal | — | TOGGLE |
| SP-04 | 10♦ = 2, majority +4, first sweep 50 | scoring | 100-point only | TOGGLE |
| SP-05 | Break with a floor card if cemented in the same move | extra break form | — | DEFER |
| SP-06 | Two players | second hands after 12 plays | — | DEFER (PROFILE) |
| SP-07 | Baazi target 50/100 or fixed rounds | match end | OWNER | TOGGLE |
| SP-08 | Sweep cap (two in "fixed house" games) | undefined term | — | DEFER |
| SP-09 | Hide captured totals | UX | — | TOGGLE |
| SP-11 | No sweep while a player is empty-handed | sweep legality | overlaps last-play rule | DEFER |

*Rejected (not implemented):* SP-10 (Build a house only partner can capture)

*Sources:* S32, S33, S51

---

## 1.9 Hazari — `hazari.bd@1`

Status: **FROZEN** except final-tie (G-34).

```yaml
id: hazari.bd@1
family: compare
seats: { min: 4, max: 4, teams: none }
direction: counter_clockwise
deck: { base: std52 }
values: { A,K,Q,J,10: 10, 2..9: 5 }   # = 360
evaluator: three_card_classes [Troy, ColourRun, Run, Colour, Pair, Indi]
  runs: AKQ > A23 > KQJ > … > 432 ; ace adjacent to 2 or K, not both
  colour/indi: compare high, middle, low ; pair: pair rank then kicker
deal: { schedule: 13 each, dealer_rotation: next dealer (direction) }
arrange:   # simultaneous, hidden
  partition: groups of 3,3,3,4
  validity: G1 >= G2 >= G3 >= best3(G4)   # : 4-card group valued by its best 3-card combination and
                                                     #   "must be the lowest of the four"
  commit: "up" locks the partition
rounds:
  r1..r3: leader plays highest remaining 3-card group, others follow in direction with their highest remaining
  r4: every player plays the 4-card group (compared on best 3)
  leader_r1: dealer_next_in_direction ; leader_next: round winner
  tie: LAST of equal groups wins
  winner_takes: all cards of the round (12, or 16 in r4)
scoring: { per_deal: sum of captured values }
match: { end: after a deal where anyone has >= 1000 ; winner: highest total ; tie: UNRESOLVED(G-34) }
visibility: { arrangement: private until each group is shown }
randomness: [ R-HZ-1 shuffle ]
note: after all players commit, the deal outcome is fully determined; rounds are presentation only.
```

**Hand machine**

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL | SM-DEAL | AUTO | 13 each | → ARRANGE |
| ARRANGE | WINDOW(all, simultaneous, hidden) | — | `Commit(G1,G2,G3,G4)` with `G1 ≥ G2 ≥ G3 ≥ best3(G4)`; timeout → system `AutoArrange` | all committed → ROUNDS |
| ROUNDS r=1..4 | AUTO | — | each seat's next group revealed in direction from leader; winner = best (r4: best3 of 4); tie → last played; winner takes all cards; winner leads r+1 | → SCORE |
| SCORE | AUTO | — | add captured values | HAND_END |

Terminal: after a deal with any total ≥ 1000 → highest wins (tie G-34). **Information:** Commits are sealed until the round reveals them; since play order is forced there is no information advantage to revealing later.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| HZ-01 | Hazarey (Bhutan) | 380 points; 4-card combinations beat 3-card of same class; three troys in rounds 1–3 = instant game win | two-pair ranking unknown | DEFER (PROFILE) |
| HZ-02 | Joker Hazari | ≤1 joker per group | G-35 | DEFER |
| HZ-03 | Winner deals next | rotation | — | TOGGLE |

*Rejected (not implemented):* HZ-04 (Bidding phase)

*Sources:* S34, S52

---

## 1.10 Kali Teeri — `kaliteeri.catsatcards@1`

Status: **PROVISIONAL** — single rules source; app listings misdescribe the game (Research §3.9). Not freezable until G-36…G-41 close.

```yaml
id: kaliteeri.catsatcards@1
family: trick
seats: { min: 4, max: 6, teams: hidden_by_called_cards }
direction: clockwise
deck: { base: std52, remove_by_seats: { 5: two 2s (which two: UNRESOLVED G-39), 6: all four 2s } }
values: { 3S: 30, A/K/Q/J/10: 10, 5: 5, other: 0 }   # = 250
orders:
  trick: natural_A_high
  three_of_spades_promotion: UNRESOLVED(G-38)   # S35 makes 3S the top trump (L); common play may not
deal: { schedule: all cards, dealer_rotation: clockwise }
auction:
  opener: dealer_next ; bids: 150..250, each higher ; end: bid followed by (seats-1) consecutive passes   # (3 passes
                                                                                                       #   written for 4 seats)
  increment: UNRESOLVED(G-39)
  all_pass: UNRESOLVED(G-39)
  pass_is_final: UNRESOLVED(G-39)
contract:
  bidder_names_trump: public
  partner_call: 1 card not in bidder's hand (must exist in the deck in use)   # DESIGN (existence)
  partner_call_at_max_bid_5_6_seats: 2 cards   # general rule for count: UNRESOLVED(G-41)
  same_holder_of_both: one partner
play:
  first_lead: bidder
  obligations: [ must_follow_suit ]
team_reveal: holder of a called card is revealed to all when that card is played
scoring:
  success (bid team points >= bid): bidder and each partner +bid
  failure: bid team 0 ; opponents +bid (each)   # (M) ; alternative "bidder side loses bid": UNRESOLVED(G-37)
match: { deals: multiple of seat count (agreed) }
visibility:
  partner_identity: known only to the partner until the called card is played
  team_point_totals: must not be computed over unrevealed partners in any projection   # DESIGN (`02_ENGINE.md` §6)
```

**Hand machine**

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL | SM-DEAL | AUTO | all cards (2s removed for 5/6 seats) | → AUCTION |
| AUCTION | SM-AUCTION | TURN | `Bid(150..250)` / `Pass` (increment, re-entry, all-pass: G-39) | → CONTRACT |
| CONTRACT | TURN(bidder) | TURN | `NameTrump(suit)`; `CallPartner(card[, card])` — card not in bidder's hand and in the deck | hidden team membership assigned (P-06): holders of called cards know, nobody else → PLAY |
| PLAY | SM-TRICK | TURN | must follow; void any | on play of a called card: `TeamReveal(seat)` event to all |
| SCORE | AUTO | — | final teams; success/failure per §1.10 | HAND_END |

 **Information:** (1) team membership is a hidden attribute with per-seat knowledge, (2) no projection computes a bid-team running total over unrevealed partners, (3) bots receive the same knowledge, (4) voice is off in public tables (Research §9.E). Double-deck called-card duplicates (G-40) must be ruled before enabling double deck.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| KT-01 | 3♠ as highest trump | trick order | G-38 | TOGGLE after G-38 |
| KT-02 | Failure: bidder side loses bid | scoring | G-37 | DEFER |
| KT-03 | Double deck, low cards removed | 104-card variant | G-40 (duplicate called cards) | DEFER |
| KT-04 | Partner-card count by bid/seats | 1 or 2 cards | G-41 | DEFER |

*Sources:* S35

---

## 1.11 Badam Satti — `badamsatti.in@1`

Status: **FROZEN_WITH_GAPS** (leftover values G-42).

```yaml
id: badamsatti.in@1
family: layout
seats: { min: 3, max: 8, teams: none }   # (apps default 4)
direction: clockwise   # apps (M)
deck: { base: std52 }   # multi-deck = variant BS-02
deal: { schedule: all cards one at a time, unequal_hands: allowed }
play:
  first: holder of 7H plays 7H
  legal: any 7 (opens its suit row) OR the next card below the lowest / above the highest of an open row
  row_ends: A (low end) and K (high end)   # (A–K sequence)
  pass: only if no legal card
hand_end: first player to empty hand
scoring:
  leftover: J/Q/K = 10, other cards face value   # app ; ace value UNRESOLVED(G-42) (provisional 1)
match: { rounds: 5, winner: lowest total }   # app (M) ; tie: UNRESOLVED(G-14)
randomness: [ R-BS-1 shuffle ]
```

**Hand machine**

| State | Mode | Legal actions | Transition |
|---|---|---|---|
| DEAL | AUTO | — | → OPEN |
| OPEN | TURN(7♥ holder) | `Play(7♥)` | → LOOP |
| LOOP | TURN(next) | `Play(c)` where c is any 7 or extends an open row by one; `Pass` only when no legal card (engine offers Pass only then) | player empties → HAND_END |
| HAND_END | AUTO | leftover values (ace G-42) | → match (5 rounds, lowest wins) |

 Note: an automatic Pass leaks nothing beyond what a manual pass reveals (pass is only legal with no playable card).

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| BS-01 | Seats 3–8 | seat count | unequal hands | TOGGLE |
| BS-02 | Multiple decks, 7♥ opener tie | opener rule | — | DEFER |
| BS-04 | Rounds 3/4/5 | match | — | TOGGLE |

*Rejected (not implemented):* BS-03 (Illegal-pass penalty); BS-05 (6 and 8 required before extending)

*Sources:* S36

---

## 1.12 Bluff / 420 — `bluff.base@1`

Status: **PROVISIONAL** — core South Asian rules unresolved (G-43, ship-blocking). The profile below lists only what sources support.

```yaml
id: bluff.base@1
family: claim
seats: { min: 3, max: 10 }
deck: { copies: 1 for <= 4 seats, 2 for >= 5 }
deal: { schedule: all cards, as even as possible }
round:
  lead: leader claims a rank and plays N face-down cards, N in 1..4 (1..8 with 2 decks)
  rank_progression: UNRESOLVED(G-43)   # fixed for the round (apps; Canadian/Spanish variants S37*)
                                                     #   vs incrementing (British Cheat S37*)
  subsequent_turn: play N cards claimed as the round rank, or pass
  claim_count: equals cards played   # DESIGN — the count is visible on a screen; "more than claimed"
                                                     #   tolerance (S37*) is rejected (03 BL-09)
challenge:
  eligible: UNRESOLVED(G-43) (any player vs next player only)
  window_closes: when the next player places cards
  scope: entire challenged claim revealed ; any non-matching card → claimant takes pile   # (M)
  loser_takes: whole pile into hand
  next_leader: UNRESOLVED(G-43)
all_pass: pile removed from play ; next leader UNRESOLVED(G-43)   # Fujian variant (removal)
win: first player to empty hand, subject to the final claim surviving its challenge window   # UNRESOLVED(G-43)
visibility:
  pile: face down, never projected ; challenge reveal: only the challenged claim's cards, to all
  removed_pile.post_hand: conceal   # DESIGN: matches the removal rule; presentation-only (P-05)
  pile pickup: contents visible to the taker only
```

**Hand machine**

| State | Mode | Legal actions | Transition |
|---|---|---|---|
| ROUND_LEAD | TURN(leader) | `Claim(rank, cards[1..4])` (face down) | → CHALLENGE_WINDOW |
| CHALLENGE_WINDOW | WINDOW(eligible per G-43; closes on first `Challenge` by server sequence, or when all eligible decline, hold a standing `decline`, or time out; short profile deadline per P-16) | `Challenge` / Decline | Challenge → RESOLVE; closed → NEXT_TURN |
| NEXT_TURN | TURN(next non-out seat) | `Claim(round rank, cards)` / `Pass` | Claim → CHALLENGE_WINDOW; all pass → ALL_PASS |
| RESOLVE | AUTO | reveal the challenged claim (public); any non-matching card → claimant takes pile, else challenger takes pile (pile visible to taker only) | → ROUND_LEAD (leader G-43) |
| ALL_PASS | AUTO | pile removed from play (never projected) | → ROUND_LEAD (leader G-43) |
| OUT_CHECK | AUTO | a seat at 0 cards whose last claim's window closed without a successful challenge → finished | 1 seat left → HAND_END |

Design rule replacing "simultaneous challenge": the next player's action is not accepted until the window closes. **Information:** Claim count public, identities hidden; opaque handles mandatory — stable IDs would let clients track a revealed card when it is later replayed face down.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| BL-01 | Fixed rank per round | rank fixed until challenge/all-pass | G-43 | candidate default |
| BL-02 | Incrementing ranks | rank advances each turn | conflicts BL-01 | TOGGLE |
| BL-04 | Only next player may challenge | eligibility | G-43 | TOGGLE |
| BL-06 | Jokers wild (2 decks) | claim up to 11 | requires 2 decks | TOGGLE |
| BL-07 | Auto-discard complete ranks | 4 (or 8) of a kind removed | — | TOGGLE |
| BL-08 | Reveal whole pile after challenge | information | — | TOGGLE |
| BL-11 | Play to a single loser | ranking mode | — | TOGGLE |

*Rejected (not implemented):* BL-03 (Challenger picks one card); BL-05 (Pass advances rank); BL-09 (Play more than claimed); BL-10 ("Three wrong claims" limit)

*Sources:* S37, S37*, S51

---

## 1.13 Kitti — `kitti.np@1`

Status: **PROVISIONAL** (evaluator order, ties and scoring unresolved: G-44…G-46).

```yaml
id: kitti.np@1
family: compare
seats: { min: 2, max: 5 }
direction: counter_clockwise
deck: { base: std52 }
deal: { schedule: 9 each }   # stub of undealt cards stays hidden
stub.post_hand: conceal   # DESIGN; presentation-only (P-05)
fold_window: optional before arranging   # semantics/scoring UNRESOLVED(G-44)
arrange: three 3-card sets, shown strongest first
evaluator: [Trial, PureRun, Run, Colour, Pair, High]
  run_order: UNRESOLVED(G-45)   # AKQ>A23 (Teen Patti convention, S34/S52) vs A23 top (brag, S51)
  special_235_unsuited_top: off   # variant KI-01 (S38)
rounds: player next to dealer shows first; each set compared; set winner shows first next
  tie: UNRESOLVED(G-46)
hand_result: { winner: 2 of 3 sets ; salami: 3 of 3 ; kitti: no winner → redeal }
scoring: UNRESOLVED(G-44)   # traditionally stake-settled; no points system sourced
match: OWNER
```

**Hand machine**

| State | Mode | Legal actions | Transition |
|---|---|---|---|
| DEAL | AUTO | 9 each | → FOLD_WINDOW |
| FOLD_WINDOW | WINDOW(all) | `Fold` / Continue (semantics G-44) | → ARRANGE |
| ARRANGE | WINDOW(simultaneous, hidden) | `Commit(S1 ≥ S2 ≥ S3)`; timeout → AutoArrange | → ROUNDS |
| ROUNDS r=1..3 | AUTO | reveal sets in order from leader; winner per evaluator (run order G-45, ties G-46); winner leads next | → RESULT |
| RESULT | AUTO | winner (2 sets) / salami (3) / kitti (none → HAND_ANNULLED → redeal) | HAND_END |

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| KI-01 | 2-3-5 unsuited as top set | evaluator | — | TOGGLE |
| KI-02 | Fold | leave before arranging | G-44 | DEFER |
| KI-03 | A-2-3 as top run | evaluator | G-45 | TOGGLE after G-45 |
| KI-04 | Suit breaks ties | tie rule | G-46 | DEFER |

*Sources:* S38, S51

---

## 1.14 Marriage (Nepal) — `marriage.np@1`

Status: **FROZEN_WITH_GAPS** (maal eligibility G-48 is ship-blocking).

```yaml
id: marriage.np@1
family: draw_discard
seats: { min: 2, max: 5 }
direction: clockwise   # Pagat ; regional default UNRESOLVED(G-49)
deck: { base: std52, copies: 3, jokers: 0 }   # (printed jokers = variants MA-03/04)
deal:
  schedule: 21 each; 1 upcard starts discard; rest = stock   # one-at-a-time DESIGN
  dealer_rotation: left
window_tunnela_exposure: at start, any player may expose dealt tunnelas
turn:
  draw: stock top OR latest discard (first player may take the upcard)
  discard: one card, not the card just taken from the discard
see_joker:
  condition: lay down 3 combinations each a tunnela or pure sequence
             (whether start-exposed tunnelas count toward the 3: UNRESOLVED(G-48b))
  alt_condition: lay down 7 dublees
  first_qualifier: selects tiplu = random card from the middle of the stock, looks, puts it at the bottom
                   position = RNG draw R-MA-2 (DESIGN)
  later_qualifiers: may look at tiplu
wilds (for seen players only):
  tiplu: same suit+rank ; jhiplu: same suit, rank-1 ; poplu: same suit, rank+1 (A above K, 2 above A)
  ordinary_jokers: tiplu rank in other suits
  not usable in: tunnelas
restrictions_after_seeing:
  cannot take a wild card from the discard
  dublee player may take a discard only if it completes the 8th dublee
combinations: 3 cards each: tunnela, pure sequence, dirty sequence, triplet (3 different suits), dirty triplet;
              ace at either end, not middle; marriage = jhiplu+tiplu+poplu (pure)
finish:
  melds: seen player forms 4 more combinations after drawing, discards, play ends
  dublees: 8 dublees after drawing
stock_exhausted: all discards except the latest are shuffled and placed over the tiplu   # RNG R-MA-3
scoring:
  maal_table: per Research §3.14 (tiplu 3/7; jhiplu/poplu 2/5/10/20; marriage 10/30; tunnela 5 / ordinary-joker
              tunnela 10, exposed-at-start and seen only)
  maal_eligibility_of_unseen_players: UNRESOLVED(G-48)   # ship-blocking
  payments: winner receives 3 from each seen, 10 from each unseen player; +5 each if won by dublees;
            then pairwise differences of card points
  settlement_formula: net_i = T + w_i − n·S_i (paid to winner; negative = winner pays)
match: OWNER
visibility:
  tiplu and every derived wild flag: seen players only (`02_ENGINE.md` §6)
  exposed combinations: public ; discard pile: spread, public
randomness: [ R-MA-1 shuffle, R-MA-2 tiplu_position, R-MA-3 restock_shuffle ]
guards: { max_restocks: OWNER(G-57) }
```

**Hand machine**

| Phase | State | Mode | Legal actions | Transition |
|---|---|---|---|---|
| DEAL | SM-DEAL | AUTO | 21 each, upcard, stock | → EXPOSE_WINDOW |
| EXPOSE | tunnela exposure | WINDOW(all) | `ExposeTunnela(set)` / Decline | → TURN_LOOP |
| TURN_LOOP | SM-DRAW-DISCARD | TURN | `Draw(stock or discard)` (seen players: not a wild; seen dublee players: only the 8th-dublee completer); then optional `LayDown3(...)` → `SeeJoker` (first qualifier triggers R-MA-2 tiplu selection), `LayDown7Dublees`, `Finish(melds)` or `Finish(8 dublees)`; then `Discard(card ≠ card just taken)` | Finish → SCORE; stock empty → RESTOCK (R-MA-3) |
| SCORE | AUTO | — | maal per seat (eligibility G-48), payments, settlement formula | HAND_END |

Knowledge state: `seen[s]` flag; `tiplu` in a hidden slot visible to seats with `seen[s]`. Legal-action and validation functions take the seat's knowledge: for unseen seats, wilds do not exist; for seen seats, wilds are applied. **Information:** No `is_wild`, maal highlight or auto-arrange hint may be computed for an unseen seat; the discard-restriction for seen seats is evaluated with their knowledge only.

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| MA-01 | Anticlockwise | direction | G-49 | PRESET |
| MA-02 | Tiplu = last stock card | selection | — | TOGGLE |
| MA-03 | Man cards (0–3 printed jokers) | extra wilds | G-51 | DEFER |
| MA-04 | Superman card | wild usable before seeing | G-51 | DEFER |
| MA-05 | Alter cards | same colour+rank as tiplu are wild | G-51 | DEFER |
| MA-06 | Murder | undefined | G-50 | DEFER |
| MA-07 | Kidnap | undefined | G-50 | DEFER |
| MA-08 | Player-stated maal values | main maal 5, double 15, dublee show +5 | — | DEFER |
| MA-09 | Indian Marriage / Parneva | possibly distinct game | — | DEFER (research) |

*Sources:* S39, S51

---

## 1.15 Dhumbal / Jhyap — `dhumbal.np@1`

Status: **PROVISIONAL** (Nepali defaults G-54, ship-blocking).

```yaml
id: dhumbal.np@1
family: draw_discard
seats: { min: 2, max: 5 }
direction: counter_clockwise   # (Nepal)
deck: { base: std52, jokers: 0 }   # Nepal "often without jokers"
deal: { 5 each ; top of stock face up starts the pile }
turn: throw first, then pick
throw: single card | 2+ same rank | 3+ consecutive same suit
pick: stock top OR from the previous player's throw
  which_cards_of_a_multi_card_throw: UNRESOLVED(G-54)   # Yaniv: end cards only; Nepal: "any one" (truncated source)
values: UNRESOLVED(G-54)   # J=0,Q/K=10 (Pagat Nepal) | A..K = 1..13 (Bhoos) | >10 = 10
call:
  threshold: UNRESOLVED(G-54)   # <=5 (Pagat/Yaniv) | <=10 (Bhoos) | configurable (Yarsa)
  timing: UNRESOLVED(G-54)   # Yaniv: at start of turn before throwing
resolution: all hands shown ; caller wins if strictly lowest ; a player with lower-or-equal total "dhumbals" the caller
scoring: UNRESOLVED(G-54)   # Yaniv: caller +30 penalty, 100/200 halving, elimination
match: UNRESOLVED(G-54) / OWNER
randomness: [ R-DH-1 shuffle, R-DH-2 restock_shuffle ]
```

**Hand machine**

| State | Mode | Legal actions | Transition |
|---|---|---|---|
| DEAL | AUTO | 5 each, face-up starter | → TURN |
| TURN_START | TURN | `CallShow` if total ≤ threshold (timing G-54) | Call → SHOWDOWN |
| THROW | TURN | `Throw(single, set or run)` | → PICK |
| PICK | TURN | `Pick(stock or allowed card of previous throw)` | → next TURN_START |
| SHOWDOWN | AUTO | compare totals; caller wins iff strictly lowest (dhumbal otherwise) | HAND_END |

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| DH-01 | Call threshold ≤5 / ≤10 / custom | show threshold | G-54 | TOGGLE after G-54 |
| DH-02 | Card values J=0 / 11-12-13 / >10 = 10 | values | G-54 | TOGGLE |
| DH-03 | Jokers (54 cards) | wilds / zero-value | — | TOGGLE |
| DH-04 | Yaniv scoring | +30 penalty, halving at 100/200, elimination | — | PRESET "Yaniv" |
| DH-05 | Pick end cards only | pick restriction | G-54 | TOGGLE |
| DH-06 | Pair-related pickup restriction | undefined | — | DEFER |

*Sources:* S40, S51

---

## 1.16 Jutpatti — `jutpatti.np@1`

Status: **PROVISIONAL** (wild rule G-56, ship-blocking).

```yaml
id: jutpatti.np@1
family: draw_discard
seats: { min: 2, max: 4 }
direction: counter_clockwise   # Bhoos
deck: { base: std52, jokers: UNRESOLVED(G-56) }
deal: { hand_size: 7 }   # (5/9/11 = variant JP-01)
wild_rule: UNRESOLVED(G-56)   # printed jokers (catsatcards) | flipped card rank+1 in all suits (Bhoos)
                                                     #   | flipped card "number" (Hamro Patro)
turn: draw (stock or last discard; first turn from stock) then discard
win: after drawing, all hand cards form pairs (with wilds) → show
dealer_rotation: winner deals next
stock_exhausted: UNRESOLVED(G-56)
joker_joker_pair: UNRESOLVED(G-56)
match: OWNER
randomness: [ R-JP-1 shuffle, R-JP-2 restock (if resolved) ]
```

**Hand machine**

| State | Mode | Legal actions | Transition |
|---|---|---|---|
| DEAL | AUTO | 7 each; joker determination per G-56 (flip = next stock card, public) | → TURN |
| DRAW | TURN | `Draw(stock or last discard)` (first turn stock only) | all cards pair → `Show` available |
| SHOW or DISCARD | TURN | `Show` (win) / `Discard(card)` | Show → HAND_END |

**Variants** (canonical defaults above; delivery: PROFILE · PRESET · TOGGLE · DEFER · REJECT)

| ID | Variant | Difference | Depends / conflicts | Delivery |
|---|---|---|---|---|
| JP-01 | Hand size 5 / 9 / 11 | deal size | — | TOGGLE |
| JP-02 | Printed jokers pair with anything | wild source | G-56 | TOGGLE after G-56 |
| JP-03 | Flipped rank + 1 is wild (all suits) | wild source | G-56 | TOGGLE after G-56 |
| JP-04 | Flipped card's rank is wild | wild source | G-56 | TOGGLE after G-56 |

*Sources:* S16, S41

---

## 2. Cross-game compatibility rules

Enforced by the profile compiler; compiled into each Profile Bundle's toggle schema. Deferred variants enter only through the extension ladder (`02_ENGINE.md` §1).

| Rule | Reason |
|---|---|
| `collection = consecutive_same_player` ⇒ `early_end = none` | trick totals unknown until collection (CP-07, Dehla Pakad) |
| `trump.mode = hidden_*` ⇒ `activation ∈ {trick_inclusive, card_level}` must be declared | trump activation differs by game |
| `no_trump` ⇒ no Pair declarations | 29-05 |
| Double deck ⇒ explicit equal-card tie rule | BH-03, BS-02, MI-06, KT-03 |
| Any toggle ⇒ private rooms only unless part of a preset | matchmaking integrity |
| `take_from_neighbour` ⇒ never in public queues | collusion (BH-12) |
| Voice ON ⇒ never in public Kali Teeri, Bluff or partnership queues | Research §9.E |

---

## 3. Open items

### 3.1 Rule gaps
Tier R1 blocks the affected profile; R2 shapes a default; R3 is low risk. Closed only by evidence (native-player validation, `04_QUALITY_RELEASE_ROADMAP.md` §6).

| ID | Tier | Question | Games |
|---|---|---|---|
| G-23 | R1 | In the 29 auction, is a pass final, or may a passed player re-enter? | 29 (shared SM-AUCTION used by Kali Teeri) |
| G-48 | R1 | Do players who have **not seen** the tiplu score maal? (G-48b: do start-exposed tunnelas count toward the three combinations needed to see?) | Marriage |
| G-43 | R1 | South Asian Bluff core: fixed vs incrementing rank; who may challenge; who leads after a challenge and after all pass; when a player with no cards is "out" | Bluff |
| G-26 | R1 | Default trump method: Mendikot (random display / band hukum a / band hukum b / cut hukum) and Dehla Pakad (M1 play-first / M2 announced) | Mindi family |
| G-30 | R1 | Seep capture and auto-cement when several disjoint selections are possible: player chooses among inclusion-maximal selections (reading of Pagat's example) — or must the largest total be taken? Same question for loose sets auto-added to a new/broken house | Seep |
| G-54 | R1 | Nepali Dhumbal defaults: call threshold; card values (J); call timing; which cards of a multi-card throw may be picked; scoring and penalties; match end | Dhumbal |
| G-56 | R1 | Jutpatti wild rule; joker–joker pairs; stock exhaustion | Jutpatti |
| G-36 | R1 | Kali Teeri canonical rules beyond Cats at Cards (single source; app listings describe other games) | Kali Teeri |
| G-37 | R1 | Kali Teeri failure scoring: opponents each score the bid, or the bidding side loses the bid | Kali Teeri |
| G-38 | R1 | Is 3♠ the highest trump in Kali Teeri? | Kali Teeri |
| G-45 | R1 | Kitti run order: A-K-Q > A-2-3 (Teen Patti/Hazari convention) or A-2-3 top (brag players) | Kitti (evaluator shared with Hazari config) |
| G-46 | R1 | Kitti equal sets: first shown wins, last shown wins, or suit tie-break | Kitti |
| G-44 | R1 | Kitti scoring without stakes; fold semantics; all-but-one fold | Kitti |
| G-17 | R1 | Hidden Rung face-down play by the trump caller: which suits are allowed, and is the card ever revealed (end of hand)? | Hidden Rung |
| G-21 | R1 | Be-ranga: who leads first; does the trump-setting card count as a trump within its own trick? | Be-ranga |
| G-10 | R1 | Which game do Kerala players mean by "Kazhutha": trump-less Getaway (app) or Kasaragod Donkey (emergent trump)? | Kazhutha |
| G-01 | R2 | Is take-from-neighbour played in Pakistan/India today; is it allowed before trick 1 (the A♠ trick); may a player take more than once per window; may the last two players use it? | Bhabhi |
| G-02 | R2 | If the take-from-neighbour victim holds the power, who leads next? | Bhabhi |
| G-12 | R2 | Regional default for Callbreak forced play (must-beat, must-trump-if-winning) | Callbreak |
| G-13 | R2 | Void with only losing trumps: may discard (S11) or must still trump | Callbreak |
| G-24 | R2 | 29 bidder may not open with a trump unless holding only trumps — prevalence | 29 |
| G-25 | R2 | 29 regional default bundles (minimum bid, direction, Pair timing, dealer rotation) | 29 |
| G-39 | R2 | Kali Teeri auction and deck details: bid increment, all-pass handling, pass finality, which two 2s are removed with 5 players | Kali Teeri |
| G-41 | R2 | Kali Teeri number of partner cards by seats and bid | Kali Teeri |
| G-40 | R2 | Kali Teeri double deck: which copy of a called card defines the partner | Kali Teeri (double deck) |
| G-49 | R2 | Marriage default direction in Nepal | Marriage |
| G-31 | R2 | Do sweeps count toward Seep's 9-point minimum? | Seep 100 |
| G-28 | R2 | Mendikot cut hukum: is the trump-setting card a trump in its own trick? (Dehla Pakad M1 says yes) | Mendikot |
| G-04 | R2 | Bhabhi escape rule (c): if every other player also empties in the same trick, who loses? | Bhabhi (BH-11) |
| G-05 | R2 | Bhabhi finishing order when several players escape in the same trick | Bhabhi (penalty scoring) |
| G-09 | R2 | Bhabhi escape rule (b): if the victim of the draw loses their last card, do they escape? | Bhabhi (BH-09) |
| G-18 | R2 | Court Piece Ace Rule semantics | Double Sar apps |
| G-22 | R2 | Court Piece trump challenge | Court Piece |
| G-06 | R3 | Does any household play that a void in the opening trick causes a pickup? | Bhabhi |
| G-15 | R3 | Callbreak: prevalence of bid-sum-below-8 redeal; redeal loop cap | Callbreak |
| G-16 | R3 | Court Piece: who decides to continue for a 52-court after the first 7 tricks | Court Piece |
| G-14 | R3 | Final-score ties (Callbreak totals; Badam Satti totals; Bhabhi penalty points) | several |
| G-34 | R3 | Hazari: two players reach ≥1000 with equal highest totals | Hazari |
| G-42 | R3 | Badam Satti leftover value of the ace (1 assumed) | Badam Satti |
| G-27 | R3 | Multi-deck Mindi: kot and 2–2 thresholds with 8+ tens | Mindi (apps) |
| G-35 | R3 | Joker Hazari rules | Hazari |
| G-19 | R3 | Court Piece "Band Rung" / "Band Turph" definition | Court Piece |
| G-50 | R3 | Marriage Murder and Kidnap modes | Marriage |
| G-51 | R3 | Marriage Man, Superman and alter cards: exact wild and maal behaviour | Marriage |

### 3.2 Owner decisions (rules)
| ID | Decision | Affects | Recommendation |
|---|---|---|---|
| G-57 | Hand action cap and its outcome (no loser / annul / current leader loses) | all games; required for Bhabhi, Bluff, Marriage | cap large enough never to trigger in normal play; outcome must not reward stalling |
| G-58 | Match length for games whose tradition is open-ended (Bhabhi tally, Court Piece courts, Mendikot/Dehla kots, 2-3-5, Call Bridge, Kitti, Bluff, Jutpatti, Seep baazis) | matchmaking, ratings | offer 2–3 fixed lengths per game; key queues on them |
| O-01 | Display name for Bhabhi/Thulla/Getaway | branding, 3+ rating | **Decided 22 Sep 2026: "Thulla"**; Bhabhi and Getaway remain searchable aliases |
| O-01b | Loser label for Thulla | branding, 3+ rating | open |
| O-02 | Take-from-neighbour in public play | fairness | private rooms only (collusion vector) |
| O-03 | Auto-play of forced moves | fairness (L-11) | opt-in with fixed delay |
| O-04 | End-of-deal hand reveal (Court Piece CP-14 and similar) | information policy | allowed after the hand only |
