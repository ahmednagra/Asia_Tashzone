/**
 * Trick-taking family helpers shared by Callbreak, Court Piece and (the follow helpers) Bhabhi.
 * Ported from TashZone v1 `families/trick-taking.ts`; behaviour is identical.
 */
import { type CardId, type Suit, SUITS, rankValue, suitOf } from "../core/cards.js";

export interface PlayedCard { readonly seat: number; readonly card: CardId }

export interface FollowRules {
  readonly trump: Suit | null;
  /** Must beat the highest card of the led suit when able, unless a trump is already in the trick. */
  readonly mustBeat: boolean;
  /** Void in the led suit: must play a trump when holding one. */
  readonly mustTrump: boolean;
  /** When trumping over a trump: must beat the highest trump when able; otherwise free to play anything. */
  readonly mustOvertrump: boolean;
}

export const FREE_FOLLOW: FollowRules = { trump: null, mustBeat: false, mustTrump: false, mustOvertrump: false };

export const cardsOfSuit = (cards: readonly CardId[], suit: Suit): CardId[] => cards.filter((c) => suitOf(c) === suit);

/** Winning play: highest trump if any trump was played, otherwise highest card of the led suit. First played wins ties (two decks). */
export function trickWinner(plays: readonly PlayedCard[], trump: Suit | null): PlayedCard {
  const [first, ...rest] = plays;
  if (!first) throw new Error("trickWinner on empty trick");
  let best = first;
  for (const p of rest) {
    const s = suitOf(p.card);
    const bs = suitOf(best.card);
    if (trump !== null && s === trump && bs !== trump) best = p;
    else if (s === bs && rankValue(p.card) > rankValue(best.card)) best = p;
  }
  return best;
}

export function highestOfLed(plays: readonly PlayedCard[]): PlayedCard {
  return trickWinner(plays, null);
}

export function legalCards(hand: readonly CardId[], plays: readonly PlayedCard[], rules: FollowRules): CardId[] {
  const first = plays[0];
  if (!first) return hand.slice();
  const led = suitOf(first.card);
  const followers = cardsOfSuit(hand, led);
  const { trump } = rules;
  const trumpInTrick = trump !== null && led !== trump && plays.some((p) => suitOf(p.card) === trump);
  if (followers.length > 0) {
    if (!rules.mustBeat || trumpInTrick) return followers;
    const top = Math.max(...plays.filter((p) => suitOf(p.card) === led).map((p) => rankValue(p.card)));
    const beaters = followers.filter((c) => rankValue(c) > top);
    return beaters.length > 0 ? beaters : followers;
  }
  if (trump !== null && rules.mustTrump) {
    const trumps = cardsOfSuit(hand, trump);
    if (trumps.length > 0) {
      if (!rules.mustOvertrump || !trumpInTrick) return trumps;
      const top = Math.max(...plays.filter((p) => suitOf(p.card) === trump).map((p) => rankValue(p.card)));
      const over = trumps.filter((c) => rankValue(c) > top);
      return over.length > 0 ? over : hand.slice();
    }
  }
  return hand.slice();
}

/** Why a card is illegal (null when legal), from the player's own hand and the public trick. */
export function followError(hand: readonly CardId[], plays: readonly PlayedCard[], rules: FollowRules, card: CardId): "CARD_NOT_IN_HAND" | "MUST_BEAT" | "MUST_FOLLOW_SUIT" | "MUST_OVERTRUMP" | "MUST_TRUMP" | null {
  if (!hand.includes(card)) return "CARD_NOT_IN_HAND";
  if (legalCards(hand, plays, rules).includes(card)) return null;
  const led = suitOf(plays[0]!.card);
  if (cardsOfSuit(hand, led).length > 0) return suitOf(card) === led ? "MUST_BEAT" : "MUST_FOLLOW_SUIT";
  if (rules.trump !== null && suitOf(card) === rules.trump) return "MUST_OVERTRUMP";
  return "MUST_TRUMP";
}

/** Suits each seat has shown to be void in, from public tricks only. */
export function inferVoids(players: number, tricks: readonly (readonly PlayedCard[])[]): Suit[][] {
  const voids = Array.from({ length: players }, () => new Set<Suit>());
  for (const t of tricks) {
    const first = t[0];
    if (!first) continue;
    const led = suitOf(first.card);
    for (const p of t.slice(1)) if (suitOf(p.card) !== led) voids[p.seat]?.add(led);
  }
  return voids.map((v) => SUITS.filter((s) => v.has(s)));
}

/** Removes one copy of each listed card (two-deck games hold identical cards). Missing cards are ignored. */
export function removeEach(cards: readonly CardId[], remove: readonly CardId[]): CardId[] {
  const next = cards.slice();
  for (const card of remove) {
    const i = next.indexOf(card);
    if (i >= 0) next.splice(i, 1);
  }
  return next;
}

export function removeOne(cards: readonly CardId[], card: CardId): CardId[] {
  const i = cards.indexOf(card);
  if (i < 0) throw new Error(`card ${card} not found`);
  return [...cards.slice(0, i), ...cards.slice(i + 1)];
}

export const highest = (cards: readonly CardId[]): CardId | undefined =>
  cards.reduce<CardId | undefined>((best, c) => (!best || rankValue(c) > rankValue(best) ? c : best), undefined);

export const lowest = (cards: readonly CardId[]): CardId | undefined =>
  cards.reduce<CardId | undefined>((best, c) => (!best || rankValue(c) < rankValue(best) ? c : best), undefined);

/** Multiset equality of card lists (conservation checks, two-deck aware). */
export function sameCards(a: readonly CardId[], b: readonly CardId[]): boolean {
  if (a.length !== b.length) return false;
  const x = a.slice().sort();
  const y = b.slice().sort();
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}
