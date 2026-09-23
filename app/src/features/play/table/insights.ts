/**
 * What the table can say about itself, derived from a SeatView only (pure, tested in Node): the one-line
 * instruction, what has gone, the last trick, shown voids, the hint explanation, the active house rules,
 * hand sorting and the turn clock. Nothing here can reveal a card the viewer may not know.
 */
import type { CardId, SeatMove } from "@tashzone/engine";
import { SUIT_GLYPH, cardLabel, handOrder } from "./logic";

export const SUIT_NAME: Record<string, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
const RANK_ORDER = "23456789TJQKA";
export const RANKS_HIGH_FIRST: readonly string[] = RANK_ORDER.split("").reverse();
export const SUITS_ORDER: readonly string[] = ["S", "H", "D", "C"];
const rankIdx = (c: string) => RANK_ORDER.indexOf(c[0]!);
const nameOf = (names: readonly string[], seat: number) => names[seat] ?? `Seat ${seat + 1}`;

/* eslint-disable @typescript-eslint/no-explicit-any */

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
  const h = view.hand;
  const me = mySeat(view);
  if (view.match?.over) return "Match over";
  if (!h) return "Shuffling and dealing";
  if (h.phase === "DONE") return "Hand over";
  const legal: readonly SeatMove[] = view.legal ?? [];
  if (h.phase === "WINDOW") return legal.some((m) => m.t === "RequestRedeal") ? "Weak hand? You may ask for a redeal" : "Redeal window open";
  if (h.phase === "CALL") return h.turn === me ? "Choose how many tricks you will win" : `${nameOf(names, h.turn)} is calling`;
  if (h.phase === "TRUMP") return h.turn === me ? "You name trump" : "Waiting for trump to be chosen";
  if (h.turn !== me) {
    if (view.game === "bhabhi" && legal.some((m) => m.t === "Take")) return "You may take the next player's cards";
    return h.turn === null || h.turn === undefined ? "" : `${nameOf(names, h.turn)} is playing`;
  }
  const trick: readonly Trick[] = h.trick ?? [];
  const plays = legal.filter((m): m is Extract<SeatMove, { t: "Play" }> => m.t === "Play");
  const led = leadSuit(trick);
  if (!led) {
    if (plays.length === 1 && plays[0]!.card === "AS" && view.game === "bhabhi" && h.first_trick) return "Lead the Ace of Spades";
    return "Your lead: play any card";
  }
  const have = (h.my_hand as readonly CardId[] | null)?.some((c) => c[1] === led) ?? false;
  if (have) return `Follow ${SUIT_GLYPH[led]} ${SUIT_NAME[led]}`;
  return view.game === "bhabhi" ? `No ${SUIT_GLYPH[led]}: anything you play breaks the suit` : `No ${SUIT_GLYPH[led]}: play a trump or any card`;
}

/** Top-bar line: who acts. `mine` says whether to draw it in gold. */
export function statusLine(view: any, names: readonly string[]): { text: string; mine: boolean } {
  const h = view.hand;
  const me = mySeat(view);
  if (view.match?.over) return { text: "Match over", mine: false };
  if (!h) return { text: "Dealing", mine: false };
  if (h.phase === "DONE") return { text: "Hand over", mine: false };
  if (h.phase === "WINDOW") return { text: "Redeal window", mine: false };
  const mine = h.turn === me || (view.legal ?? []).some((m: SeatMove) => m.t === "Take");
  if (h.turn === me) return { text: `Your turn: ${instructionLine(view, names).replace(/^Your lead: /, "").replace(/^\w/, (x) => x.toLowerCase())}`, mine };
  return { text: h.turn === null || h.turn === undefined ? "Waiting" : `${nameOf(names, h.turn)} is playing`, mine };
}

/** Small lower-case caption over the felt (mockup `.phase`). */
export function phaseWord(view: any): string {
  const h = view.hand;
  if (view.match?.over) return "match over";
  if (!h) return "dealing";
  if (h.phase === "DONE") return "hand over";
  if (h.phase === "WINDOW") return "redeal window";
  if (h.phase === "CALL") return "calling";
  if (h.phase === "TRUMP") return "choosing trump";
  const led = leadSuit(h.trick ?? []);
  return led ? `following ${SUIT_GLYPH[led]}` : "open lead";
}

