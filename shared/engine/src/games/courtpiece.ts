/**
 * Court Piece (Rung) — profile courtpiece.tz@1, the TashZone v1 rules ported to the new engine.
 * 4 players in partnerships (seats 0+2 v 1+3). The seat after the dealer sees 5 cards, chooses trump,
 * then leads. Single Sir and Double Sir (v1 brief L15, L20; Pagat). Play follows seat order.
 * Behaviour matches v1 `games/courtpiece.ts`; the deal now comes from a per-hand tz-rng-v1 seed.
 */
import { type CardId, type Suit, isCardId, rankOf, rankValue, sortCards, std52 } from "../core/cards.js";
import { type DrawRecord, handRandom } from "../core/rng.js";
import { type BotRandom, sampleHiddenHands } from "../core/botrng.js";
import {
  type FollowRules, type PlayedCard, cardsOfSuit, followError, inferVoids, legalCards, lowest, removeOne, sameCards, trickWinner,
} from "../families/trick-taking.js";
import { type BaseView, type GameModule, projectEventsFor, toSeatAction, viewerSeat } from "../core/contract.js";
import type { Action, EngineEvent, RejectCode, RuleErrorCode, Seat, SeatMove, StepResult, Viewer, WaitingOn } from "../core/types.js";

export interface CourtPieceRules {
  readonly profile_id: string;
  readonly seats: 4;
  readonly variant: "single" | "double";
  /** Single Sir: stop as soon as a team has 7 tricks. Double Sir: as soon as a team has collected 7. */
  readonly stop_at_seven: boolean;
  /** Double Sir: two consecutive tricks both won with aces do not collect the pile. */
  readonly ace_blocks_collect: boolean;
  readonly target_points: number;
  readonly hand_points: number;
  readonly court_points: number;
  /** pagat: the losing side deals next. rotate: the dealer moves one seat each hand. */
  readonly dealer_rotation: "pagat" | "rotate";
  readonly max_actions_per_hand: number;
  readonly turn_ms: number;
  readonly window_ms: number;
}

export type Team = 0 | 1;
export const teamOf = (seat: Seat): Team => (seat % 2) as Team;

export interface CourtPieceHandResult {
  readonly hand_id: string;
  readonly caller: Seat;
  readonly trump: Suit;
  readonly winner: Team;
  readonly court: boolean;
  /** Tricks won (Single Sir) or collected (Double Sir) per team. */
  readonly tricks: readonly [number, number];
  readonly points: readonly [number, number];
}

export interface CourtPieceHand {
  readonly hand_id: string;
  /** server-only */
  readonly seed: string;
  readonly phase: "TRUMP" | "PLAY" | "DONE";
  readonly annulled: string | null;
  readonly dealer: Seat;
  readonly caller: Seat;
  readonly trump: Suit | null;
  /** undealt cards (hidden) */
  readonly stock: readonly CardId[];
  readonly hands: readonly (readonly CardId[])[];
  /** full 13-card hands once trump is chosen; revealed when the hand ends */
  readonly dealt: readonly (readonly CardId[])[];
  readonly trick: readonly PlayedCard[];
  readonly leader: Seat;
  readonly turn: Seat;
  readonly history: readonly (readonly PlayedCard[])[];
  readonly team_tricks: readonly [number, number];
  readonly pile: number;
  readonly last_win: { readonly seat: Seat; readonly card: CardId } | null;
  readonly actions: number;
}

export interface CourtPieceMatch {
  readonly hands_played: number;
  readonly next_dealer: Seat;
  readonly points: readonly [number, number];
  readonly over: boolean;
  readonly winner: Team | null;
  readonly results: readonly CourtPieceHandResult[];
}

export interface CourtPieceState {
  readonly v: 1;
  readonly game: "courtpiece";
  readonly rules: CourtPieceRules;
  readonly match: CourtPieceMatch;
  readonly hand: CourtPieceHand | null;
}

