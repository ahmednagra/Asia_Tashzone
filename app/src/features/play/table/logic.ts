/** Pure presentation helpers (tested in Node). Seat mapping keeps the human at the bottom; the table never mirrors in RTL. */
import type { Lang } from "../../../i18n";
import type { CardId } from "@tashzone/engine";
import { CARD, T } from "./copy";

export type Position = "bottom" | "right" | "top" | "left";
/** Seats are clockwise; with the human at the bottom, the next clockwise seat sits on the left. */
export function positionOf(seat: number, human: number): Position {
  return (["bottom", "left", "top", "right"] as const)[(seat - human + 4) % 4]!;
}

export const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export function suitName(suit: string): string {
  return (CARD.suits as Record<string, string>)[suit] ?? suit;
}
export const seatName = (names: readonly string[] | undefined, seat: number): string => names?.[seat] ?? T.seat(seat + 1);

/** Screen-reader name (§14): "Queen of Hearts, playable". */
export function cardLabel(card: CardId, playable?: boolean): string {
  const r = (CARD.ranks as Record<string, string>)[card[0]!] ?? card[0]!;
  const base = CARD.card(r, suitName(card[1]!), card[0] === "Q");
  return playable === undefined ? base : CARD.playable(base, playable);
}
export function rankLabel(card: CardId): string { return card[0] === "T" ? "10" : card[0]!; }

/** Group own hand by suit with trumps last (alternating colours) for the fan. */
export function handOrder(cards: readonly CardId[]): CardId[] {
  const suitOrder = ["D", "C", "H", "S"];
  const rank = "23456789TJQKA";
  return cards.slice().sort((a, b) => suitOrder.indexOf(a[1]!) - suitOrder.indexOf(b[1]!) || rank.indexOf(b[0]!) - rank.indexOf(a[0]!));
}

/**
 * Fan geometry: overlap tightens as the hand grows. The visible strip of a covered card stays ≥ 28 dp
 * (its hit area is extended toward the uncovered edge to reach 44 dp, §14); otherwise, or when text is
 * scaled ≥ 150 %, the hand switches to two rows.
 */
export const MIN_STRIP = 28;
export function fanLayout(count: number, width: number, cardWidth: number, textScale = 1, layout: "fan" | "spread" = "fan") {
  if (layout === "spread") {
    // every card whole: tile in as many rows as needed, never overlapping
    const step = cardWidth + 4;
    const perRow = Math.max(1, Math.floor((width - cardWidth) / step) + 1);
    return { rows: Math.max(1, Math.ceil(count / perRow)), perRow, step };
  }
  const calc = (rows: number) => {
    const perRow = Math.ceil(count / rows);
    const step = perRow <= 1 ? 0 : Math.min(cardWidth * 0.62, (width - cardWidth) / (perRow - 1));
    return { rows, perRow, step };
  };
  const one = calc(1);
  if (count > 7 && (textScale >= 1.5 || one.step < MIN_STRIP)) return calc(2);
  return one;
}

export interface HandSpot { x: number; y: number; drop: number; rot: number; z: number; slopRight: number }

export function handGeometry(count: number, maxWidth: number, cardWidth: number, layout: "fan" | "spread" = "fan", textScale = 1): { cardW: number; height: number; rows: number; spots: HandSpot[] } {
  if (count <= 0) return { cardW: cardWidth, height: 0, rows: 0, spots: [] };
  const spread = layout === "spread";
  const want = count > 6 ? Math.ceil(count / 2) : count;
  const w = spread
    ? Math.max(40, Math.min(cardWidth, Math.floor((maxWidth - (want - 1) * 4) / want)))
    : Math.min(cardWidth, Math.max(46, Math.floor(maxWidth / (count > 8 ? 6.5 : 5.2))));
  const h = Math.round(w * 1.4);
  const l = fanLayout(count, maxWidth, w, textScale, layout);
  const pitch = spread ? h + 6 : Math.round(h * 0.52);
  const spots: HandSpot[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / l.perRow);
    const col = i % l.perRow;
    const inRow = Math.min(l.perRow, count - row * l.perRow);
    const span = w + (inRow - 1) * l.step;
    const u = col - (inRow - 1) / 2;
    spots.push({
      x: Math.max(0, (maxWidth - span) / 2) + col * l.step,
      y: 14 + row * pitch,
      drop: spread ? 0 : Math.min(12, u * u * (inRow > 7 ? 0.38 : 0.55)),
      rot: spread ? 0 : u * Math.min(2.8, 30 / inRow),
      z: row * 100 + col + 1,
      slopRight: col < inRow - 1 ? Math.max(0, l.step - w + 6) : 10,
    });
  }
  return { cardW: w, height: h + (l.rows - 1) * pitch + 26, rows: l.rows, spots };
}

export function formatScore(tenths: number): string {
  const sign = tenths < 0 ? "−" : "";
  const a = Math.abs(tenths);
  return `${sign}${Math.floor(a / 10)}.${a % 10}`;
}

/* ───────────── Any table size (Bhabhi 3–8) ───────────── */

export type Area = "bottom" | "left" | "top" | "right";
/**
 * Where each seat sits for an n-seat table, human at the bottom, the rest clockwise from the left:
 * left side, then across the top, then the right side. Four seats match `positionOf` exactly.
 */
