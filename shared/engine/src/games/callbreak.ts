/**
 * Callbreak family reducer — profiles callbreak.np@1 and callbridge.bd@1 (01_GAME_RULES.md §1.3).
 * Pure and total: step(state, action) never throws for a well-typed state; bad input is rejected.
 * Legality is computed only from the actor's SeatView (P-11, C-06).
 */
import { type CardId, isCardId, rankValue, sortCards, std52, suitOf, type Suit, SUITS } from "../core/cards.js";
import { DrawStream, type DrawRecord } from "../core/rng.js";
import { type Direction, nextSeat, seatsFrom } from "../core/seats.js";
import { type BotRandom, sampleHiddenHands } from "../core/botrng.js";
import { type PlayedCard as TrickPlay, cardsOfSuit, inferVoids, lowest, trickWinner } from "../families/trick-taking.js";
import { type GameModule, projectEventsFor, rankBy, toSeatAction } from "../core/contract.js";
import type {
  Action, EngineEvent, RejectCode, RuleErrorCode, Seat, SeatMove, StepResult, Viewer, WaitingOn,
} from "../core/types.js";

/* ───────────────────────── Rules (compiled effective profile) ───────────────────────── */

export interface CallbreakRules {
  readonly profile_id: string;
  readonly seats: 4;
  readonly direction: Direction;
  readonly dealer_rotation: Direction;
  readonly trump: Suit;
  readonly call_min: number;
  readonly call_max: number;
  /** must beat the current winning card of the led suit when able (G-12 decision: on) */
  readonly must_beat: boolean;
  /** when void: must play a trump if it would become the winner, otherwise any card (G-13 decision) */
  readonly trump_if_winning: boolean;
  /** CB-05: the first lead of a hand may not be a trump unless the leader holds only trumps */
  readonly first_lead_no_trump: boolean;
  /** W-CB-1 redeal on request (CB-04 turns it off) */
  readonly redeal_on_request: boolean;
  /** CB-03: annul when the call total is below this number; 0 = off */
  readonly low_call_sum: number;
  /** G-15 decision: after this many consecutive annulments the next deal is played as dealt */
  readonly redeal_cap: number;
  readonly scoring: "callbreak" | "callbridge";
  /** CB-08: "full" = −10×call, "shortfall" = −10×(call − tricks) */
  readonly failure: "full" | "shortfall";
  /** Call Bridge: a made call ≥ bonus_call scores bonus_score (tenths) instead of 10×call */
  readonly bonus_call: number;
  readonly bonus_score: number;
  /** v1 Classic: each trick above the call adds 0.1 (1 tenth). Off in the v1 "Call Bridge" preset. */
  readonly overtrick_bonus: boolean;
  /** v1 default: any hand without a trump is redealt automatically (same dealer, capped at 50 redeals). */
  readonly auto_redeal_no_trump: boolean;
  /** CB-11 / G-58 */
  readonly rounds: number;
  /** G-14 decision: equal totals share a placement (standard competition ranking 1-2-2-4) */
  readonly tie: "shared";
  /** G-57 decision: action cap per hand and its outcome */
  readonly max_actions_per_hand: number;
  readonly guard_outcome: "annul";
  /** Shell timing (engine never reads these as time; they are data for the shell) */
  readonly turn_ms: number;
  readonly window_ms: number;
}

export const HAND_SIZE = 13;
export const SEATS = 4;

/* ───────────────────────── State ───────────────────────── */

export interface PlayedCard { readonly seat: Seat; readonly card: CardId }
export interface HandSummary {
  readonly hand_id: string;
  readonly calls: readonly number[];
  readonly tricks: readonly number[];
  readonly deltas: readonly number[];
}

