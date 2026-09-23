/**
 * Bhabhi (Thulla / Get Away) — profile bhabhi.tz@1, the TashZone v1 rules ported to the new engine.
 * 3–8 players, one or two decks, no trump, no points. Get rid of your cards; the last player holding
 * cards is the Bhabhi (v1 brief L14, L19, L32–L35; Pagat). Play follows seat order.
 * Behaviour matches v1 `games/bhabhi.ts`. The deal and every mid-hand draw come from the hand's
 * tz-rng-v1 seed (labels R-BH-1/shuffle and R-BH-2/draw/<trick>), so nothing random is stored in state.
 */
import { type CardId, type Suit, isCardId, rankValue as rankValueOf, sortCards, std52, suitOf } from "../core/cards.js";
import { type DrawRecord, handRandom } from "../core/rng.js";
import { type BotRandom, sampleHiddenHands } from "../core/botrng.js";
import { type PlayedCard, cardsOfSuit, highest, highestOfLed, lowest, removeEach, removeOne, sameCards } from "../families/trick-taking.js";
import { type BaseView, type GameModule, projectEventsFor, rankBy, toSeatAction, viewerSeat } from "../core/contract.js";
import type { Action, EngineEvent, RejectCode, RuleErrorCode, Seat, SeatMove, StepResult, Viewer, WaitingOn } from "../core/types.js";

export type PowerHolderEmpty = "drawFromWaste" | "drawFromNext" | "escapeIfThreePlus" | "passToNext";

export interface BhabhiRules {
  readonly profile_id: string;
  readonly players: number;
  /** immediate: an off-suit card ends the trick at once. finishTrick: everyone still plays, then the pickup happens. */
  readonly thulla: "immediate" | "finishTrick";
  /** The first trick (led by the ace of spades) is always discarded, even if someone could not follow. */
  readonly first_trick_discard: boolean;
  /** What happens when the power holder plays their last card and keeps the power (L19). */
  readonly power_holder_empty: PowerHolderEmpty;
  /** Two decks: required for 7–8 players, optional for 4–6 (L32). Identical cards: first played wins. */
  readonly decks: 1 | 2;
  /** L33: before a trick, take all cards of the next player in play order still holding cards; they get away. */
  readonly take_hand: boolean;
  /** L34: two players left, a card drawn from the waste is led and cut: the leader loses at once. */
  readonly two_player_cut: boolean;
  readonly rounds: number;
  /** L35: the match also ends once a player has been the Bhabhi this many times; 0 = off. */
  readonly bhabhi_limit: number;
  /** L39: extra cards dealt to seat 0, taken from the other hands (against bots only). */
  readonly handicap: number;
  /** Safety cap so a hand can never loop forever; the player with most cards then becomes the Bhabhi. */
  readonly max_tricks: number;
  readonly max_actions_per_hand: number;
  readonly turn_ms: number;
  readonly window_ms: number;
}

export interface BhabhiHandResult {
  readonly hand_id: string;
  /** Seats in the order they got away. */
  readonly finish_order: readonly Seat[];
  readonly bhabhi: Seat;
}

export interface BhabhiLastTrick {
  readonly plays: readonly PlayedCard[];
  readonly outcome: "discarded" | "pickedUp";
  /** Who picked the cards up, or who holds the power after a discard. */
  readonly seat: Seat;
}

export interface BhabhiHand {
  readonly hand_id: string;
  /** server-only */
  readonly seed: string;
  readonly phase: "PLAY" | "DONE";
  readonly annulled: string | null;
  readonly dealer: Seat;
  readonly hands: readonly (readonly CardId[])[];
  /** the deal of this hand, revealed when the hand ends */
  readonly dealt: readonly (readonly CardId[])[];
  /** cards each seat picked up and still holds: seen by everyone at the table */
  readonly known: readonly (readonly CardId[])[];
  readonly waste: readonly CardId[];
  /** cards everyone saw go to the waste pile (card tracker); a card drawn back stays listed */
  readonly discards: readonly CardId[];
  /** suits each seat has shown it does not hold, cleared when it gains unseen cards */
  readonly voids: readonly (readonly Suit[])[];
  readonly trick: readonly PlayedCard[];
  /** seats taking part in the current trick, in play order from the leader */
  readonly trick_order: readonly Seat[];
  readonly turn: Seat;
  readonly thulla: PlayedCard | null;
  readonly first_trick: boolean;
  /** seat that drew and must now lead that card */
  readonly drawn_lead: Seat | null;
  readonly last_trick: BhabhiLastTrick | null;
  readonly trick_count: number;
  readonly out: readonly boolean[];
  readonly finish_order: readonly Seat[];
  readonly actions: number;
}