const PLAYERS = 4;
const TRICKS = 13;
const TO_WIN = 7;
const TRUMP_ORDER: readonly Suit[] = ["S", "H", "D", "C"]; // v1 order (bot tie-breaks, move lists)
const next = (seat: Seat): Seat => (seat + 1) % PLAYERS;
const follow = (trump: Suit | null): FollowRules => ({ trump, mustBeat: false, mustTrump: false, mustOvertrump: false });

export function initialState(rules: CourtPieceRules): CourtPieceState {
  return {
    v: 1, game: "courtpiece", rules,
    match: { hands_played: 0, next_dealer: 0, points: [0, 0], over: false, winner: null, results: [] },
    hand: null,
  };
}

/* ───────────────────────── step ───────────────────────── */

type Mut<T> = { -readonly [K in keyof T]: T[K] };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const reject = (code: RejectCode): StepResult<CourtPieceState> => ({ ok: false, code });

function validSchema(a: unknown): a is Action {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  if (typeof x.t !== "string" || typeof x.hand_id !== "string" || x.hand_id.length === 0 || x.hand_id.length > 64) return false;
  const seatActor = typeof x.actor === "number" && Number.isInteger(x.actor) && x.actor >= 0 && x.actor < PLAYERS;
  switch (x.t) {
    case "BeginHand": return x.actor === "system" && typeof x.hand_seed === "string" && /^[0-9a-f]{64}$/.test(x.hand_seed);
    case "Timeout": return x.actor === "system" && typeof x.seat === "number" && Number.isInteger(x.seat) && x.seat >= 0 && x.seat < PLAYERS;
    case "ChooseTrump": return seatActor && typeof x.suit === "string" && TRUMP_ORDER.includes(x.suit as Suit);
    case "Play": return seatActor && isCardId(x.card);
    default: return false;
  }
}