export interface HandState {
  readonly hand_id: string;
  /** server-only: never projected (L-12, C-04) */
  readonly seed: string;
  readonly phase: "WINDOW" | "CALL" | "PLAY" | "DONE";
  readonly annulled: string | null;
  readonly dealer: Seat;
  readonly hands: readonly (readonly CardId[])[];
  readonly calls: readonly (number | null)[];
  readonly turn: Seat;
  readonly leader: Seat;
  readonly trick: readonly PlayedCard[];
  readonly trick_no: number;
  readonly tricks: readonly number[];
  readonly played: readonly CardId[];
  readonly last_trick: readonly PlayedCard[] | null;
  readonly last_trick_winner: Seat | null;
  /** completed tricks in order (public) */
  readonly history: readonly (readonly PlayedCard[])[];
  /** automatic no-trump redeals before this deal stood (v1 rule) */
  readonly redeals: number;
  /** sealed until the window closes */
  readonly redeal_requests: readonly Seat[];
  readonly revealed: readonly { readonly seat: Seat; readonly cards: readonly CardId[] }[];
  readonly actions: number;
}

export interface MatchState {
  readonly hands_played: number;
  readonly dealer: Seat; // -1 before the first hand
  readonly totals: readonly number[];
  readonly redeal_streak: number;
  readonly over: boolean;
  readonly placements: readonly number[] | null;
  readonly history: readonly HandSummary[];
}

export interface CallbreakState {
  readonly v: 1;
  readonly rules: CallbreakRules;
  readonly match: MatchState;
  readonly hand: HandState | null;
}

export function initialState(rules: CallbreakRules): CallbreakState {
  return {
    v: 1,
    rules,
    match: { hands_played: 0, dealer: -1, totals: [0, 0, 0, 0], redeal_streak: 0, over: false, placements: null, history: [] },
    hand: null,
  };
}

/* ───────────────────────── Pure rule functions ───────────────────────── */

/** Index of the currently winning card in a trick (P-12, trump activation immediate). */
export function winningIndex(trick: readonly PlayedCard[], trump: Suit): number {
  if (trick.length === 0) return -1;
  const led = suitOf(trick[0]!.card);
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const c = trick[i]!.card;
    const b = trick[best]!.card;
    const cs = suitOf(c);
    const bs = suitOf(b);
    if (cs === bs) { if (rankValue(c) > rankValue(b)) best = i; }
    else if (cs === trump && bs !== trump) best = i;
    else if (cs === led && bs !== trump && bs !== led) best = i;
  }
  return best;
}

/** Would `card` become the winner if added to `trick`? */
export function wouldWin(trick: readonly PlayedCard[], card: CardId, trump: Suit): boolean {
  const next = [...trick, { seat: -1, card }];
  return winningIndex(next, trump) === next.length - 1;
}

/**
 * Legal cards from one seat's hand given public trick state.
 * Reads only the seat's own cards and public data, so it is safe on a SeatView.
 */
export function legalPlays(
  hand: readonly CardId[],
  trick: readonly PlayedCard[],
  rules: CallbreakRules,
  trickNo: number,
): CardId[] {
  const trump = rules.trump;
  if (hand.length === 0) return [];
  if (trick.length === 0) {
    if (rules.first_lead_no_trump && trickNo === 1) {
      const nonTrump = hand.filter((c) => suitOf(c) !== trump);
      if (nonTrump.length > 0) return sortCards(nonTrump);
    }
    return sortCards(hand);
  }
  const led = suitOf(trick[0]!.card);
  const winner = trick[winningIndex(trick, trump)]!.card;
  const following = hand.filter((c) => suitOf(c) === led);
  if (following.length > 0) {
    if (rules.must_beat) {
      // compared with the CURRENT winner: a trump already in the trick voids the led-suit obligation
      const winnerIsLedSuit = suitOf(winner) === led;
      if (winnerIsLedSuit) {
        const beating = following.filter((c) => rankValue(c) > rankValue(winner));
        if (beating.length > 0) return sortCards(beating);
      }
    }
    return sortCards(following);
  }
  if (rules.trump_if_winning) {
    const winningTrumps = hand.filter((c) => suitOf(c) === trump && wouldWin(trick, c, trump));
    if (winningTrumps.length > 0) return sortCards(winningTrumps);
  }
  return sortCards(hand); // G-13 decision: a void seat whose trumps cannot win may play any card
}

export function redealEligible(hand: readonly CardId[], trump: Suit): boolean {
  const hasTrump = hand.some((c) => suitOf(c) === trump);
  const hasHonour = hand.some((c) => rankValue(c) >= 11);
  return !hasTrump || !hasHonour;
}