export interface BhabhiMatch {
  readonly hands_played: number;
  readonly next_dealer: Seat;
  readonly bhabhi_counts: readonly number[];
  /** finishing places added over the hands played (the Bhabhi counts as last place) */
  readonly place_totals: readonly number[];
  readonly results: readonly BhabhiHandResult[];
  readonly over: boolean;
  readonly placements: readonly number[] | null;
}

export interface BhabhiState {
  readonly v: 1;
  readonly game: "bhabhi";
  readonly rules: BhabhiRules;
  readonly match: BhabhiMatch;
  readonly hand: BhabhiHand | null;
}

const ACE_OF_SPADES: CardId = "AS";
const deckFor = (r: BhabhiRules): CardId[] => (r.decks === 2 ? [...std52(), ...std52()] : std52());
const nextSeat = (seat: Seat, n: number): Seat => (seat + 1) % n;

const orderFrom = (leader: Seat, n: number, out: readonly boolean[]): Seat[] => {
  const order: Seat[] = [];
  for (let i = 0, s = leader; i < n; i++, s = nextSeat(s, n)) if (!out[s]) order.push(s);
  return order;
};
const activeSeats = (out: readonly boolean[]): Seat[] => out.flatMap((o, seat) => (o ? [] : [seat]));
function nextActive(seat: Seat, n: number, out: readonly boolean[]): Seat | null {
  for (let i = 1, s = nextSeat(seat, n); i < n; i++, s = nextSeat(s, n)) if (!out[s]) return s;
  return null;
}

export function checkRules(r: BhabhiRules): string | null {
  if (r.decks === 1 && (r.players < 3 || r.players > 6)) return "One deck is for 3–6 players";
  if (r.decks === 2 && (r.players < 4 || r.players > 8)) return "Two decks are for 4–8 players";
  return null;
}

export function initialState(rules: BhabhiRules): BhabhiState {
  const n = rules.players;
  return {
    v: 1, game: "bhabhi", rules,
    match: {
      hands_played: 0, next_dealer: 0, bhabhi_counts: Array.from({ length: n }, () => 0),
      place_totals: Array.from({ length: n }, () => 0), results: [], over: false, placements: null,
    },
    hand: null,
  };
}

/** Deals the whole deck from the seat after the dealer; the seat that receives the first ace of spades starts. */
function deal(shuffled: readonly CardId[], r: BhabhiRules, dealer: Seat): { hands: CardId[][]; leader: Seat } {
  const n = r.players;
  const order: Seat[] = [];
  for (let i = 0, seat = nextSeat(dealer, n); i < n; i++, seat = nextSeat(seat, n)) order.push(seat);
  const counts = Array.from({ length: n }, () => 0);
  let index = 0;
  for (let i = 0; i < shuffled.length; i++) { const seat = order[index++ % n]!; counts[seat] = counts[seat]! + 1; }
  let moved = 0;
  for (let pass = 0; moved < r.handicap && pass < shuffled.length; pass++) {
    let gave = false;
    for (const seat of order) {
      if (moved >= r.handicap) break;
      if (seat === 0 || counts[seat]! <= 1) continue;
      counts[seat] = counts[seat]! - 1;
      counts[0] = counts[0]! + 1;
      moved++;
      gave = true;
    }
    if (!gave) break;
  }
  const hands: CardId[][] = Array.from({ length: n }, () => []);
  let leader = -1;
  let cursor = 0;
  for (const card of shuffled) {
    let seat = order[cursor % n]!;
    while (hands[seat]!.length >= counts[seat]!) { cursor++; seat = order[cursor % n]!; }
    cursor++;
    hands[seat]!.push(card);
    if (card === ACE_OF_SPADES && leader < 0) leader = seat;
  }
  return { hands, leader };
}

/** Adds cards to the public discard list, never listing a card more often than the decks contain it. */
function addDiscards(discards: readonly CardId[], cards: readonly CardId[], decks: number): CardId[] {
  const out = discards.slice();
  for (const card of cards) if (out.filter((c) => c === card).length < decks) out.push(card);
  return out;
}

/* ───────────────────────── step ───────────────────────── */

type Mut<T> = { -readonly [K in keyof T]: T[K] };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const reject = (code: RejectCode): StepResult<BhabhiState> => ({ ok: false, code });