/** Bhabhi warning (mockup `.warnline`): the viewer cannot follow, so somebody picks the cards up. */
export function breakWarning(view: any, names: readonly string[]): string | null {
  const h = view.hand;
  if (view.game !== "bhabhi" || !h || h.phase !== "PLAY" || h.turn !== mySeat(view) || !h.my_hand) return null;
  const led = leadSuit(h.trick ?? []);
  if (!led || h.my_hand.some((c: string) => c[1] === led)) return null;
  const victim = pickupVictim(h.trick);
  if (victim === null) return null;
  return `You have no ${SUIT_GLYPH[led]}: whatever you play, ${nameOf(names, victim)} picks up ${h.trick.length + 1} cards`;
}

/** Suits a seat has shown it no longer holds (Bhabhi publishes these). */
export function voidTags(view: any, seat: number): string[] {
  const v = view.hand?.voids?.[seat] as readonly string[] | undefined;
  return v ? v.map((s) => `no ${SUIT_GLYPH[s]}`) : [];
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
  const h = view.hand;
  if (!h) return null;
  if (view.game === "callbreak" && h.last_trick) {
    const w = h.last_trick_winner as number | null;
    return { plays: h.last_trick, text: w === null ? "Nobody took it." : `${nameOf(names, w)} took it.` };
  }
  if (view.game === "courtpiece" && h.history?.length) {
    const plays = h.history[h.history.length - 1] as Trick[];
    return { plays, text: h.last_win ? `${nameOf(names, h.last_win.seat)} took it.` : "" };
  }
  if (view.game === "bhabhi" && h.last_trick) {
    const t = h.last_trick;
    return { plays: t.plays, text: t.outcome === "pickedUp" ? `${nameOf(names, t.seat)} picked it up: the suit was broken.` : `Put aside. ${nameOf(names, t.seat)} keeps the lead.` };
  }
  return null;
}

/* ───────────── hint ───────────── */

/** Card the hint suggests plus a plain reason, from the viewer's own view. */
export function hintText(view: any, move: SeatMove | null): { title: string; reason: string; card: CardId | null } {
  if (!move) return { title: "Nothing to play right now", reason: "Hints appear when it is your turn.", card: null };
  const h = view.hand;
  if (move.t === "Play") {
    const led = leadSuit(h?.trick ?? []);
    const trump = trumpOf(view);
    const reason = !led ? "A steady lead from this hand."
      : move.card[1] === led ? "Follows the suit without spending more than it must."
      : trump && move.card[1] === trump ? "You cannot follow the suit, so a trump can win the trick."
      : view.game === "bhabhi" ? "You cannot follow the suit; this card sheds the least useful one."
      : "You cannot follow the suit; this card gives up the least.";
    return { title: cardLabel(move.card), reason, card: move.card };
  }
  if (move.t === "Call") return { title: `Call ${move.n}`, reason: "Estimated from the strength of your cards.", card: null };
  if (move.t === "ChooseTrump") return { title: `${SUIT_GLYPH[move.suit]} ${SUIT_NAME[move.suit]} as trump`, reason: "Your longest, strongest suit.", card: null };
  if (move.t === "Take") return { title: "Take the next player's cards", reason: "They get away, and you keep the tempo.", card: null };
  return { title: "Ask for a redeal", reason: "Your hand is weak enough to try again.", card: null };
}

/* ───────────── house rules (read-only: the match's compiled rules) ───────────── */

/** `on` is null for a plain fact (no switch), a boolean for a rule that is either on or off. */
export interface RuleRow { title: string; text: string; on: boolean | null }
const yes = (on: boolean, a: string, b: string) => (on ? a : b);
const HOW_EMPTY: Record<string, string> = {
  drawFromWaste: "Win with your last card and you draw from the pile.",
  drawFromNext: "Win with your last card and you draw from the next player.",
  escapeIfThreePlus: "Win with your last card and you get away if three or more remain.",
  passToNext: "Win with your last card and the lead passes on.",
};

