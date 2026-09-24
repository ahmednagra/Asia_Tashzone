/**
 * What the table can say about itself, derived from a SeatView only (pure, tested in Node): the one-line
 * instruction, what has gone, the last trick, shown voids, the hint explanation, the active house rules,
 * hand sorting and the turn clock. Nothing here can reveal a card the viewer may not know.
 */
import type { Lang } from "../../../i18n";
import type { CardId, SeatMove } from "@tashzone/engine";
import { SUIT_GLYPH, cardLabel, handOrder, seatName, suitName } from "./logic";
import { T } from "./copy";

const RANK_ORDER = "23456789TJQKA";
export const RANKS_HIGH_FIRST: readonly string[] = RANK_ORDER.split("").reverse();
export const SUITS_ORDER: readonly string[] = ["S", "H", "D", "C"];
const rankIdx = (c: string) => RANK_ORDER.indexOf(c[0]!);
const nameOf = (names: readonly string[], seat: number) => seatName(names, seat);


export function mySeat(view: any): number {
  return view.viewer.kind === "seat" || view.viewer.kind === "handover_bot" ? view.viewer.seat : 0;
}

/** The suit that is trump right now (Callbreak: fixed; Court Piece: chosen; Bhabhi: none). */
export function trumpOf(view: any): string | null {
  if (view.game === "courtpiece") return view.hand?.trump ?? null;
  if (view.game === "bhabhi") return null;
  return view.rules?.trump ?? null;
}

/* ───────────── instruction, status, phase ───────────── */

interface Trick { readonly seat: number; readonly card: CardId }
const leadSuit = (trick: readonly Trick[]): string | null => (trick.length ? trick[0]!.card[1]! : null);

/** Bhabhi: the seat that currently holds the highest card of the led suit (it picks up if the suit is broken). */
export function pickupVictim(trick: readonly Trick[]): number | null {
  const led = leadSuit(trick);
  if (!led) return null;
  let best: Trick | null = null;
  for (const p of trick) if (p.card[1] === led && (!best || rankIdx(p.card) > rankIdx(best.card))) best = p;
  return best ? best.seat : null;
}

/** "What to do about it", beside the player's own cards. Empty when it is not the viewer's turn to act. */
export function instructionLine(view: any, names: readonly string[]): string {
  const S = T.say;
  const h = view.hand;
  const me = mySeat(view);
  if (view.match?.over) return S.matchOver;
  if (!h) return S.dealingFull;
  if (h.phase === "DONE") return S.handOver;
  const legal: readonly SeatMove[] = view.legal ?? [];
  if (h.phase === "WINDOW") return legal.some((m) => m.t === "RequestRedeal") ? S.weakHand : S.redealOpen;
  if (h.phase === "CALL") return h.turn === me ? S.chooseCall : S.isCalling(nameOf(names, h.turn));
  if (h.phase === "TRUMP") return h.turn === me ? S.youNameTrump : T.model.waitingTrump;
  if (h.turn !== me) {
    if (view.game === "bhabhi" && legal.some((m) => m.t === "Take")) return S.mayTake;
    return h.turn === null || h.turn === undefined ? "" : S.isPlaying(nameOf(names, h.turn));
  }
  const trick: readonly Trick[] = h.trick ?? [];
  const plays = legal.filter((m): m is Extract<SeatMove, { t: "Play" }> => m.t === "Play");
  const led = leadSuit(trick);
  if (!led) {
    if (plays.length === 1 && plays[0]!.card === "AS" && view.game === "bhabhi" && h.first_trick) return S.leadAceSpades;
    return S.lead;
  }
  const have = (h.my_hand as readonly CardId[] | null)?.some((c) => c[1] === led) ?? false;
  if (have) return S.follow(SUIT_GLYPH[led]!, suitName(led));
  return view.game === "bhabhi" ? S.noSuitBreaks(SUIT_GLYPH[led]!) : S.noSuitTrump(SUIT_GLYPH[led]!);
}

/** Top-bar line: who acts. `mine` says whether to draw it in gold. */
export function statusLine(view: any, names: readonly string[]): { text: string; mine: boolean } {
  const S = T.say;
  const h = view.hand;
  const me = mySeat(view);
  if (view.match?.over) return { text: S.matchOver, mine: false };
  if (!h) return { text: S.dealing, mine: false };
  if (h.phase === "DONE") return { text: S.handOver, mine: false };
  if (h.phase === "WINDOW") return { text: S.redealWindow, mine: false };
  const mine = h.turn === me || (view.legal ?? []).some((m: SeatMove) => m.t === "Take");
  if (h.turn === me) {
    const what = instructionLine(view, names);
    return { text: S.yourTurn(what === S.lead ? S.leadShort : what), mine };
  }
  return { text: h.turn === null || h.turn === undefined ? S.waiting : S.isPlaying(nameOf(names, h.turn)), mine };
}