function validSchema(a: unknown, n: number): a is Action {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  if (typeof x.t !== "string" || typeof x.hand_id !== "string" || x.hand_id.length === 0 || x.hand_id.length > 64) return false;
  const seatActor = typeof x.actor === "number" && Number.isInteger(x.actor) && x.actor >= 0 && x.actor < n;
  switch (x.t) {
    case "BeginHand": return x.actor === "system" && typeof x.hand_seed === "string" && /^[0-9a-f]{64}$/.test(x.hand_seed);
    case "Timeout": return x.actor === "system" && typeof x.seat === "number" && Number.isInteger(x.seat) && x.seat >= 0 && x.seat < n;
    case "Take": return seatActor;
    case "Play": return seatActor && isCardId(x.card);
    default: return false;
  }
}

function canTake(r: BhabhiRules, h: BhabhiHand, seat: Seat): boolean {
  return r.take_hand && h.phase === "PLAY" && h.trick.length === 0 && h.drawn_lead === null && !h.out[seat] && activeSeats(h.out).length >= 3;
}

export function step(state: BhabhiState, action: unknown): StepResult<BhabhiState> {
  const r = state.rules;
  if (!validSchema(action, r.players)) return reject("BAD_SCHEMA");
  if (state.match.over) return reject("MATCH_OVER");
  const s = clone(state) as Mut<BhabhiState>;
  const events: EngineEvent[] = [];
  const draws: DrawRecord[] = [];

  if (action.t === "BeginHand") {
    if (s.hand && s.hand.phase !== "DONE") return reject("NOT_NOW");
    const dealer = s.match.next_dealer;
    const shuffled = handRandom(action.hand_seed, "R-BH-1/shuffle", draws).shuffle(deckFor(r));
    const { hands, leader } = deal(shuffled, r, dealer);
    const out = hands.map(() => false);
    const sorted = hands.map(sortCards);
    s.hand = {
      hand_id: action.hand_id, seed: action.hand_seed, phase: "PLAY", annulled: null, dealer, hands: sorted,
      dealt: sorted.map((x) => x.slice()), known: hands.map(() => []), waste: [], discards: [], voids: hands.map(() => []),
      trick: [], trick_order: orderFrom(leader, r.players, out), turn: leader, thulla: null, first_trick: true, drawn_lead: null,
      last_trick: null, trick_count: 0, out, finish_order: [], actions: 1,
    };
    events.push({ t: "HandStarted", vis: "public", hand_id: action.hand_id, dealer, leader, hand_index: s.match.hands_played });
    for (let p = 0; p < r.players; p++) events.push({ t: "Dealt", vis: [p], seat: p, cards: sorted[p]!.slice() });
    events.push({ t: "DealtCounts", vis: "public", counts: sorted.map((x) => x.length) });
    events.push({ t: "PlayTurn", vis: "public", seat: leader });
    return { ok: true, state: s as BhabhiState, events, draws };
  }

  const h = s.hand as Mut<BhabhiHand> | null;
  if (!h || h.phase === "DONE") return reject("NOT_NOW");
  if (action.hand_id !== h.hand_id) return reject("WRONG_HAND");
  h.actions += 1;

  switch (action.t) {
    case "Timeout": {
      if (action.seat !== h.turn) return reject("NOT_NOW");
      events.push({ t: "TurnTimedOut", vis: "public", seat: action.seat });
      break;
    }
    case "Take": {
      if (!canTake(r, h, action.actor)) return reject(r.take_hand ? "NOT_NOW" : "ILLEGAL_ACTION");
      takeHand(r, h, action.actor, events);
      break;
    }
    case "Play": {
      if (action.actor !== h.turn) return reject("NOT_YOUR_TURN");
      const seat = action.actor;
      const hand = h.hands[seat]!;
      const card = action.card;
      if (!hand.includes(card)) return reject("ILLEGAL_ACTION");
      const first = h.trick[0];
      if (!first && h.first_trick && hand.includes(ACE_OF_SPADES) && card !== ACE_OF_SPADES) return reject("ILLEGAL_ACTION");
      if (first && suitOf(card) !== suitOf(first.card) && cardsOfSuit(hand, suitOf(first.card)).length > 0) return reject("ILLEGAL_ACTION");
      playCard(s, h, seat, card, events, draws);
      break;
    }
    default:
      return reject("BAD_SCHEMA");
  }

  if ((h.phase as BhabhiHand["phase"]) !== "DONE" && h.actions > r.max_actions_per_hand) {
    h.phase = "DONE";
    h.annulled = "guard";
    events.push({ t: "GuardTripped", vis: "public", hand_id: h.hand_id });
    events.push({ t: "HandAnnulled", vis: "public", hand_id: h.hand_id, reason: "guard", revealed: [] });
  }
  return { ok: true, state: s as BhabhiState, events, draws };
}