export function scoreHand(rules: CallbreakRules, call: number, tricks: number): number {
  if (rules.scoring === "callbreak") {
    if (tricks >= call) return 10 * call + (rules.overtrick_bonus === false ? 0 : tricks - call);
    return rules.failure === "shortfall" ? -10 * (call - tricks) : -10 * call;
  }
  const made = tricks === call || tricks === call + 1;
  if (made) return rules.bonus_call > 0 && call >= rules.bonus_call ? rules.bonus_score : 10 * call;
  return -10 * call;
}

/** Standard competition ranking; equal totals share a placement (G-14 decision). */
export function placements(totals: readonly number[]): number[] {
  return totals.map((t) => 1 + totals.filter((u) => u > t).length);
}

/* ───────────────────────── step ───────────────────────── */

type Mut<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] };
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

const reject = (code: RejectCode): StepResult<CallbreakState> => ({ ok: false, code });

function validSchema(a: unknown): a is Action {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  if (typeof x.t !== "string" || typeof x.hand_id !== "string" || x.hand_id.length === 0 || x.hand_id.length > 64) return false;
  const seatActor = typeof x.actor === "number" && Number.isInteger(x.actor) && x.actor >= 0 && x.actor < SEATS;
  switch (x.t) {
    case "BeginHand": return x.actor === "system" && typeof x.hand_seed === "string" && /^[0-9a-f]{64}$/.test(x.hand_seed);
    case "CloseWindow": return x.actor === "system";
    case "Timeout": return x.actor === "system" && typeof x.seat === "number" && Number.isInteger(x.seat) && x.seat >= 0 && x.seat < SEATS;
    case "RequestRedeal": return seatActor;
    case "Call": return seatActor && typeof x.n === "number" && Number.isInteger(x.n);
    case "Play": return seatActor && isCardId(x.card);
    default: return false;
  }
}