/** Small lower-case caption over the felt (mockup `.phase`). */
export function phaseWord(view: any): string {
  const P = T.phase;
  const h = view.hand;
  if (view.match?.over) return P.over;
  if (!h) return P.dealing;
  if (h.phase === "DONE") return P.handOver;
  if (h.phase === "WINDOW") return P.window;
  if (h.phase === "CALL") return P.calling;
  if (h.phase === "TRUMP") return P.trump;
  const led = leadSuit(h.trick ?? []);
  return led ? P.following(SUIT_GLYPH[led]!) : P.open;
}

/** Bhabhi warning (mockup `.warnline`): the viewer cannot follow, so somebody picks the cards up. */
export function breakWarning(view: any, names: readonly string[]): string | null {
  const h = view.hand;
  if (view.game !== "bhabhi" || !h || h.phase !== "PLAY" || h.turn !== mySeat(view) || !h.my_hand) return null;
  const led = leadSuit(h.trick ?? []);
  if (!led || h.my_hand.some((c: string) => c[1] === led)) return null;
  const victim = pickupVictim(h.trick);
  if (victim === null) return null;
  return T.say.breakWarn(SUIT_GLYPH[led]!, nameOf(names, victim), h.trick.length + 1);
}

/** Suits a seat has shown it no longer holds (Bhabhi publishes these). */
export function voidTags(view: any, seat: number, _lang?: Lang): string[] {
  const v = view.hand?.voids?.[seat] as readonly string[] | undefined;
  return v ? v.map((s) => T.say.voidTag(SUIT_GLYPH[s]!)) : [];
}

/* ───────────── what has gone ───────────── */

export type CardStatus = "gone" | "mine" | "out";

/** Cards already played this hand (visible plays only): Callbreak plays, Court Piece tricks, Bhabhi discards. */
export function goneCards(view: any): Set<CardId> {
  const h = view.hand;
  const out = new Set<CardId>();
  if (!h) return out;
  for (const p of (h.trick ?? []) as Trick[]) out.add(p.card);
  if (view.game === "callbreak") for (const c of (h.played ?? []) as CardId[]) out.add(c);
  else if (view.game === "courtpiece") for (const t of (h.history ?? []) as Trick[][]) for (const p of t) out.add(p.card);
  else if (view.game === "bhabhi") for (const c of (h.discards ?? []) as CardId[]) out.add(c);
  return out;
}

/** Status of every rank in a suit for the tracker grid. */
export function trackerRow(view: any, suit: string): { card: CardId; status: CardStatus }[] {
  const gone = goneCards(view);
  const mine = new Set<CardId>((view.hand?.my_hand ?? []) as CardId[]);
  return RANKS_HIGH_FIRST.map((r) => {
    const card = `${r}${suit}`;
    return { card, status: gone.has(card) ? "gone" : mine.has(card) ? "mine" : "out" };
  });
}

/* ───────────── last trick ───────────── */

export interface LastTrick { plays: readonly Trick[]; text: string }

export function lastTrick(view: any, names: readonly string[]): LastTrick | null {
  const S = T.say;
  const h = view.hand;
  if (!h) return null;
  if (view.game === "callbreak" && h.last_trick) {
    const w = h.last_trick_winner as number | null;
    return { plays: h.last_trick, text: w === null ? S.nobodyTook : S.took(nameOf(names, w)) };
  }
  if (view.game === "courtpiece" && h.history?.length) {
    const plays = h.history[h.history.length - 1] as Trick[];
    return { plays, text: h.last_win ? S.took(nameOf(names, h.last_win.seat)) : "" };
  }
  if (view.game === "bhabhi" && h.last_trick) {
    const t = h.last_trick;
    return { plays: t.plays, text: t.outcome === "pickedUp" ? S.pickedUpBroken(nameOf(names, t.seat)) : S.putAside(nameOf(names, t.seat)) };
  }
  return null;
}

/* ───────────── hint ───────────── */

/** Card the hint suggests plus a plain reason, from the viewer's own view. */
export function hintText(view: any, move: SeatMove | null): { title: string; reason: string; card: CardId | null } {
  const H = T.hint;
  if (!move) return { title: H.none, reason: H.noneWhy, card: null };
  const h = view.hand;
  if (move.t === "Play") {
    const led = leadSuit(h?.trick ?? []);
    const trump = trumpOf(view);
    const reason = !led ? H.steadyLead
      : move.card[1] === led ? H.follows
      : trump && move.card[1] === trump ? H.trumpWins
      : view.game === "bhabhi" ? H.shed
      : H.least;
    return { title: cardLabel(move.card), reason, card: move.card };
  }
  if (move.t === "Call") return { title: H.call(move.n), reason: H.callWhy, card: null };
  if (move.t === "ChooseTrump") return { title: H.trump(SUIT_GLYPH[move.suit]!, suitName(move.suit)), reason: H.trumpWhy, card: null };
  if (move.t === "Take") return { title: H.take, reason: H.takeWhy, card: null };
  return { title: H.redeal, reason: H.redealWhy, card: null };
}