export function step(state: CourtPieceState, action: unknown): StepResult<CourtPieceState> {
  if (!validSchema(action)) return reject("BAD_SCHEMA");
  if (state.match.over) return reject("MATCH_OVER");
  const s = clone(state) as Mut<CourtPieceState>;
  const m = s.match as Mut<CourtPieceMatch>;
  const r = s.rules;
  const events: EngineEvent[] = [];
  const draws: DrawRecord[] = [];

  if (action.t === "BeginHand") {
    if (s.hand && s.hand.phase !== "DONE") return reject("NOT_NOW");
    const dealer = m.next_dealer;
    const deck = handRandom(action.hand_seed, "R-CP-1/shuffle", draws).shuffle(std52());
    const caller = next(dealer);
    const hands: CardId[][] = [[], [], [], []];
    let seat = caller;
    for (let i = 0; i < 20; i++) { hands[seat]!.push(deck[i]!); seat = next(seat); }
    s.hand = {
      hand_id: action.hand_id, seed: action.hand_seed, phase: "TRUMP", annulled: null, dealer, caller, trump: null,
      stock: deck.slice(20), hands: hands.map(sortCards), dealt: [], trick: [], leader: caller, turn: caller, history: [],
      team_tricks: [0, 0], pile: 0, last_win: null, actions: 1,
    };
    events.push({ t: "HandStarted", vis: "public", hand_id: action.hand_id, dealer, caller, hand_index: m.hands_played });
    for (let p = 0; p < PLAYERS; p++) events.push({ t: "Dealt", vis: [p], seat: p, cards: s.hand.hands[p]!.slice() });
    events.push({ t: "DealtCounts", vis: "public", counts: [5, 5, 5, 5], stock_count: 32 });
    events.push({ t: "TrumpTurn", vis: "public", seat: caller });
    return { ok: true, state: s as CourtPieceState, events, draws };
  }

  const h = s.hand as Mut<CourtPieceHand> | null;
  if (!h || h.phase === "DONE") return reject("NOT_NOW");
  if (action.hand_id !== h.hand_id) return reject("WRONG_HAND");
  h.actions += 1;

  switch (action.t) {
    case "Timeout": {
      if (action.seat !== h.turn) return reject("NOT_NOW");
      events.push({ t: "TurnTimedOut", vis: "public", seat: action.seat });
      break;
    }
    case "ChooseTrump": {
      if (h.phase !== "TRUMP") return reject("NOT_NOW");
      if (action.actor !== h.turn) return reject("NOT_YOUR_TURN");
      const hands = h.hands.map((x) => x.slice());
      const added: CardId[][] = [[], [], [], []];
      let stock = h.stock.slice();
      for (let batch = 0; batch < 2; batch++) {
        let target = h.caller;
        for (let i = 0; i < PLAYERS; i++) {
          const four = stock.slice(0, 4);
          hands[target]!.push(...four);
          added[target]!.push(...four);
          stock = stock.slice(4);
          target = next(target);
        }
      }
      h.hands = hands.map(sortCards);
      h.dealt = h.hands.map((x) => x.slice());
      h.stock = stock;
      h.trump = action.suit;
      h.phase = "PLAY";
      events.push({ t: "TrumpChosen", vis: "public", seat: action.actor, suit: action.suit });
      for (let p = 0; p < PLAYERS; p++) events.push({ t: "DealtRest", vis: [p], seat: p, cards: sortCards(added[p]!) });
      events.push({ t: "PlayTurn", vis: "public", seat: h.turn, trick_no: 1 });
      break;
    }
    case "Play": {
      if (h.phase !== "PLAY") return reject("NOT_NOW");
      if (action.actor !== h.turn) return reject("NOT_YOUR_TURN");
      const hand = h.hands[action.actor]!;
      if (followError(hand, h.trick, follow(h.trump), action.card) !== null) return reject("ILLEGAL_ACTION");
      (h.hands as CardId[][])[action.actor] = removeOne(hand, action.card);
      h.trick = [...h.trick, { seat: action.actor, card: action.card }];
      events.push({ t: "CardPlayed", vis: "public", seat: action.actor, card: action.card });
      if (h.trick.length < PLAYERS) {
        h.turn = next(action.actor);
        events.push({ t: "PlayTurn", vis: "public", seat: h.turn, trick_no: h.history.length + 1 });
        break;
      }
      const plays = h.trick;
      const winner = trickWinner(plays, h.trump).seat;
      const winningCard = plays.find((p) => p.seat === winner)!.card;
      h.history = [...h.history, plays];
      h.trick = [];
      h.leader = winner;
      h.turn = winner;
      events.push({ t: "TrickWon", vis: "public", seat: winner, cards: plays.map((p) => p.card), trick_no: h.history.length });
      const team = teamOf(winner);
      const tt: [number, number] = [h.team_tricks[0], h.team_tricks[1]];
      if (r.variant === "single") {
        tt[team] += 1;
        h.team_tricks = tt;
      } else {
        const pile = h.pile + 1;
        const last = h.history.length === TRICKS;
        const consecutive = h.last_win?.seat === winner;
        const blockedByAces = r.ace_blocks_collect && consecutive && rankOf(winningCard) === "A" && rankOf(h.last_win!.card) === "A";
        if ((consecutive && !blockedByAces) || last) {
          tt[team] += pile;
          h.team_tricks = tt;
          h.pile = 0;
          h.last_win = null;
          events.push({ t: "TricksCollected", vis: "public", seat: winner, team, count: pile });
        } else {
          h.pile = pile;
          h.last_win = { seat: winner, card: winningCard };
        }
      }
      const decided = handWinner(r, h);
      if (decided) finishHand(s, h, decided.winner, decided.court, events);
      else events.push({ t: "PlayTurn", vis: "public", seat: winner, trick_no: h.history.length + 1 });
      break;
    }
    default:
      return reject("BAD_SCHEMA");
  }

  if ((h.phase as CourtPieceHand["phase"]) !== "DONE" && h.actions > r.max_actions_per_hand) {
    h.phase = "DONE";
    h.annulled = "guard";
    events.push({ t: "GuardTripped", vis: "public", hand_id: h.hand_id });
    events.push({ t: "HandAnnulled", vis: "public", hand_id: h.hand_id, reason: "guard", revealed: [] });
  }
  return { ok: true, state: s as CourtPieceState, events, draws };
}