function takeHand(r: BhabhiRules, h: Mut<BhabhiHand>, seat: Seat, events: EngineEvent[]): void {
  const from = nextActive(seat, r.players, h.out)!;
  const count = h.hands[from]!.length;
  const taken = h.hands[from]!;
  h.hands = h.hands.map((x, i) => (i === seat ? sortCards([...x, ...taken]) : i === from ? [] : x.slice()));
  h.known = h.known.map((k, i) => (i === seat ? [...k, ...h.known[from]!] : i === from ? [] : k.slice()));
  h.voids = h.voids.map((v, i) => (i === seat || i === from ? [] : v.slice()));
  h.out = h.out.map((o, i) => (i === from ? true : o));
  h.finish_order = [...h.finish_order, from];
  // Only the count is public; the taker's new cards stay hidden except those already known.
  events.push({ t: "TookHand", vis: "public", seat, from, count });
  events.push({ t: "GotAway", vis: "public", seat: from, place: h.finish_order.length });
  events.push({ t: "Dealt", vis: [seat], seat, cards: h.hands[seat]!.slice() });
  h.turn = h.turn === from ? seat : h.turn;
  h.trick_order = orderFrom(h.turn, r.players, h.out);
}

function playCard(s: Mut<BhabhiState>, h: Mut<BhabhiHand>, seat: Seat, card: CardId, events: EngineEvent[], draws: DrawRecord[]): void {
  const r = s.rules;
  const first = h.trick[0];
  events.push({ t: "CardPlayed", vis: "public", seat, card });
  const play: PlayedCard = { seat, card };
  h.hands = h.hands.map((x, i) => (i === seat ? removeOne(x, card) : x));
  h.known = h.known.map((k, i) => (i === seat && k.includes(card) ? removeOne(k, card) : k));
  h.trick = [...h.trick, play];

  const isThulla = first !== undefined && suitOf(card) !== suitOf(first.card);
  const counts = isThulla && !(h.first_trick && r.first_trick_discard);
  if (isThulla) events.push({ t: "Thulla", vis: "public", seat, card });

  // L34: two players left and the drawn lead is cut: the leader loses at once.
  if (counts && r.two_player_cut && first && h.drawn_lead === first.seat && activeSeats(h.out).length === 2) {
    const leader = first.seat;
    events.push({ t: "TwoPlayerCut", vis: "public", seat: leader });
    h.finish_order = [...h.finish_order, seat];
    events.push({ t: "GotAway", vis: "public", seat, place: h.finish_order.length });
    const cards = h.trick.map((p) => p.card);
    h.waste = [...h.waste, ...cards];
    h.discards = addDiscards(h.discards, cards, r.decks);
    h.last_trick = { plays: h.trick, outcome: "discarded", seat: leader };
    h.trick = [];
    h.thulla = null;
    h.drawn_lead = null;
    h.out = h.out.map((o, i) => (i === seat ? true : o));
    finishHand(s, h, leader, events);
    return;
  }
  if (counts && r.thulla === "immediate") { resolveTrick(s, h, true, events, draws); return; }
  if (counts && !h.thulla) h.thulla = play;
  if (h.trick.length === h.trick_order.length) { resolveTrick(s, h, h.thulla !== null, events, draws); return; }
  h.turn = h.trick_order[h.trick.length]!;
  events.push({ t: "PlayTurn", vis: "public", seat: h.turn });
}