/* ───────────── house rules (read-only: the match's compiled rules) ───────────── */

/** `on` is null for a plain fact (no switch), a boolean for a rule that is either on or off. */
export interface RuleRow { title: string; text: string; on: boolean | null }
const yes = (on: boolean, a: string, b: string) => (on ? a : b);

export function houseRules(view: any): RuleRow[] {
  const R = T.rules;
  const r = view.rules;
  if (!r) return [];
  if (view.game === "callbreak") {
    return [
      { title: R.trump, text: R.trumpText(suitName(r.trump), SUIT_GLYPH[r.trump]!), on: null },
      { title: R.calls, text: R.callsText(r.call_min, r.call_max), on: null },
      { title: R.mustBeat, on: r.must_beat, text: yes(r.must_beat, R.mustBeatOn, R.mustBeatOff) },
      { title: R.trumpIfWinning, on: r.trump_if_winning, text: yes(r.trump_if_winning, R.trumpIfWinningOn, R.trumpIfWinningOff) },
      { title: R.overtrick, on: r.overtrick_bonus, text: yes(r.overtrick_bonus, R.overtrickOn, R.overtrickOff) },
      { title: R.redeal, on: r.redeal_on_request, text: yes(r.redeal_on_request, R.redealOn, R.redealOff) },
      { title: R.noSpade, on: r.auto_redeal_no_trump, text: yes(r.auto_redeal_no_trump, R.noSpadeOn, R.noSpadeOff) },
      { title: R.firstLead, on: !r.first_lead_no_trump, text: yes(r.first_lead_no_trump, R.firstLeadNoTrump, R.firstLeadAny) },
      { title: R.direction, on: null, text: r.direction === "clockwise" ? R.clockwise : R.counter },
      { title: R.length, on: null, text: r.scoring === "callbridge" ? R.hands(r.rounds) : R.rounds(r.rounds) },
    ];
  }
  if (view.game === "courtpiece") {
    return [
      { title: R.variant, on: null, text: r.variant === "double" ? R.double : R.single },
      { title: R.aces, on: r.ace_blocks_collect, text: yes(r.ace_blocks_collect, R.acesOn, R.acesOff) },
      { title: R.target, on: null, text: R.targetText(r.target_points) },
      { title: R.handCourt, on: null, text: R.handCourtText(r.hand_points, r.court_points) },
      { title: R.nextDealer, on: null, text: r.dealer_rotation === "pagat" ? R.pagat : R.rotate },
    ];
  }
  if (view.game === "bhabhi") {
    return [
      { title: R.thulla, on: r.thulla === "immediate", text: yes(r.thulla === "immediate", R.thullaOn, R.thullaOff) },
      { title: R.firstAside, on: r.first_trick_discard, text: yes(r.first_trick_discard, R.firstAsideOn, R.firstAsideOff) },
      { title: R.lastCard, on: null, text: (R.empty as Record<string, string>)[r.power_holder_empty] ?? "" },
      { title: R.takeHand, on: r.take_hand, text: yes(r.take_hand, R.takeHandOn, R.takeHandOff) },
      { title: R.twoLeft, on: r.two_player_cut, text: yes(r.two_player_cut, R.twoLeftOn, R.twoLeftOff) },
      { title: R.decks, on: null, text: r.decks === 2 ? R.twoDecks : R.oneDeck },
      { title: R.length, on: null, text: r.bhabhi_limit > 0 ? R.upTo(r.rounds, r.bhabhi_limit) : R.hands(r.rounds) },
      { title: R.deal, on: null, text: r.handicap === 0 ? R.even : R.extra(r.handicap) },
    ];
  }
  return [];
}

/* ───────────── hand order ───────────── */

export type HandSort = "suit" | "rank";
const SUIT_SORT = ["D", "C", "H", "S"]; // alternating colours, spades last

/** By suit: grouped, high to low, suits alternating colour. By rank: high to low across suits. Stable and total. */
export function sortHand(cards: readonly CardId[], mode: HandSort): CardId[] {
  if (mode === "suit") return handOrder(cards);
  return cards.slice().sort((a, b) => rankIdx(b) - rankIdx(a) || SUIT_SORT.indexOf(a[1]!) - SUIT_SORT.indexOf(b[1]!));
}

/* ───────────── turn clock ───────────── */

/** Fraction of the turn left, clamped to [0, 1]. */
export function timeLeftFraction(remainingMs: number, totalMs: number): number {
  return totalMs <= 0 ? 0 : Math.min(1, Math.max(0, remainingMs / totalMs));
}
export const CLOCK_LOW_MS = 5000;