export function step(state: CallbreakState, action: unknown): StepResult<CallbreakState> {
  if (!validSchema(action)) return reject("BAD_SCHEMA");
  if (state.match.over) return reject("MATCH_OVER");
  const s = clone(state) as Mut<CallbreakState>;
  const events: EngineEvent[] = [];
  const draws: DrawRecord[] = [];
  const r = s.rules;

  if (action.t === "BeginHand") {
    if (s.hand && s.hand.phase !== "DONE") return reject("NOT_NOW");
    const match = s.match as Mut<MatchState>;
    let dealer = match.dealer;
    if (dealer < 0) dealer = new DrawStream(action.hand_seed, "first_dealer", draws).below(SEATS);
    match.dealer = dealer;
    const order = seatsFrom(nextSeat(dealer, SEATS, r.direction), SEATS, r.direction);
    const shuffleStream = new DrawStream(action.hand_seed, "R-CB-1/shuffle", draws);
    let sorted: CardId[][] = [];
    let redeals = 0;
    for (;;) {
      const deck = shuffleStream.shuffle(std52());
      const hands: CardId[][] = [[], [], [], []];
      for (let i = 0; i < deck.length; i++) hands[order[i % SEATS]!]!.push(deck[i]!);
      sorted = hands.map(sortCards);
      const missing = sorted.some((h) => !h.some((c) => suitOf(c) === r.trump));
      if (!r.auto_redeal_no_trump || !missing || redeals >= 50) break;
      redeals += 1;
    }
    const windowOn = r.redeal_on_request && match.redeal_streak < r.redeal_cap;
    const first = nextSeat(dealer, SEATS, r.direction);
    s.hand = {
      hand_id: action.hand_id, seed: action.hand_seed, phase: windowOn ? "WINDOW" : "CALL", annulled: null, dealer,
      hands: sorted, calls: [null, null, null, null], turn: first, leader: first, trick: [], trick_no: 1,
      tricks: [0, 0, 0, 0], played: [], last_trick: null, last_trick_winner: null, history: [], redeals, redeal_requests: [], revealed: [], actions: 1,
    };
    events.push({ t: "HandStarted", vis: "public", hand_id: action.hand_id, dealer, hand_index: match.hands_played, redeals });
    for (let seat = 0; seat < SEATS; seat++) events.push({ t: "Dealt", vis: [seat], seat, cards: sorted[seat]! });
    events.push({ t: "DealtCounts", vis: "public", counts: [HAND_SIZE, HAND_SIZE, HAND_SIZE, HAND_SIZE] });
    if (windowOn) events.push({ t: "WindowOpened", vis: "public", window: "W-CB-1", fixed_duration: true });
    else events.push({ t: "CallTurn", vis: "public", seat: first });
    return { ok: true, state: s as CallbreakState, events, draws };
  }

  const h = s.hand as Mut<HandState> | null;
  if (!h || h.phase === "DONE") return reject("NOT_NOW");
  if (action.hand_id !== h.hand_id) return reject("WRONG_HAND");
  h.actions += 1;

  switch (action.t) {
    case "CloseWindow": {
      if (h.phase !== "WINDOW") return reject("NOT_NOW");
      if (h.redeal_requests.length > 0) {
        const revealed = sortSeats(h.redeal_requests).map((seat) => ({ seat, cards: h.hands[seat]!.slice() }));
        annul(s, h, "redeal_request", events, revealed);
      } else {
        h.phase = "CALL";
        events.push({ t: "WindowClosed", vis: "public", window: "W-CB-1" });
        events.push({ t: "CallTurn", vis: "public", seat: h.turn });
      }
      break;
    }
    case "Timeout": {
      if ((h.phase !== "CALL" && h.phase !== "PLAY") || action.seat !== h.turn) return reject("NOT_NOW");
      events.push({ t: "TurnTimedOut", vis: "public", seat: action.seat });
      break;
    }
    case "RequestRedeal": {
      if (h.phase !== "WINDOW") return reject("NOT_NOW");
      const seat = action.actor;
      if (h.redeal_requests.includes(seat) || !redealEligible(h.hands[seat]!, r.trump)) return reject("ILLEGAL_ACTION");
      h.redeal_requests = sortSeats([...h.redeal_requests, seat]);
      // Only the requester learns the request was recorded; the window never closes early (P-16 hidden eligibility).
      events.push({ t: "RedealRequestRecorded", vis: [seat], seat });
      break;
    }
    case "Call": {
      if (h.phase !== "CALL") return reject("NOT_NOW");
      if (action.actor !== h.turn) return reject("NOT_YOUR_TURN");
      if (action.n < r.call_min || action.n > r.call_max) return reject("ILLEGAL_ACTION");
      h.calls[action.actor] = action.n;
      events.push({ t: "Called", vis: "public", seat: action.actor, n: action.n });
      if (h.calls.every((c) => c !== null)) {
        const sum = (h.calls as number[]).reduce((a, b) => a + b, 0);
        if (r.low_call_sum > 0 && sum < r.low_call_sum && s.match.redeal_streak < r.redeal_cap) {
          annul(s, h, "low_call_sum", events, []);
        } else {
          h.phase = "PLAY";
          h.turn = nextSeat(h.dealer, SEATS, r.direction);
          h.leader = h.turn;
          events.push({ t: "PlayTurn", vis: "public", seat: h.turn, trick_no: 1 });
        }
      } else {
        h.turn = nextSeat(h.turn, SEATS, r.direction);
        events.push({ t: "CallTurn", vis: "public", seat: h.turn });
      }
      break;
    }
    case "Play": {
      if (h.phase !== "PLAY") return reject("NOT_NOW");
      if (action.actor !== h.turn) return reject("NOT_YOUR_TURN");
      const hand = h.hands[action.actor]!;
      if (!legalPlays(hand, h.trick, r, h.trick_no).includes(action.card)) return reject("ILLEGAL_ACTION");
      (h.hands as CardId[][])[action.actor] = hand.filter((c) => c !== action.card);
      h.trick = [...h.trick, { seat: action.actor, card: action.card }];
      h.played = [...h.played, action.card];
      events.push({ t: "CardPlayed", vis: "public", seat: action.actor, card: action.card });
      if (h.trick.length === SEATS) {
        const winner = h.trick[winningIndex(h.trick, r.trump)]!.seat;
        (h.tricks as number[])[winner] = h.tricks[winner]! + 1;
        events.push({ t: "TrickWon", vis: "public", seat: winner, trick_no: h.trick_no, cards: h.trick.map((p) => p.card) });
        h.last_trick = h.trick;
        h.last_trick_winner = winner;
        h.history = [...h.history, h.trick];
        h.trick = [];
        h.trick_no += 1;
        h.turn = winner;
        h.leader = winner;
        if (h.trick_no > HAND_SIZE) finishHand(s, h, events);
        else events.push({ t: "PlayTurn", vis: "public", seat: winner, trick_no: h.trick_no });
      } else {
        h.turn = nextSeat(h.turn, SEATS, r.direction);
        events.push({ t: "PlayTurn", vis: "public", seat: h.turn, trick_no: h.trick_no });
      }
      break;
    }
    default:
      return reject("BAD_SCHEMA");
  }

  if ((h.phase as HandState["phase"]) !== "DONE" && h.actions > r.max_actions_per_hand) {
    events.push({ t: "GuardTripped", vis: "public", hand_id: h.hand_id });
    annul(s, h, "guard", events, []);
  }
  return { ok: true, state: s as CallbreakState, events, draws };
}