function resolveTrick(s: Mut<BhabhiState>, h: Mut<BhabhiHand>, pickup: boolean, events: EngineEvent[], draws: DrawRecord[]): void {
  const r = s.rules;
  const n = r.players;
  const cards = h.trick.map((p) => p.card);
  const led = suitOf(h.trick[0]!.card);
  const power = highestOfLed(h.trick).seat;
  const hands = h.hands.map((x) => x.slice());
  const known = h.known.map((k) => k.slice());
  const voids = h.voids.map((v) => v.slice());
  let waste = h.waste.slice();
  let discards = h.discards.slice();
  let drawnLead: Seat | null = null;

  // A card off the led suit shows that player holds none of it right now.
  for (const p of h.trick) if (suitOf(p.card) !== led && !voids[p.seat]!.includes(led)) voids[p.seat]!.push(led);

  if (pickup) {
    hands[power]!.push(...cards);
    known[power]!.push(...cards);
    voids[power] = voids[power]!.filter((suit) => !cards.some((c) => suitOf(c) === suit));
    events.push({ t: "PickedUp", vis: "public", seat: power, cards });
  } else {
    events.push({ t: "Discarded", vis: "public", cards, power_holder: power });
  }

  const out = h.out.slice();
  const finishOrder = h.finish_order.slice();
  const markOut = (seat: Seat) => {
    out[seat] = true;
    finishOrder.push(seat);
    events.push({ t: "GotAway", vis: "public", seat, place: finishOrder.length });
  };

  const emptied = h.trick.flatMap(({ seat }) => (!out[seat] && hands[seat]!.length === 0 ? [seat] : []));
  const stillIn = activeSeats(out).filter((seat) => seat === power || !emptied.includes(seat)).length;
  const rule = r.power_holder_empty;
  const drawsFromWaste = rule === "drawFromWaste" || (rule === "escapeIfThreePlus" && stillIn === 2);
  const donorAfter = (from: Seat): Seat | null => {
    for (let i = 1, x = nextSeat(from, n); i < n; i++, x = nextSeat(x, n)) if (!out[x] && hands[x]!.length > 0) return x;
    return null;
  };
  const label = `R-BH-2/draw/${h.trick_count}`;
  for (const seat of emptied) {
    // Pagat: the power holder draws before this trick's cards reach the pile, so they never redraw their own card.
    if (seat === power && !pickup && drawsFromWaste && waste.length > 0) {
      const drawn = handRandom(h.seed, label, draws).pick(waste);
      waste = removeOne(waste, drawn);
      hands[seat]!.push(drawn);
      voids[seat] = [];
      drawnLead = seat;
      events.push({ t: "DrewFromWaste", vis: "public", seat });
      events.push({ t: "DrewCard", vis: [seat], seat, card: drawn });
      continue;
    }
    if (seat === power && !pickup && rule === "drawFromNext") {
      const donor = donorAfter(power);
      if (donor !== null) {
        const drawn = handRandom(h.seed, label, draws).pick(hands[donor]!);
        hands[donor] = removeOne(hands[donor]!, drawn);
        // A card taken blind makes the donor's public cards uncertain again: nobody may deduce which one left.
        known[donor] = [];
        hands[seat]!.push(drawn);
        voids[seat] = [];
        drawnLead = seat;
        events.push({ t: "DrewFromNext", vis: "public", seat, from: donor });
        events.push({ t: "DrewCard", vis: [seat], seat, card: drawn });
        if (hands[donor]!.length === 0) markOut(donor);
        continue;
      }
    }
    // When everyone else still in also emptied their hand this trick, the power holder is the one left.
    if (seat === power && !out.some((o, x) => !o && x !== power && !emptied.includes(x))) continue;
    markOut(seat);
  }
  if (!pickup) {
    waste = [...waste, ...cards];
    discards = addDiscards(discards, cards, r.decks);
  }

  h.hands = hands.map(sortCards);
  h.known = known;
  h.voids = voids;
  h.waste = waste;
  h.discards = discards;
  h.out = out;
  h.finish_order = finishOrder;
  h.last_trick = { plays: h.trick.slice(), outcome: pickup ? "pickedUp" : "discarded", seat: power };
  h.trick = [];
  h.thulla = null;
  h.first_trick = false;
  h.drawn_lead = drawnLead;
  h.trick_count += 1;

  const active = activeSeats(out);
  if (active.length <= 1) { finishHand(s, h, active[0] ?? power, events); return; }
  if (h.trick_count >= r.max_tricks) {
    const most = active.reduce((a, b) => (hands[b]!.length > hands[a]!.length ? b : a));
    finishHand(s, h, most, events);
    return;
  }
  h.trick_order = orderFrom(power, n, out);
  h.turn = h.trick_order[0]!;
  events.push({ t: "PlayTurn", vis: "public", seat: h.turn });
}

function finishHand(s: Mut<BhabhiState>, h: Mut<BhabhiHand>, bhabhi: Seat, events: EngineEvent[]): void {
  const r = s.rules;
  const m = s.match as Mut<BhabhiMatch>;
  const result: BhabhiHandResult = { hand_id: h.hand_id, finish_order: h.finish_order.slice(), bhabhi };
  m.bhabhi_counts = m.bhabhi_counts.map((c, i) => (i === bhabhi ? c + 1 : c));
  m.place_totals = m.place_totals.map((total, seat) => {
    const place = h.finish_order.indexOf(seat);
    return total + (place >= 0 ? place + 1 : r.players);
  });
  m.results = [...m.results, result];
  m.hands_played += 1;
  m.next_dealer = nextSeat(h.dealer, r.players);
  h.phase = "DONE";
  events.push({ t: "HandFinished", vis: "public", hand_id: h.hand_id, result, bhabhi_counts: m.bhabhi_counts.slice() });
  events.push({ t: "HandRevealed", vis: "public", hand_id: h.hand_id, hands: h.dealt.map((x) => x.slice()) });
  const limitReached = r.bhabhi_limit > 0 && m.bhabhi_counts[bhabhi]! >= r.bhabhi_limit;
  if (m.hands_played >= r.rounds || limitReached) {
    m.over = true;
    m.placements = bhabhiPlacements(m.bhabhi_counts, m.place_totals);
    events.push({ t: "MatchOver", vis: "public", bhabhi_counts: m.bhabhi_counts.slice(), place_totals: m.place_totals.slice(), placements: m.placements.slice() });
  }
}