function handWinner(r: CourtPieceRules, h: CourtPieceHand): { winner: Team; court: boolean } | null {
  const [a, b] = h.team_tricks;
  const done = h.history.length === TRICKS;
  // Double Sir court needs all 13 collected, so a 7–0 lead keeps playing until the other side collects.
  const reached = r.variant === "single" ? a >= TO_WIN || b >= TO_WIN : (a >= TO_WIN && b > 0) || (b >= TO_WIN && a > 0);
  if (!reached && !done) return null;
  if (!done && !r.stop_at_seven) return null;
  const winner: Team = a > b ? 0 : 1;
  const loserTricks = h.team_tricks[winner === 0 ? 1 : 0];
  const court = r.variant === "single" ? loserTricks === 0 && h.team_tricks[winner] >= TO_WIN : h.team_tricks[winner] === TRICKS;
  return { winner, court };
}

function finishHand(s: Mut<CourtPieceState>, h: Mut<CourtPieceHand>, winner: Team, court: boolean, events: EngineEvent[]): void {
  const r = s.rules;
  const m = s.match as Mut<CourtPieceMatch>;
  const gained = court ? r.court_points : r.hand_points;
  const points: [number, number] = [m.points[0], m.points[1]];
  points[winner] += gained;
  const result: CourtPieceHandResult = {
    hand_id: h.hand_id, caller: h.caller, trump: h.trump!, winner, court,
    tricks: [h.team_tricks[0], h.team_tricks[1]], points: winner === 0 ? [gained, 0] : [0, gained],
  };
  m.points = points;
  m.results = [...m.results, result];
  m.hands_played += 1;
  m.next_dealer =
    r.dealer_rotation === "rotate" ? next(h.dealer)
      : court ? (h.dealer + 2) % PLAYERS
        // The losing side deals: if the caller's side won, the dealer's side lost and deals again.
        : winner === teamOf(h.caller) ? h.dealer : next(h.dealer);
  h.phase = "DONE";
  events.push({ t: "HandScored", vis: "public", hand_id: h.hand_id, result, points });
  events.push({ t: "HandRevealed", vis: "public", hand_id: h.hand_id, hands: h.dealt.map((x) => x.slice()) });
  if (points[winner] >= r.target_points) {
    m.over = true;
    m.winner = winner;
    events.push({ t: "MatchOver", vis: "public", points, winner, placements: placementsOf(winner) });
  }
}

const placementsOf = (winner: Team): number[] => [0, 1, 2, 3].map((seat) => (teamOf(seat) === winner ? 1 : 2));

export function waitingOn(state: CourtPieceState): WaitingOn {
  const h = state.hand;
  if (state.match.over) return { mode: "NONE", seats: [] };
  if (!h || h.phase === "DONE") return { mode: "AUTO", seats: [] };
  return { mode: "TURN", seats: [h.turn] };
}

/* ───────────────────────── Projection ───────────────────────── */

export interface CourtPieceHandView {
  readonly hand_id: string;
  readonly phase: CourtPieceHand["phase"];
  readonly annulled: string | null;
  readonly dealer: Seat;
  readonly caller: Seat;
  readonly trump: Suit | null;
  readonly my_hand: readonly CardId[] | null;
  readonly counts: readonly number[];
  readonly stock_count: number;
  readonly trick: readonly PlayedCard[];
  readonly leader: Seat;
  readonly turn: Seat | null;
  readonly history: readonly (readonly PlayedCard[])[];
  readonly team_tricks: readonly [number, number];
  readonly pile: number;
  readonly last_win: { readonly seat: Seat; readonly card: CardId } | null;
  /** every hand as dealt, once the hand is over ("Replay hand") */
  readonly revealed_hands: readonly (readonly CardId[])[] | null;
}

export interface CourtPieceView extends BaseView {
  readonly game: "courtpiece";
  readonly rules: CourtPieceRules;
  readonly match: CourtPieceMatch;
  readonly hand: CourtPieceHandView | null;
}