function sortSeats(xs: readonly Seat[]): Seat[] { return xs.slice().sort((a, b) => a - b); }

function annul(
  s: Mut<CallbreakState>, h: Mut<HandState>, reason: string, events: EngineEvent[],
  revealed: { seat: Seat; cards: CardId[] }[],
): void {
  h.phase = "DONE";
  h.annulled = reason;
  h.revealed = revealed;
  const m = s.match as Mut<MatchState>;
  if (reason !== "guard") m.redeal_streak += 1;
  events.push({ t: "HandAnnulled", vis: "public", hand_id: h.hand_id, reason, revealed });
}

function finishHand(s: Mut<CallbreakState>, h: Mut<HandState>, events: EngineEvent[]): void {
  const r = s.rules;
  const m = s.match as Mut<MatchState>;
  const calls = h.calls as number[];
  const deltas = calls.map((c, i) => scoreHand(r, c, h.tricks[i]!));
  m.totals = m.totals.map((t, i) => t + deltas[i]!);
  m.history = [...m.history, { hand_id: h.hand_id, calls, tricks: h.tricks.slice(), deltas }];
  m.hands_played += 1;
  m.redeal_streak = 0;
  m.dealer = nextSeat(h.dealer, SEATS, r.dealer_rotation);
  h.phase = "DONE";
  events.push({ t: "HandScored", vis: "public", hand_id: h.hand_id, calls, tricks: h.tricks.slice(), deltas, totals: m.totals.slice() });
  if (m.hands_played >= r.rounds) {
    m.over = true;
    m.placements = placements(m.totals);
    events.push({ t: "MatchOver", vis: "public", totals: m.totals.slice(), placements: m.placements.slice() });
  }
}

/* ───────────────────────── Scheduler (P-07) ───────────────────────── */

export function waitingOn(state: CallbreakState): WaitingOn {
  const h = state.hand;
  if (state.match.over) return { mode: "NONE", seats: [] };
  if (!h || h.phase === "DONE") return { mode: "AUTO", seats: [] };
  if (h.phase === "WINDOW") return { mode: "WINDOW", seats: [0, 1, 2, 3], window: "W-CB-1", fixed_duration: true };
  return { mode: "TURN", seats: [h.turn] };
}

/* ───────────────────────── Projection (P-05) ───────────────────────── */

export interface HandView {
  readonly hand_id: string;
  readonly phase: HandState["phase"];
  readonly annulled: string | null;
  readonly dealer: Seat;
  readonly my_hand: readonly CardId[] | null;
  readonly counts: readonly number[];
  readonly calls: readonly (number | null)[];
  readonly turn: Seat | null;
  readonly leader: Seat;
  readonly trick: readonly PlayedCard[];
  readonly trick_no: number;
  readonly tricks: readonly number[];
  readonly played: readonly CardId[];
  readonly last_trick: readonly PlayedCard[] | null;
  readonly last_trick_winner: Seat | null;
  readonly history: readonly (readonly PlayedCard[])[];
  readonly window: { readonly id: "W-CB-1"; readonly fixed_duration: true } | null;
  readonly my_redeal_requested: boolean;
  readonly revealed: readonly { readonly seat: Seat; readonly cards: readonly CardId[] }[];
}

