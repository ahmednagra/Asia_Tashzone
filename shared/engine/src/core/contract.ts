/**
 * The contract every game implements (02_ENGINE.md §1). All functions are pure and deterministic.
 * The Runtime Shell (match server, offline table, replay, bots) is game-agnostic: it only sees this.
 *
 * Hand lifecycle, identical for every game:
 *   (no hand | DONE) --BeginHand{hand_seed}--> in play --...--> DONE --> BeginHand ... --> match over
 * `waitingOn` says who must act (TURN / WINDOW), or AUTO when the shell must start the next hand.
 */
import type { BotRandom } from "./botrng.js";
import type { CardId } from "./cards.js";
import type { Action, EngineEvent, GameId, RuleErrorCode, Seat, SeatMove, StepResult, Viewer, WaitingOn } from "./types.js";

/** Fields every SeatView carries, whatever the game. */
export interface BaseView {
  readonly v: 1;
  readonly game: GameId;
  readonly viewer: Viewer;
  readonly waiting: WaitingOn;
  readonly legal: readonly SeatMove[];
}

export interface HandInfo {
  readonly hand_id: string;
  readonly done: boolean;
  readonly annulled: string | null;
}

export interface MatchSummary {
  readonly over: boolean;
  readonly hands_played: number;
  /** Per-seat score for the results report (tenths for Callbreak, team points for Court Piece, times Bhabhi for Bhabhi). */
  readonly totals: readonly number[];
  /** 1 = best; equal placements are shared. Null until the match is over. */
  readonly placements: readonly number[] | null;
}

 
export interface GameModule<S = any, V extends BaseView = any, R = any> {
  readonly id: GameId;
  seatCount(rules: R): number;
  initialState(rules: R): S;
  rulesOf(state: S): R;
  step(state: S, action: unknown): StepResult<S>;
  waitingOn(state: S): WaitingOn;
  project(state: S, viewer: Viewer): V;
  /** P-11: legal moves from the SeatView only. */
  legalFromView(view: Omit<V, "legal"> | V): SeatMove[];
  /** Legality from full state; exists only to prove view-legality equivalence (PR-03). */
  legalServer(state: S, seat: Seat): SeatMove[];
  /** Why a move is illegal, from the view only (null when legal). */
  explain(view: V, move: SeatMove): RuleErrorCode | null;
  projectEvents(events: readonly EngineEvent[], viewer: Viewer): EngineEvent[];
  /** Card identities this viewer may know right now (L-14 projection guard input). */
  visibleCardIds(state: S, viewer: Viewer): Set<CardId>;
  toAction(move: SeatMove, seat: Seat, handId: string): Action;
  /** PR-01: every card of every deck in play is somewhere, exactly as often as the decks hold it. */
  conservationHolds(state: S): boolean;
  handInfo(state: S): HandInfo | null;
  summary(state: S): MatchSummary;
  /* ── bots (view-only, C-05) ── */
  /** A full state consistent with a view, unseen cards dealt at random (search bots). */
  determinize(view: V, rng: BotRandom): S;
  /** Outcome of hand `handId` for `seat`, roughly in [-1, 1]; also called on unfinished hands. */
  utility(state: S, seat: Seat, handId: string): number;
  /** Rule-based move (Medium bot and Hard playout policy). Returns one of view.legal, or null to pass a window. */
  medium(view: V, legal: readonly SeatMove[]): SeatMove | null;
  /** Cards still to be played across every hand (and undealt stock), from the view alone. */
  cardsLeft(view: V): number;
}

/** Events a viewer may receive (P-05); identical for every game. */
export function projectEventsFor(events: readonly EngineEvent[], viewer: Viewer): EngineEvent[] {
  const seat = viewer.kind === "seat" || viewer.kind === "handover_bot" ? viewer.seat : null;
  return events.filter((e) => e.vis === "public" || (seat !== null && (e.vis as readonly Seat[]).includes(seat)));
}

export function viewerSeat(v: Viewer): Seat | null {
  return v.kind === "seat" || v.kind === "handover_bot" || v.kind === "post_hand_participant" ? v.seat : null;
}

/** Standard competition ranking; `better(a, b) > 0` when a ranks above b. Equal keys share a place. */
export function rankBy<K>(keys: readonly K[], better: (a: K, b: K) => number): number[] {
  return keys.map((k) => 1 + keys.filter((o) => better(o, k) > 0).length);
}

export function toSeatAction(move: SeatMove, seat: Seat, handId: string): Action {
  return { ...move, actor: seat, hand_id: handId } as Action;
}