/** L35: fewest times Bhabhi wins; then lower summed finishing places; only a full tie shares a place. */
export function bhabhiPlacements(counts: readonly number[], placeTotals: readonly number[]): number[] {
  const keys = counts.map((c, i) => [c, placeTotals[i]!] as const);
  return rankBy(keys, (a, b) => (a[0] !== b[0] ? b[0] - a[0] : b[1] - a[1]));
}

export function waitingOn(state: BhabhiState): WaitingOn {
  const h = state.hand;
  if (state.match.over) return { mode: "NONE", seats: [] };
  if (!h || h.phase === "DONE") return { mode: "AUTO", seats: [] };
  return { mode: "TURN", seats: [h.turn] };
}

/* ───────────────────────── Projection ───────────────────────── */

export interface BhabhiHandView {
  readonly hand_id: string;
  readonly phase: BhabhiHand["phase"];
  readonly annulled: string | null;
  readonly dealer: Seat;
  readonly my_hand: readonly CardId[] | null;
  readonly counts: readonly number[];
  readonly known: readonly (readonly CardId[])[];
  readonly waste_count: number;
  readonly discards: readonly CardId[];
  readonly voids: readonly (readonly Suit[])[];
  readonly trick: readonly PlayedCard[];
  readonly trick_order: readonly Seat[];
  readonly turn: Seat | null;
  readonly thulla: PlayedCard | null;
  readonly first_trick: boolean;
  readonly drawn_lead: Seat | null;
  readonly last_trick: BhabhiLastTrick | null;
  readonly trick_count: number;
  readonly out: readonly boolean[];
  readonly finish_order: readonly Seat[];
  readonly revealed_hands: readonly (readonly CardId[])[] | null;
}

export interface BhabhiView extends BaseView {
  readonly game: "bhabhi";
  readonly rules: BhabhiRules;
  readonly match: BhabhiMatch;
  readonly hand: BhabhiHandView | null;
}

export function project(state: BhabhiState, viewer: Viewer): BhabhiView {
  const seat = viewerSeat(viewer);
  const h = state.hand;
  const hv: BhabhiHandView | null = h === null ? null : {
    hand_id: h.hand_id, phase: h.phase, annulled: h.annulled, dealer: h.dealer,
    my_hand: seat === null ? null : h.hands[seat]!.slice(), counts: h.hands.map((x) => x.length),
    known: h.known.map((k) => k.slice()), waste_count: h.waste.length, discards: h.discards.slice(), voids: h.voids.map((v) => v.slice()),
    trick: h.trick.slice(), trick_order: h.trick_order.slice(), turn: h.phase === "DONE" ? null : h.turn, thulla: h.thulla,
    first_trick: h.first_trick, drawn_lead: h.drawn_lead, last_trick: h.last_trick, trick_count: h.trick_count,
    out: h.out.slice(), finish_order: h.finish_order.slice(),
    revealed_hands: h.phase === "DONE" && !h.annulled ? h.dealt.map((x) => x.slice()) : null,
  };
  const base = { v: 1 as const, game: "bhabhi" as const, viewer, rules: state.rules, match: state.match, hand: hv, waiting: waitingOn(state), legal: [] as SeatMove[] };
  return { ...base, legal: legalFromView(base) };
}

function legalFor(r: BhabhiRules, h: { phase: string; trick: readonly PlayedCard[]; drawn_lead: Seat | null; out: readonly boolean[]; turn: Seat | null; first_trick: boolean }, hand: readonly CardId[], seat: Seat): SeatMove[] {
  if (h.phase !== "PLAY") return [];
  const moves: SeatMove[] = canTake(r, h as BhabhiHand, seat) ? [{ t: "Take" }] : [];
  if (seat !== h.turn) return moves;
  const first = h.trick[0];
  let cards: readonly CardId[];
  if (!first) cards = h.first_trick && hand.includes(ACE_OF_SPADES) ? [ACE_OF_SPADES] : hand;
  else {
    const followers = cardsOfSuit(hand, suitOf(first.card));
    cards = followers.length > 0 ? followers : hand;
  }
  for (const card of new Set(cards)) moves.push({ t: "Play", card }); // two identical cards are one choice
  return moves;
}