export interface CallbreakView {
  readonly v: 1;
  readonly game: "callbreak";
  readonly viewer: Viewer;
  readonly rules: CallbreakRules;
  readonly match: MatchState;
  readonly hand: HandView | null;
  readonly waiting: WaitingOn;
  readonly legal: readonly SeatMove[];
}

function viewerSeat(v: Viewer): Seat | null {
  return v.kind === "seat" || v.kind === "handover_bot" || v.kind === "post_hand_participant" ? v.seat : null;
}

/** Project without legal moves, then derive legal moves from that view alone. */
export function project(state: CallbreakState, viewer: Viewer): CallbreakView {
  const seat = viewerSeat(viewer);
  const h = state.hand;
  const hv: HandView | null = h === null ? null : {
    hand_id: h.hand_id,
    phase: h.phase,
    annulled: h.annulled,
    dealer: h.dealer,
    my_hand: seat === null ? null : h.hands[seat]!.slice(),
    counts: h.hands.map((x) => x.length),
    calls: h.calls.slice(),
    turn: h.phase === "CALL" || h.phase === "PLAY" ? h.turn : null,
    leader: h.leader,
    trick: h.trick.slice(),
    trick_no: h.trick_no,
    tricks: h.tricks.slice(),
    played: h.played.slice(),
    last_trick: h.last_trick,
    last_trick_winner: h.last_trick_winner,
    history: h.history,
    window: h.phase === "WINDOW" ? { id: "W-CB-1", fixed_duration: true } : null,
    my_redeal_requested: seat !== null && h.phase === "WINDOW" && h.redeal_requests.includes(seat),
    revealed: h.revealed,
  };
  const base = { v: 1 as const, game: "callbreak" as const, viewer, rules: state.rules, match: state.match, hand: hv, waiting: waitingOn(state), legal: [] as SeatMove[] };
  return { ...base, legal: legalFromView(base) };
}

/** P-11: legal moves from a SeatView only. */
export function legalFromView(view: Omit<CallbreakView, "legal"> | CallbreakView): SeatMove[] {
  const seat = viewerSeat(view.viewer);
  const h = view.hand;
  if (seat === null || view.viewer.kind === "post_hand_participant" || !h || !h.my_hand || view.match.over) return [];
  const r = view.rules;
  if (h.phase === "WINDOW") {
    return !h.my_redeal_requested && redealEligible(h.my_hand, r.trump) ? [{ t: "RequestRedeal" }] : [];
  }
  if (h.turn !== seat) return [];
  if (h.phase === "CALL") {
    const out: SeatMove[] = [];
    for (let n = r.call_min; n <= r.call_max; n++) out.push({ t: "Call", n });
    return out;
  }
  if (h.phase === "PLAY") return legalPlays(h.my_hand, h.trick, r, h.trick_no).map((card) => ({ t: "Play", card }));
  return [];
}

/** Server-side legality computed from full state (used only to prove view-legality equivalence, PR-03). */
export function legalServer(state: CallbreakState, seat: Seat): SeatMove[] {
  const h = state.hand;
  if (!h || state.match.over || h.phase === "DONE") return [];
  const r = state.rules;
  const hand = h.hands[seat]!;
  if (h.phase === "WINDOW") return !h.redeal_requests.includes(seat) && redealEligible(hand, r.trump) ? [{ t: "RequestRedeal" }] : [];
  if (h.turn !== seat) return [];
  if (h.phase === "CALL") {
    const out: SeatMove[] = [];
    for (let n = r.call_min; n <= r.call_max; n++) out.push({ t: "Call", n });
    return out;
  }
  return legalPlays(hand, h.trick, r, h.trick_no).map((card) => ({ t: "Play", card }));
}

/** Card identities this viewer may know right now (L-14 projection guard input). */
export function visibleCardIds(state: CallbreakState, viewer: Viewer): Set<CardId> {
  const out = new Set<CardId>();
  const h = state.hand;
  if (!h) return out;
  const seat = viewerSeat(viewer);
  if (seat !== null) for (const c of h.hands[seat]!) out.add(c);
  for (const c of h.played) out.add(c);
  for (const rv of h.revealed) for (const c of rv.cards) out.add(c);
  return out;
}

