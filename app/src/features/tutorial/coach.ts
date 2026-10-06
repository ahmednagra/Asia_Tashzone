import { estimateCallbreakTricks } from "@tashzone/engine";

export type TipId = "welcome" | "call" | "follow" | "beat" | "trump" | "won" | "end";

export const TIP_ORDER: readonly TipId[] = ["welcome", "call", "follow", "beat", "trump", "won", "end"];

export interface CoachState {
  dealt: boolean;
  called: boolean;
  canCall: boolean;
  following: boolean;
  mustBeat: boolean;
  trumpToWin: boolean;
  wonLast: boolean;
  done: boolean;
}

export const IDLE: CoachState = { dealt: false, called: false, canCall: false, following: false, mustBeat: false, trumpToWin: false, wonLast: false, done: false };

interface Played { readonly seat: number; readonly card: string }

export interface TableView {
  readonly viewer?: { readonly seat?: number } | null;
  readonly rules?: { readonly trump?: string; readonly call_min?: number; readonly call_max?: number } | null;
  readonly legal?: readonly { readonly t: string; readonly card?: string }[] | null;
  readonly hand?: {
    readonly phase?: string;
    readonly annulled?: string | null;
    readonly my_hand?: readonly string[] | null;
    readonly calls?: readonly (number | null)[];
    readonly tricks?: readonly number[];
    readonly turn?: number | null;
    readonly trick?: readonly Played[];
    readonly last_trick_winner?: number | null;
  } | null;
  readonly match?: {
    readonly history?: readonly { readonly calls: readonly number[]; readonly tricks: readonly number[]; readonly deltas: readonly number[] }[];
  } | null;
}

type View = TableView | null | undefined;

const suit = (card: string) => card[1];

export function seatOf(view: View): number {
  const seat = view?.viewer?.seat;
  return typeof seat === "number" ? seat : 0;
}

export function coachState(view: View): CoachState {
  const h = view?.hand;
  if (!h || !h.my_hand) return IDLE;
  const me = seatOf(view);
  const legal = view?.legal ?? [];
  const plays = legal.flatMap((m) => (m.t === "Play" && m.card ? [m.card] : []));
  const trick = h.trick ?? [];
  const done = h.phase === "DONE" && !h.annulled;
  const playing = h.phase === "PLAY" && h.turn === me && plays.length > 0;
  const led = playing && trick.length > 0 ? suit(trick[0]!.card) : null;
  const ofLed = led ? h.my_hand.filter((c) => suit(c) === led) : [];
  const trump = view?.rules?.trump ?? "S";
  return {
    dealt: h.phase === "CALL" || h.phase === "PLAY" || done,
    called: typeof h.calls?.[me] === "number",
    canCall: h.phase === "CALL" && legal.some((m) => m.t === "Call"),
    following: led !== null,
    mustBeat: led !== null && ofLed.length > 0 && plays.length < ofLed.length,
    trumpToWin: led !== null && ofLed.length === 0 && plays.every((c) => suit(c) === trump),
    wonLast: h.phase === "PLAY" && h.last_trick_winner === me,
    done,
  };
}

export function triggered(tip: TipId, s: CoachState): boolean {
  switch (tip) {
    case "welcome": return s.dealt && !s.called && !s.done;
    case "call": return s.canCall;
    case "follow": return s.following;
    case "beat": return s.mustBeat;
    case "trump": return s.trumpToWin;
    case "won": return s.wonLast;
    case "end": return s.done;
  }
}

export function nextTip(s: CoachState, seen: ReadonlySet<TipId>): TipId | null {
  for (const tip of TIP_ORDER) if (!seen.has(tip) && triggered(tip, s)) return tip;
  return null;
}

const plus = (seen: ReadonlySet<TipId>, tip: TipId): ReadonlySet<TipId> => (seen.has(tip) ? seen : new Set([...seen, tip]));

export interface Coach { readonly tip: TipId | null; readonly seen: ReadonlySet<TipId> }

export const START: Coach = { tip: null, seen: new Set() };

export function advance(s: CoachState, c: Coach): Coach {
  let seen = c.seen;
  if (c.tip && !triggered(c.tip, s)) seen = plus(seen, c.tip);
  const tip = nextTip(s, seen);
  if (c.tip && tip !== c.tip) seen = plus(seen, c.tip);
  return tip === c.tip && seen === c.seen ? c : { tip, seen };
}

export function dismiss(s: CoachState, c: Coach): Coach {
  if (!c.tip) return c;
  const seen = plus(c.seen, c.tip);
  return { tip: nextTip(s, seen), seen };
}

type EstimateArgs = Parameters<typeof estimateCallbreakTricks>;

export function suggestedCall(view: View): number {
  const r = view?.rules;
  const min = r?.call_min ?? 1;
  const max = r?.call_max ?? 13;
  const hand = (view?.hand?.my_hand ?? []) as EstimateArgs[0];
  const trump = (r?.trump ?? "S") as EstimateArgs[1];
  return Math.min(max, Math.max(min, Math.round(estimateCallbreakTricks(hand, trump))));
}

export interface HandOutcome { call: number; won: number; made: boolean; points: string }

export function handOutcome(view: View): HandOutcome | null {
  const me = seatOf(view);
  const history = view?.match?.history ?? [];
  const last = history[history.length - 1];
  const call = last?.calls[me];
  const won = last?.tricks[me];
  const delta = last?.deltas[me];
  if (typeof call !== "number" || typeof won !== "number" || typeof delta !== "number") return null;
  const abs = Math.abs(delta) / 10;
  return { call, won, made: won >= call, points: Number.isInteger(abs) ? String(abs) : abs.toFixed(1) };
}