export function legalFromView(view: Omit<BhabhiView, "legal"> | BhabhiView): SeatMove[] {
  const seat = viewerSeat(view.viewer);
  const h = view.hand;
  if (seat === null || view.viewer.kind === "post_hand_participant" || !h || !h.my_hand || view.match.over) return [];
  return legalFor(view.rules, h, h.my_hand, seat);
}

export function legalServer(state: BhabhiState, seat: Seat): SeatMove[] {
  const h = state.hand;
  if (!h || state.match.over) return [];
  return legalFor(state.rules, h, h.hands[seat]!, seat);
}

export function explain(view: BhabhiView, move: SeatMove): RuleErrorCode | null {
  if (view.legal.some((x) => JSON.stringify(x) === JSON.stringify(move))) return null;
  if (view.match.over) return "MATCH_OVER";
  const h = view.hand;
  const seat = viewerSeat(view.viewer);
  if (!h || !h.my_hand || seat === null || h.phase !== "PLAY") return "WRONG_PHASE";
  if (move.t === "Take") return view.rules.take_hand ? "WRONG_PHASE" : "INVALID_ACTION";
  if (move.t !== "Play") return "INVALID_ACTION";
  if (h.turn !== seat) return "NOT_YOUR_TURN";
  if (!h.my_hand.includes(move.card)) return "CARD_NOT_IN_HAND";
  const first = h.trick[0];
  if (!first) return h.first_trick && h.my_hand.includes(ACE_OF_SPADES) ? "MUST_LEAD_ACE_OF_SPADES" : "INVALID_ACTION";
  return "MUST_FOLLOW_SUIT";
}

export function visibleCardIds(state: BhabhiState, viewer: Viewer): Set<CardId> {
  const out = new Set<CardId>();
  const h = state.hand;
  if (!h) return out;
  const seat = viewerSeat(viewer);
  if (seat !== null) for (const c of h.hands[seat]!) out.add(c);
  for (const k of h.known) for (const c of k) out.add(c);
  for (const c of h.discards) out.add(c);
  for (const p of h.trick) out.add(p.card);
  for (const p of h.last_trick?.plays ?? []) out.add(p.card);
  if (h.phase === "DONE" && !h.annulled) for (const x of h.dealt) for (const c of x) out.add(c);
  return out;
}

export function conservationHolds(state: BhabhiState): boolean {
  const h = state.hand;
  if (!h) return true;
  return sameCards([...h.hands.flat(), ...h.waste, ...h.trick.map((p) => p.card)], deckFor(state.rules));
}

/* ───────────────────────── Bots ───────────────────────── */

export function determinize(view: BhabhiView, rng: BotRandom): BhabhiState {
  const h = view.hand;
  const seat = viewerSeat(view.viewer) ?? 0;
  if (!h) return { v: 1, game: "bhabhi", rules: view.rules, match: view.match, hand: null };
  const mine = h.my_hand ?? [];
  const othersKnown = h.known.flatMap((k, i) => (i === seat ? [] : k));
  const unseen = removeEach(deckFor(view.rules), [...mine, ...othersKnown, ...h.trick.map((p) => p.card)]);
  const counts = [...h.counts.map((n, i) => (i === seat ? 0 : n - h.known[i]!.length)), h.waste_count];
  const voids = [...h.voids.map((suits, i) => (i === seat ? [] : suits)), []];
  const sampled = sampleHiddenHands(rng, unseen, counts, voids);
  const n = view.rules.players;
  return {
    v: 1, game: "bhabhi", rules: view.rules, match: view.match,
    hand: {
      hand_id: h.hand_id, seed: rng.hex32(), phase: h.phase, annulled: h.annulled, dealer: h.dealer,
      hands: h.counts.map((_, i) => (i === seat ? mine.slice() : sortCards([...h.known[i]!, ...sampled[i]!]))),
      dealt: [], known: h.known.map((k) => k.slice()), waste: sampled[n]!, discards: h.discards.slice(), voids: h.voids.map((v) => v.slice()),
      trick: h.trick.slice(), trick_order: h.trick_order.slice(), turn: h.turn ?? 0, thulla: h.thulla, first_trick: h.first_trick,
      drawn_lead: h.drawn_lead, last_trick: h.last_trick, trick_count: h.trick_count, out: h.out.slice(), finish_order: h.finish_order.slice(),
      actions: 0,
    },
  };
}