/** Events a viewer may receive (P-05). */
export function projectEvents(events: readonly EngineEvent[], viewer: Viewer): EngineEvent[] {
  return projectEventsFor(events, viewer);
}

/** Build a SeatMove into a full engine action for a seat. */
export function toAction(move: SeatMove, seat: Seat, handId: string): Action {
  return toSeatAction(move, seat, handId);
}

/** PR-01 card conservation: every card in exactly one of hands ∪ played. */
export function conservationHolds(state: CallbreakState): boolean {
  const h = state.hand;
  if (!h) return true;
  const all = [...h.hands.flat(), ...h.played];
  return all.length === 52 && new Set(all).size === 52;
}

/* ───────────────────────── Explanations, bots, module ───────────────────────── */

/** Why a move is illegal (null when legal), from the viewer's own SeatView only. */
export function explain(view: CallbreakView, move: SeatMove): RuleErrorCode | null {
  if (view.legal.some((m) => JSON.stringify(m) === JSON.stringify(move))) return null;
  if (view.match.over) return "MATCH_OVER";
  const h = view.hand;
  const seat = view.viewer.kind === "seat" || view.viewer.kind === "handover_bot" ? view.viewer.seat : null;
  if (!h || !h.my_hand || seat === null) return "WRONG_PHASE";
  const r = view.rules;
  if (move.t === "RequestRedeal") return h.phase === "WINDOW" ? "INVALID_ACTION" : "WRONG_PHASE";
  if (move.t === "Call") {
    if (h.phase !== "CALL") return "WRONG_PHASE";
    if (h.turn !== seat) return "NOT_YOUR_TURN";
    return "CALL_OUT_OF_RANGE";
  }
  if (move.t !== "Play") return "INVALID_ACTION";
  if (h.phase !== "PLAY") return "WRONG_PHASE";
  if (h.turn !== seat) return "NOT_YOUR_TURN";
  if (!h.my_hand.includes(move.card)) return "CARD_NOT_IN_HAND";
  if (h.trick.length === 0) return r.first_lead_no_trump && h.trick_no === 1 ? "MUST_NOT_LEAD_TRUMP" : "INVALID_ACTION";
  const led = suitOf(h.trick[0]!.card);
  if (h.my_hand.some((c) => suitOf(c) === led)) return suitOf(move.card) === led ? "MUST_BEAT" : "MUST_FOLLOW_SUIT";
  return suitOf(move.card) === r.trump ? "MUST_OVERTRUMP" : "MUST_TRUMP";
}

/** Expected tricks from a hand, spades trump (v1 Medium estimate). */
export function estimateCallbreakTricks(hand: readonly CardId[], trump: Suit = "S"): number {
  let tricks = 0;
  const trumps = cardsOfSuit(hand, trump);
  for (const suit of ["S", "H", "D", "C"] as const) {
    const cards = cardsOfSuit(hand, suit);
    const has = (rk: string) => cards.some((c) => c[0] === rk);
    if (suit === trump) {
      if (has("A")) tricks += 1;
      if (has("K")) tricks += cards.length >= 2 ? 0.9 : 0.4;
      if (has("Q")) tricks += cards.length >= 3 ? 0.7 : 0.2;
      tricks += Math.max(0, cards.length - 3) * 0.8;
    } else {
      if (has("A")) tricks += cards.length <= 5 ? 0.95 : 0.7;
      if (has("K")) tricks += cards.length >= 2 && cards.length <= 4 ? 0.7 : 0.25;
      if (cards.length <= 1 && trumps.length >= 3) tricks += cards.length === 0 ? 0.8 : 0.5;
    }
  }
  return tricks;
}

const winningOf = (legal: readonly CardId[], trick: readonly TrickPlay[], trump: Suit | null) =>
  legal.filter((card) => trickWinner([...trick, { seat: -1, card }], trump).seat === -1);