export function houseRules(view: any): RuleRow[] {
  const r = view.rules;
  if (!r) return [];
  if (view.game === "callbreak") {
    return [
      { title: "Trump", text: `${SUIT_NAME[r.trump]} ${SUIT_GLYPH[r.trump]} are always trump.`, on: null },
      { title: "Calls", text: `Call ${r.call_min} to ${r.call_max} tricks.`, on: null },
      { title: "Beat the trick when you can", on: r.must_beat, text: yes(r.must_beat, "Holding a card that wins, you must play one.", "Follow suit with any card, high or low.") },
      { title: "Trump when you cannot follow", on: r.trump_if_winning, text: yes(r.trump_if_winning, "With no card of the led suit you must trump if it wins.", "With no card of the led suit you may play anything.") },
      { title: "Extra tricks score", on: r.overtrick_bonus, text: yes(r.overtrick_bonus, "Each trick above your call adds 0.1.", "Tricks above your call add nothing.") },
      { title: "Redeal on request", on: r.redeal_on_request, text: yes(r.redeal_on_request, "A weak hand may ask for a redeal in the window.", "No redeal requests.") },
      { title: "Hand without a spade", on: r.auto_redeal_no_trump, text: yes(r.auto_redeal_no_trump, "Redealt automatically by the same dealer.", "Played as dealt.") },
      { title: "First lead", on: !r.first_lead_no_trump, text: yes(r.first_lead_no_trump, "The first lead of a hand may not be a spade.", "Any card may open the hand.") },
      { title: "Direction", on: null, text: r.direction === "clockwise" ? "Play runs clockwise." : "Play runs counter-clockwise." },
      { title: "Length", on: null, text: `${r.rounds} ${r.scoring === "callbridge" ? "hands" : "rounds"}.` },
    ];
  }
  if (view.game === "courtpiece") {
    return [
      { title: "Variant", on: null, text: r.variant === "double" ? "Double Sir: win two tricks in a row to collect the pile." : "Single Sir: the first team to seven tricks wins the hand." },
      { title: "Aces block a collect", on: r.ace_blocks_collect, text: yes(r.ace_blocks_collect, "Two aces in a row do not collect the pile.", "Aces count like any other card.") },
      { title: "Points to win", on: null, text: `First to ${r.target_points}.` },
      { title: "Hand and court", on: null, text: `A hand is worth ${r.hand_points}, a court ${r.court_points}.` },
      { title: "Next dealer", on: null, text: r.dealer_rotation === "pagat" ? "The losing side deals next." : "The deal moves one seat each hand." },
    ];
  }
  if (view.game === "bhabhi") {
    return [
      { title: "Thulla ends the trick", on: r.thulla === "immediate", text: yes(r.thulla === "immediate", "An off-suit card ends the trick at once.", "Everyone plays, then the pickup happens.") },
      { title: "First trick is put aside", on: r.first_trick_discard, text: yes(r.first_trick_discard, "The ace-of-spades trick is always set aside.", "The first trick can be picked up.") },
      { title: "Last card", on: null, text: HOW_EMPTY[r.power_holder_empty] ?? "" },
      { title: "Take the hand", on: r.take_hand, text: yes(r.take_hand, "Before a trick you may take the next player's cards.", "Hands cannot be taken.") },
      { title: "Two players left", on: r.two_player_cut, text: yes(r.two_player_cut, "A card drawn from the pile is led and cut.", "Played out like any other trick.") },
      { title: "Decks", on: null, text: r.decks === 2 ? "Two decks; identical cards: the first played wins." : "One deck." },
      { title: "Length", on: null, text: r.bhabhi_limit > 0 ? `Up to ${r.rounds} hands, or until someone is Bhabhi ${r.bhabhi_limit} times.` : `${r.rounds} ${r.rounds === 1 ? "hand" : "hands"}.` },
      { title: "Deal", on: null, text: r.handicap === 0 ? "Even deal." : `You start with ${r.handicap} extra cards.` },
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