export function ringAreas(n: number, human: number): Area[] {
  const others = n - 1;
  // one seat on each side up to 6 players (the top row holds up to 3), two per side for 7–8
  const side = others <= 5 ? 1 : 2;
  const left = side, right = side;
  const top = others - left - right;
  const byOffset: Area[] = [...Array(left).fill("left"), ...Array(top).fill("top"), ...Array(right).fill("right")];
  return Array.from({ length: n }, (_, seat) => (seat === human ? "bottom" : byOffset[(seat - human + n) % n - 1]!));
}

export interface SeatInfo {
  readonly seat: number;
  readonly area: Area;
  /** short status under the name: "3/4" (tricks/call), "Team A · 5", "9 cards", "Away 1st" */
  readonly badge: string;
  readonly spoken: string;
  readonly isTurn: boolean;
  readonly dealer: boolean;
  readonly out: boolean;
}

export interface TableModel {
  readonly game: string;
  readonly seats: readonly SeatInfo[];
  readonly trick: readonly { seat: number; card: CardId }[];
  readonly hud: readonly { readonly text: string; readonly points?: boolean }[];
  readonly notice: string | null;
  readonly results: readonly { seat: number; place: number | null; score: string }[] | null;
}

/** Presentation model from a SeatView of any game (the view is the only input: nothing hidden can appear). */
export function tableModel(view: any, human: number, names?: readonly string[], _lang?: Lang): TableModel {
  const h = view.hand;
  const game: string = view.game ?? "callbreak";
  const n: number = game === "bhabhi" ? view.rules.players : 4;
  const areas = ringAreas(n, human);
  const M = T.model;
  const suit = (x: string | null) => (x ? `${SUIT_GLYPH[x]} ${suitName(x)}` : M.notChosen);
  const seats: SeatInfo[] = areas.map((area, seat) => {
    let badge = "–";
    let spoken = "";
    let out = false;
    if (game === "callbreak" && h) {
      const call = h.calls[seat];
      badge = call === null ? "–" : `${h.tricks[seat]}/${call}`;
      spoken = call === null ? "" : M.spokenCall(call, h.tricks[seat]);
    } else if (game === "courtpiece" && h) {
      const team = seat % 2;
      const letter = team === 0 ? "A" : "B";
      badge = M.teamBadge(letter, h.team_tricks[team]);
      spoken = M.teamSpoken(letter, h.team_tricks[team]);
    } else if (game === "bhabhi" && h) {
      out = h.out[seat];
      const place = h.finish_order.indexOf(seat);
      const ord = place >= 0 ? CARD.ord(place + 1) : "";
      badge = out ? M.awayBadge(ord) : T.cards(h.counts[seat]);
      spoken = out ? M.awaySpoken(ord) : T.cards(h.counts[seat]);
    }
    return { seat, area, badge, spoken, isTurn: h?.turn === seat, dealer: h?.dealer === seat, out };
  });
  const hud: { text: string; points?: boolean }[] = [];
  const reason = (r: unknown) => (M.reasons as Record<string, string>)[String(r)] ?? String(r).replace(/_/g, " ");
  let notice: string | null = h?.annulled ? M.annulled(reason(h.annulled)) : null;
  if (game === "callbreak") {
    hud.push(
      { text: h ? M.handOf(view.match.hands_played + (h.phase === "DONE" ? 0 : 1), view.rules.rounds) : M.shuffling },
      { text: M.trumpAlways(suitName(view.rules.trump), SUIT_GLYPH[view.rules.trump]!) },
    );
  } else if (game === "courtpiece") {
    hud.push(
      { text: M.sir(view.rules.variant === "double", view.rules.target_points) },
      { text: M.pointsAB(view.match.points[0], view.match.points[1]), points: true },
    );
    if (h) hud.push({ text: M.trumpIs(suit(h.trump)) });
    if (h && h.pile > 0) hud.push({ text: M.pile(h.pile) });
    if (h?.phase === "TRUMP" && h.turn !== human) notice = notice ?? M.waitingTrump;
  } else if (game === "bhabhi") {
    hud.push(
      { text: M.handOf(view.match.hands_played + (h && h.phase !== "DONE" ? 1 : 0), view.rules.rounds) },
      { text: h ? M.pile(h.waste_count) : M.shuffling },
    );
    if (h?.last_trick) {
      const who = h.last_trick.seat;
      notice = notice ?? (h.last_trick.outcome === "pickedUp" ? M.pickedUpTrick(seatName(names, who)) : M.trickAside);
    }
  }
  let results: TableModel["results"] = null;
  if (view.match.over) {
    const placements: readonly number[] | null = view.match.placements ?? (game === "courtpiece" && view.match.winner !== null ? [0, 1, 2, 3].map((x) => (x % 2 === view.match.winner ? 1 : 2)) : null);
    results = Array.from({ length: n }, (_, seat) => ({
      seat, place: placements?.[seat] ?? null,
      score: game === "callbreak" ? formatScore(view.match.totals[seat]) : game === "courtpiece" ? M.pts(view.match.points[seat % 2]) : M.timesBhabhi(view.match.bhabhi_counts[seat]),
    })).sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || a.seat - b.seat);
  }
  return { game, seats, trick: h?.trick ?? [], hud, notice, results };
}

/**
 * Where a played card lands on the felt, relative to the middle of the trick area: it sits toward the seat that
 * played it. Several seats on one side (5–8 players) fan out along that side by `index` among them.
 */
export function trickOffset(area: Area, index: number, spread = 22): { x: number; y: number } {
  const along = (index - 0.5) * spread * 0.9;
  switch (area) {
    case "bottom": return { x: index * spread, y: 30 };
    case "top": return { x: along, y: -30 };
    case "left": return { x: -38, y: along };
    case "right": return { x: 38, y: along };
  }
}