/** v1 Medium: call from the estimate; win cheaply while short of the call, otherwise shed the lowest loser. */
export function mediumMove(view: CallbreakView, legal: readonly SeatMove[]): SeatMove | null {
  const h = view.hand;
  const first = legal[0];
  if (!first || !h || !h.my_hand) return null;
  const r = view.rules;
  if (first.t === "RequestRedeal") return h.my_hand.some((c) => suitOf(c) === r.trump) ? null : first;
  if (first.t === "Call") {
    const n = Math.min(r.call_max, Math.max(r.call_min, Math.round(estimateCallbreakTricks(h.my_hand, r.trump))));
    return { t: "Call", n };
  }
  const seat = view.viewer.kind === "seat" || view.viewer.kind === "handover_bot" ? view.viewer.seat : 0;
  const cards = legal.flatMap((m) => (m.t === "Play" ? [m.card] : []));
  if (cards.length === 0) return first;
  const need = (h.calls[seat] ?? 0) - (h.tricks[seat] ?? 0);
  if (h.trick.length === 0) {
    const safeAce = cards.find((c) => c[0] === "A" && suitOf(c) !== r.trump);
    if (need > 0 && safeAce) return { t: "Play", card: safeAce };
    const nonTrump = cards.filter((c) => suitOf(c) !== r.trump);
    return { t: "Play", card: lowest(nonTrump.length ? nonTrump : cards)! };
  }
  const winners = winningOf(cards, h.trick, r.trump);
  if (need > 0 && winners.length > 0) return { t: "Play", card: lowest(winners)! };
  const losers = cards.filter((c) => !winners.includes(c));
  return { t: "Play", card: lowest(losers.length ? losers : cards)! };
}

export function determinize(view: CallbreakView, rng: BotRandom): CallbreakState {
  const h = view.hand;
  const seat = view.viewer.kind === "seat" || view.viewer.kind === "handover_bot" ? view.viewer.seat : 0;
  if (!h) return { v: 1, rules: view.rules, match: view.match, hand: null };
  const mine = h.my_hand ?? [];
  const seen = new Set<CardId>([...mine, ...h.played]);
  const unseen = std52().filter((c) => !seen.has(c));
  const counts = h.counts.map((n, i) => (i === seat ? 0 : n));
  const voids = inferVoids(SEATS, [...h.history, h.trick]);
  const sampled = sampleHiddenHands(rng, unseen, counts, voids);
  const hand: HandState = {
    hand_id: h.hand_id, seed: rng.hex32(), phase: h.phase, annulled: h.annulled, dealer: h.dealer,
    hands: sampled.map((cards, i) => (i === seat ? mine.slice() : sortCards(cards))),
    calls: h.calls.slice(), turn: h.turn ?? h.leader, leader: h.leader, trick: h.trick.slice(), trick_no: h.trick_no,
    tricks: h.tricks.slice(), played: h.played.slice(), last_trick: h.last_trick, last_trick_winner: h.last_trick_winner,
    history: h.history.slice(), redeals: 0, redeal_requests: [], revealed: h.revealed, actions: 0,
  };
  return { v: 1, rules: view.rules, match: view.match, hand };
}

export function utility(state: CallbreakState, seat: Seat, handId: string): number {
  const done = state.match.history.find((x) => x.hand_id === handId);
  let points: number[];
  if (done) points = done.deltas.slice();
  else {
    const h = state.hand;
    if (!h || h.hand_id !== handId || h.annulled) return 0;
    points = h.calls.map((c, i) => scoreHand(state.rules, c ?? 0, h.tricks[i]!));
  }
  const mine = points[seat]!;
  const others = points.filter((_, i) => i !== seat);
  return (mine - others.reduce((a, b) => a + b, 0) / others.length) / 130;
}

export const callbreak: GameModule<CallbreakState, CallbreakView, CallbreakRules> = {
  id: "callbreak",
  seatCount: () => SEATS,
  initialState,
  rulesOf: (s) => s.rules,
  step,
  waitingOn,
  project,
  legalFromView,
  legalServer,
  explain,
  projectEvents,
  visibleCardIds,
  toAction,
  conservationHolds,
  handInfo: (s) => (s.hand ? { hand_id: s.hand.hand_id, done: s.hand.phase === "DONE", annulled: s.hand.annulled } : null),
  summary: (s) => ({ over: s.match.over, hands_played: s.match.hands_played, totals: s.match.totals, placements: s.match.placements }),
  determinize,
  utility,
  medium: mediumMove,
  cardsLeft: (v) => (v.hand ? v.hand.counts.reduce((a, b) => a + b, 0) : 52),
};

void SUITS; void rankBy;