export function project(state: CourtPieceState, viewer: Viewer): CourtPieceView {
  const seat = viewerSeat(viewer);
  const h = state.hand;
  const hv: CourtPieceHandView | null = h === null ? null : {
    hand_id: h.hand_id, phase: h.phase, annulled: h.annulled, dealer: h.dealer, caller: h.caller, trump: h.trump,
    my_hand: seat === null ? null : h.hands[seat]!.slice(),
    counts: h.hands.map((x) => x.length), stock_count: h.stock.length, trick: h.trick.slice(), leader: h.leader,
    turn: h.phase === "DONE" ? null : h.turn, history: h.history.map((t) => t.slice()),
    team_tricks: [h.team_tricks[0], h.team_tricks[1]], pile: h.pile, last_win: h.last_win,
    revealed_hands: h.phase === "DONE" && !h.annulled && h.dealt.length > 0 ? h.dealt.map((x) => x.slice()) : null,
  };
  const base = { v: 1 as const, game: "courtpiece" as const, viewer, rules: state.rules, match: state.match, hand: hv, waiting: waitingOn(state), legal: [] as SeatMove[] };
  return { ...base, legal: legalFromView(base) };
}

export function legalFromView(view: Omit<CourtPieceView, "legal"> | CourtPieceView): SeatMove[] {
  const seat = viewerSeat(view.viewer);
  const h = view.hand;
  if (seat === null || view.viewer.kind === "post_hand_participant" || !h || !h.my_hand || view.match.over || h.turn !== seat) return [];
  if (h.phase === "TRUMP") return TRUMP_ORDER.map((suit) => ({ t: "ChooseTrump", suit }));
  if (h.phase === "PLAY") return legalCards(h.my_hand, h.trick, follow(h.trump)).map((card) => ({ t: "Play", card }));
  return [];
}

export function legalServer(state: CourtPieceState, seat: Seat): SeatMove[] {
  const h = state.hand;
  if (!h || state.match.over || h.phase === "DONE" || h.turn !== seat) return [];
  if (h.phase === "TRUMP") return TRUMP_ORDER.map((suit) => ({ t: "ChooseTrump", suit }));
  return legalCards(h.hands[seat]!, h.trick, follow(h.trump)).map((card) => ({ t: "Play", card }));
}

export function explain(view: CourtPieceView, move: SeatMove): RuleErrorCode | null {
  if (view.legal.some((x) => JSON.stringify(x) === JSON.stringify(move))) return null;
  if (view.match.over) return "MATCH_OVER";
  const h = view.hand;
  const seat = viewerSeat(view.viewer);
  if (!h || !h.my_hand || seat === null || h.phase === "DONE") return "WRONG_PHASE";
  if (h.turn !== seat) return "NOT_YOUR_TURN";
  if (move.t === "ChooseTrump") return h.phase === "TRUMP" ? "INVALID_ACTION" : "WRONG_PHASE";
  if (move.t !== "Play") return "INVALID_ACTION";
  if (h.phase !== "PLAY") return "WRONG_PHASE";
  return followError(h.my_hand, h.trick, follow(h.trump), move.card) ?? "INVALID_ACTION";
}

export function visibleCardIds(state: CourtPieceState, viewer: Viewer): Set<CardId> {
  const out = new Set<CardId>();
  const h = state.hand;
  if (!h) return out;
  const seat = viewerSeat(viewer);
  if (seat !== null) for (const c of h.hands[seat]!) out.add(c);
  for (const t of h.history) for (const p of t) out.add(p.card);
  for (const p of h.trick) out.add(p.card);
  if (h.phase === "DONE" && !h.annulled) for (const x of h.dealt) for (const c of x) out.add(c);
  return out;
}

export function conservationHolds(state: CourtPieceState): boolean {
  const h = state.hand;
  if (!h) return true;
  const all = [...h.hands.flat(), ...h.stock, ...h.trick.map((p) => p.card), ...h.history.flat().map((p) => p.card)];
  return sameCards(all, std52());
}

/* ───────────────────────── Bots ───────────────────────── */

