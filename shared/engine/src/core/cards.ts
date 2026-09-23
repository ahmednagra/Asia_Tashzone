/** P-01 card identity (standard 52-card deck) and P-02 natural order. */
export const SUITS = ["C", "D", "H", "S"] as const; // canonical suit order
export type Suit = (typeof SUITS)[number];
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export type Rank = (typeof RANKS)[number];
/** Card code: rank + suit, e.g. "AS", "TD". Unique in a single deck, so it doubles as the CardUID. */
export type CardId = string;

export const CARD_RE = /^[2-9TJQKA][CDHS]$/;

export function isCardId(x: unknown): x is CardId {
  return typeof x === "string" && CARD_RE.test(x);
}
export function suitOf(c: CardId): Suit { return c[1] as Suit; }
export function rankOf(c: CardId): Rank { return c[0] as Rank; }
/** natural_A_high: 2 → 2 … A → 14 */
export function rankValue(c: CardId): number { return RANKS.indexOf(rankOf(c)) + 2; }
/** Canonical index 0..51 (suit-major). */
export function cardIndex(c: CardId): number { return SUITS.indexOf(suitOf(c)) * 13 + (rankValue(c) - 2); }
export function compareCards(a: CardId, b: CardId): number { return cardIndex(a) - cardIndex(b); }

export function std52(): CardId[] {
  const out: CardId[] = [];
  for (const s of SUITS) for (const r of RANKS) out.push(r + s);
  return out;
}

export function sortCards(cards: readonly CardId[]): CardId[] {
  return cards.slice().sort(compareCards);
}
