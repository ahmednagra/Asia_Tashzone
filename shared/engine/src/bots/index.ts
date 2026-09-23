/**
 * Bots (02_ENGINE.md §8), ported from TashZone v1 and made game-agnostic over GameModule.
 * Input: a SeatView only (C-05, BT-03). Output: one of view.legal, or null to let a window pass.
 *   easy   — about one move in three is the Medium move, the rest a random legal card; never a blind
 *            structural choice (never takes a hand, never asks for a redeal at random).
 *   medium — each game's rule-based policy (module.medium); also the Hard playout policy.
 *   hard   — Perfect Information Monte Carlo over determinised deals plus an exact max-n endgame.
 * Deterministic for a given seed. The work budget counts simulated moves, not time, so the engine stays
 * pure; `chooseMoveAsync` slices the same search against a caller-supplied clock.
 */
import { BotRng, type BotRandom } from "../core/botrng.js";
import type { BaseView, GameModule } from "../core/contract.js";
import type { Seat, SeatMove } from "../core/types.js";

export type BotLevel = "easy" | "medium" | "hard";
export const BOT_LEVELS: readonly BotLevel[] = ["easy", "medium", "hard"];
/** Names shown for bot seats (v1): food words, never presented as people. */
export const BOT_NAMES = ["Anaar", "Kulfi", "Chai", "Jalebi", "Mithai", "Pakora", "Lassi"] as const;

export interface HardBudget {
  /** Hidden-card guesses per candidate action, when the work budget allows that many. */
  readonly samples: number;
  /** Safety cap on moves simulated per playout. */
  readonly maxPlayoutMoves: number;
  /** Moves a single decision may simulate, over all actions and guesses. Bounds the decision's cost. */
  readonly maxSimulatedMoves: number;
  /** Cards left across all hands at or below which the endgame is solved exactly instead of sampled. */
  readonly endgameMaxCards: number;
  /** States an exact endgame decision may visit, over every guess it solves. */
  readonly endgameNodes: number;
}

/** v1 defaults, measured against a ~300 ms decision budget. */
export const DEFAULT_HARD_BUDGET: HardBudget = {
  samples: 150, maxPlayoutMoves: 400, maxSimulatedMoves: 4_000, endgameMaxCards: 12, endgameNodes: 4_000,
};

type AnyModule = GameModule<unknown, BaseView & { hand?: { hand_id: string } | null }>;

const isStructural = (m: SeatMove) => m.t === "Take";
const seatOf = (view: BaseView): Seat =>
  view.viewer.kind === "seat" || view.viewer.kind === "handover_bot" || view.viewer.kind === "post_hand_participant" ? view.viewer.seat : 0;
const turnMovesOf = (legal: readonly SeatMove[]) => legal.filter((m) => !isStructural(m) && m.t !== "RequestRedeal");

/** Chooses a move from a seat's view only. Deterministic for a given seed. */
export function chooseMove(module: GameModule, view: BaseView, level: BotLevel = "medium", seed = "bot", budget: HardBudget = DEFAULT_HARD_BUDGET): SeatMove | null {
  const legal = view.legal;
  if (legal.length === 0) return null;
  const rng = new BotRng(seed);
  const turnMoves = turnMovesOf(legal);
  // Windows (redeal requests) and off-turn states: the rule-based answer, never a random one.
  if (turnMoves.length === 0) return module.medium(view, legal);
  if (level === "hard" && view.waiting.mode === "TURN") {
    const search = hardSearch(module as AnyModule, view as never, rng, budget);
    let s = search.next();
    while (!s.done) s = search.next();
    return s.value;
  }
  if (level === "medium" || rng.next() < 0.35) return module.medium(view, turnMoves);
  return rng.pick(turnMoves);
}

export interface AsyncBotOptions {
  readonly budget?: HardBudget;
  /** Clock supplied by the caller (the engine never reads the clock). */
  readonly now?: () => number;
  /** Stop searching after this long and use the best move so far (Hard only). */
  readonly maxMs?: number;
  /** Hand control back to the host, e.g. `() => new Promise((r) => setTimeout(r, 0))`. */
  readonly yieldToHost?: () => Promise<void>;
  /** Yield after this much continuous work. */
  readonly sliceMs?: number;
}

/**
 * The same search as `chooseMove`, run in short slices and stopped at a time cap, so a low-end phone keeps
 * handling taps and animations while a bot thinks. Easy and Medium are instant and identical to `chooseMove`.
 */
export async function chooseMoveAsync(module: GameModule, view: BaseView, level: BotLevel, seed: string, options: AsyncBotOptions = {}): Promise<SeatMove | null> {
  if (level !== "hard" || !options.now || !options.yieldToHost || turnMovesOf(view.legal).length === 0 || view.waiting.mode !== "TURN") {
    return chooseMove(module, view, level, seed, options.budget);
  }
  const { now, yieldToHost } = options;
  const maxMs = options.maxMs ?? 1500;
  const sliceMs = options.sliceMs ?? 12;
  const search = hardSearch(module as AnyModule, view as never, new BotRng(seed), options.budget ?? DEFAULT_HARD_BUDGET);
  const started = now();
  let sliceStart = started;
  let s = search.next();
  while (!s.done) {
    if (now() - sliceStart >= sliceMs) {
      if (now() - started >= maxMs) return s.value; // every yielded value is a complete answer
      await yieldToHost();
      sliceStart = now();
    }
    s = search.next();
  }
  return s.value;
}

/**
 * The one Hard search: yields the best move so far after every scored sample and returns the final choice,
 * so the sync and async drivers cannot drift apart.
 */