export function determinize(view: CourtPieceView, rng: BotRandom): CourtPieceState {
  const h = view.hand;
  const seat = viewerSeat(view.viewer) ?? 0;
  if (!h) return { v: 1, game: "courtpiece", rules: view.rules, match: view.match, hand: null };
  const mine = h.my_hand ?? [];
  const played = [...h.history.flat(), ...h.trick].map((p) => p.card);
  const seen = new Set<CardId>([...mine, ...played]);
  const unseen = std52().filter((c) => !seen.has(c));
  const counts = [...h.counts.map((n, i) => (i === seat ? 0 : n)), h.stock_count];
  const voids = [...inferVoids(PLAYERS, [...h.history, h.trick]), []];
  const sampled = sampleHiddenHands(rng, unseen, counts, voids);
  return {
    v: 1, game: "courtpiece", rules: view.rules, match: view.match,
    hand: {
      hand_id: h.hand_id, seed: rng.hex32(), phase: h.phase, annulled: h.annulled, dealer: h.dealer, caller: h.caller, trump: h.trump,
      stock: sampled[PLAYERS]!, hands: sampled.slice(0, PLAYERS).map((x, i) => (i === seat ? mine.slice() : sortCards(x))), dealt: [],
      trick: h.trick.slice(), leader: h.leader, turn: h.turn ?? h.leader, history: h.history.map((t) => t.slice()),
      team_tricks: [h.team_tricks[0], h.team_tricks[1]], pile: h.pile, last_win: h.last_win, actions: 0,
    },
  };
}

export function utility(state: CourtPieceState, seat: Seat, handId: string): number {
  const mine = teamOf(seat);
  const result = state.match.results.find((x) => x.hand_id === handId);
  if (result) return (result.winner === mine ? 1 : -1) * (result.court ? 1 : 0.6);
  const h = state.hand;
  if (!h || h.hand_id !== handId) return 0;
  const theirs = mine === 0 ? 1 : 0;
  return (h.team_tricks[mine] - h.team_tricks[theirs]) / TRICKS;
}

const winningOf = (legal: readonly CardId[], trick: readonly PlayedCard[], trump: Suit | null) =>
  legal.filter((card) => trickWinner([...trick, { seat: -1, card }], trump).seat === -1);

/** v1 Medium: trump by length weighted by high cards; never overtake a winning partner. */
export function mediumMove(view: CourtPieceView, legal: readonly SeatMove[]): SeatMove | null {
  const h = view.hand;
  const first = legal[0];
  if (!first || !h || !h.my_hand) return null;
  const seat = viewerSeat(view.viewer) ?? 0;
  if (first.t === "ChooseTrump") {
    let best: Suit = "S";
    let bestScore = -1;
    for (const suit of TRUMP_ORDER) {
      const cards = cardsOfSuit(h.my_hand, suit);
      const score = cards.length * 2 + cards.reduce((a, c) => a + Math.max(0, rankValue(c) - 10), 0);
      if (score > bestScore) { best = suit; bestScore = score; }
    }
    return { t: "ChooseTrump", suit: best };
  }
  const cards = legal.flatMap((x) => (x.t === "Play" ? [x.card] : []));
  if (h.trick.length === 0) {
    const aces = cards.filter((c) => c[0] === "A" && c[1] !== h.trump);
    return { t: "Play", card: aces[0] ?? lowest(cards.filter((c) => c[1] !== h.trump)) ?? lowest(cards)! };
  }
  const current = trickWinner(h.trick, h.trump);
  const partnerWinning = teamOf(current.seat) === teamOf(seat);
  const winners = winningOf(cards, h.trick, h.trump);
  if (!partnerWinning && winners.length > 0) return { t: "Play", card: lowest(winners)! };
  const losers = cards.filter((c) => !winners.includes(c));
  return { t: "Play", card: lowest(losers.length ? losers : cards)! };
}

export const courtpiece: GameModule<CourtPieceState, CourtPieceView, CourtPieceRules> = {
  id: "courtpiece",
  seatCount: () => PLAYERS,
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
  summary: (s) => ({
    over: s.match.over, hands_played: s.match.hands_played,
    totals: [0, 1, 2, 3].map((seat) => s.match.points[teamOf(seat)]),
    placements: s.match.winner === null ? null : placementsOf(s.match.winner),
  }),
  determinize,
  utility,
  medium: mediumMove,
  cardsLeft: (v) => (v.hand ? v.hand.counts.reduce((a, b) => a + b, 0) + v.hand.stock_count : 52),
};