export function utility(state: BhabhiState, seat: Seat, handId: string): number {
  const n = state.rules.players;
  const result = state.match.results.find((x) => x.hand_id === handId);
  if (result) {
    if (result.bhabhi === seat) return -1;
    return 1 - result.finish_order.indexOf(seat) / Math.max(1, n - 1);
  }
  const h = state.hand;
  if (!h || h.hand_id !== handId) return 0;
  if (h.out[seat]) return 1 - h.finish_order.indexOf(seat) / Math.max(1, n - 1);
  const counts = h.hands.map((x) => x.length);
  const others = counts.filter((_, i) => i !== seat && !h.out[i]);
  const avg = others.length ? others.reduce((a, b) => a + b, 0) / others.length : 0;
  return Math.max(-1, Math.min(1, (avg - counts[seat]!) / 20));
}

/** Does winning this trick with my last card keep me in the hand? Read from the rules, never assumed. */
function winningWithLastCardKeepsMeIn(v: BhabhiView): boolean {
  switch (v.rules.power_holder_empty) {
    case "drawFromWaste":
    case "drawFromNext":
      return true;
    case "escapeIfThreePlus":
      return (v.hand?.out ?? []).filter((o) => !o).length === 2;
    case "passToNext":
      return false;
  }
}

/** v1 Medium: lead low in a safe long suit; follow just under the top when someone could still cut; never take blindly. */
export function mediumMove(view: BhabhiView, legal: readonly SeatMove[]): SeatMove | null {
  const h = view.hand;
  if (!h || !h.my_hand) return null;
  const seat = viewerSeat(view.viewer) ?? 0;
  const cards = legal.flatMap((x) => (x.t === "Play" ? [x.card] : []));
  if (cards.length === 0) return null; // only Take is legal: bots never take a hand blindly (L33)
  const play = (card: CardId): SeatMove => ({ t: "Play", card });
  const first = h.trick[0];
  const active = (x: number) => !h.out[x] && x !== seat;
  if (!first) {
    const suits = (["S", "H", "D", "C"] as const).filter((x) => cardsOfSuit(cards, x).length > 0);
    const risky = (suit: Suit) => h.voids.some((voids, x) => active(x) && voids.includes(suit));
    const score = (suit: Suit) => cardsOfSuit(h.my_hand!, suit).length - (risky(suit) ? 100 : 0);
    const best = suits.reduce((a, b) => (score(b) > score(a) ? b : a));
    return play(lowest(cardsOfSuit(cards, best))!);
  }
  const led = suitOf(first.card);
  if (suitOf(cards[0]!) !== led) {
    const suitSize = (c: CardId) => cardsOfSuit(h.my_hand!, suitOf(c)).length;
    const pick = cards.reduce((a, b) => {
      const byRank = rankValueOf(b) - rankValueOf(a);
      return byRank > 0 || (byRank === 0 && suitSize(b) < suitSize(a)) ? b : a;
    });
    return play(pick);
  }
  const top = Math.max(...h.trick.filter((p) => suitOf(p.card) === led).map((p) => rankValueOf(p.card)));
  const played = new Set(h.trick.map((p) => p.seat));
  const toPlay = h.trick_order.filter((x) => x !== seat && !played.has(x));
  const lastCard = h.my_hand.length === 1;
  const under = cards.filter((c) => rankValueOf(c) < top);
  if (toPlay.length === 0 && !(lastCard && winningWithLastCardKeepsMeIn(view))) return play(highest(cards)!);
  return play(highest(under) ?? highest(cards)!);
}

export const bhabhi: GameModule<BhabhiState, BhabhiView, BhabhiRules> = {
  id: "bhabhi",
  seatCount: (r) => r.players,
  initialState,
  rulesOf: (s) => s.rules,
  step,
  waitingOn,
  project,
  legalFromView,
  legalServer,
  explain,
  projectEvents: projectEventsFor,
  visibleCardIds,
  toAction: (move, seat, handId) => toSeatAction(move, seat, handId),
  conservationHolds,
  handInfo: (s) => (s.hand ? { hand_id: s.hand.hand_id, done: s.hand.phase === "DONE", annulled: s.hand.annulled } : null),
  summary: (s) => ({ over: s.match.over, hands_played: s.match.hands_played, totals: s.match.bhabhi_counts, placements: s.match.placements }),
  determinize,
  utility,
  medium: mediumMove,
  cardsLeft: (v) => (v.hand ? v.hand.counts.reduce((a, b) => a + b, 0) : 52 * v.rules.decks),
};