function* hardSearch(module: AnyModule, view: BaseView & { hand: { hand_id: string } }, rng: BotRandom, budget: HardBudget): Generator<SeatMove, SeatMove, void> {
  const seat = seatOf(view);
  const actions = turnMovesOf(view.legal);
  if (actions.length <= 1) return actions[0]!;
  const handId = view.hand.hand_id;
  const base = module.determinize(view, rng);

  const exact = solveEndgame(module, view, base, seat, rng, actions, handId, budget);
  if (exact) return exact;

  const totals = actions.map(() => 0);
  const counts = actions.map(() => 0);
  const work = { moves: 0 };
  // Every action is sampled at least once; sharing the budget keeps that floor inside it.
  const playoutMoves = Math.max(8, Math.min(budget.maxPlayoutMoves, Math.ceil(budget.maxSimulatedMoves / actions.length)));
  // Paired samples: one guessed deal scored for every action before the next guess.
  for (let sample = 0; sample < budget.samples; sample++) {
    const deal = sample === 0 ? base : module.determinize(view, rng);
    for (let a = 0; a < actions.length; a++) {
      totals[a] = totals[a]! + playout(module, deal, seat, actions[a]!, handId, playoutMoves, work);
      counts[a] = counts[a]! + 1;
      yield bestOf(actions, totals, counts);
    }
    if (work.moves >= budget.maxSimulatedMoves) break; // stop only between guesses: actions stay comparable
  }
  return bestOf(actions, totals, counts);
}

function bestOf(actions: readonly SeatMove[], totals: readonly number[], counts: readonly number[]): SeatMove {
  let best = 0;
  let bestScore = -Infinity;
  for (let a = 0; a < actions.length; a++) {
    const n = counts[a]!;
    if (n === 0) continue;
    const score = totals[a]! / n;
    if (score > bestScore) { best = a; bestScore = score; }
  }
  return actions[best]!;
}

/** The seat to move in a hand still in play, or null when the hand ended or nobody must act. */
function actorOf(module: AnyModule, state: unknown, handId: string): Seat | null {
  const info = module.handInfo(state);
  if (!info || info.hand_id !== handId || info.done) return null;
  const w = module.waitingOn(state);
  return w.mode === "TURN" ? w.seats[0]! : null;
}

function mediumFor(module: AnyModule, state: unknown, actor: Seat): SeatMove | null {
  const v = module.project(state, { kind: "seat", seat: actor });
  const legal = v.legal.filter((m) => !isStructural(m));
  if (legal.length === 0) return null;
  return module.medium(v, legal) ?? legal[0]!;
}

/** One guessed deal, the move under test, then the rest of the hand played by the Medium policy. */
function playout(module: AnyModule, deal: unknown, seat: Seat, move: SeatMove, handId: string, maxMoves: number, work: { moves: number }): number {
  const first = module.step(deal, module.toAction(move, seat, handId));
  work.moves++;
  if (!first.ok) return -Infinity;
  let state = first.state;
  for (let moves = 0; moves < maxMoves; moves++) {
    work.moves++;
    const actor = actorOf(module, state, handId);
    if (actor === null) break;
    const m = mediumFor(module, state, actor);
    if (!m) break;
    const r = module.step(state, module.toAction(m, actor, handId));
    if (!r.ok) break;
    state = r.state;
  }
  return module.utility(state, seat, handId);
}

/**
 * Exact endgame: once few enough cards remain, each guess is searched exhaustively (max-n: every seat maximises
 * its own utility). With nothing hidden this is the provably best move. Returns null when the regime does not
 * apply or the node cap is spent, and sampling takes over.
 */
function solveEndgame(module: AnyModule, view: BaseView, base: unknown, seat: Seat, rng: BotRandom, actions: readonly SeatMove[], handId: string, budget: HardBudget): SeatMove | null {
  if (module.cardsLeft(view) > budget.endgameMaxCards) return null;
  const players = module.seatCount(module.rulesOf(base));
  const totals = actions.map(() => 0);
  const counter = { nodes: 0, cap: budget.endgameNodes };
  let solved = 0;
  for (let deal = 0; deal < Math.max(1, budget.samples); deal++) {
    if (solved > 0 && counter.nodes + counter.nodes / solved > counter.cap) break;
    const state = deal === 0 ? base : module.determinize(view, rng);
    const values: number[] = [];
    for (const move of actions) {
      const first = module.step(state, module.toAction(move, seat, handId));
      if (!first.ok) break;
      const v = exactValues(module, first.state, handId, players, counter);
      if (!v) break;
      values.push(v[seat]!);
    }
    if (values.length < actions.length) break;
    for (let a = 0; a < actions.length; a++) totals[a] = totals[a]! + values[a]!;
    solved++;
  }
  if (solved === 0) return null;
  let best = 0;
  for (let a = 1; a < actions.length; a++) if (totals[a]! > totals[best]!) best = a;
  return actions[best]!;
}

function exactValues(module: AnyModule, state: unknown, handId: string, players: number, counter: { nodes: number; cap: number }): number[] | null {
  if (++counter.nodes > counter.cap) return null;
  const actor = actorOf(module, state, handId);
  if (actor === null) return leafValues(module, state, handId, players);
  const moves = module.legalServer(state, actor).filter((m) => !isStructural(m));
  let best: number[] | null = null;
  for (const move of moves) {
    const r = module.step(state, module.toAction(move, actor, handId));
    if (!r.ok) continue;
    const values = exactValues(module, r.state, handId, players, counter);
    if (!values) return null;
    if (!best || values[actor]! > best[actor]!) best = values;
  }
  return best ?? leafValues(module, state, handId, players);
}

function leafValues(module: AnyModule, state: unknown, handId: string, players: number): number[] {
  const out: number[] = [];
  for (let s = 0; s < players; s++) out.push(module.utility(state, s, handId));
  return out;
}

