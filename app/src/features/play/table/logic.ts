/** Pure presentation helpers (tested in Node). Seat mapping keeps the human at the bottom; the table never mirrors in RTL. */
import type { CardId } from "@tashzone/engine";

export type Position = "bottom" | "right" | "top" | "left";
/** Seats are clockwise; with the human at the bottom, the next clockwise seat sits on the left. */
export function positionOf(seat: number, human: number): Position {
  return (["bottom", "left", "top", "right"] as const)[(seat - human + 4) % 4]!;
}

const RANK_NAMES: Record<string, string> = { A: "Ace", K: "King", Q: "Queen", J: "Jack", T: "10" };
const SUIT_NAMES: Record<string, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
export const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

/** Screen-reader name (§14): "Queen of Hearts, playable". */
export function cardLabel(card: CardId, playable?: boolean): string {
  const r = RANK_NAMES[card[0]!] ?? card[0]!;
  const base = `${r} of ${SUIT_NAMES[card[1]!]}`;
  return playable === undefined ? base : `${base}, ${playable ? "playable" : "not playable"}`;
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
  readonly hud: readonly string[];
  readonly notice: string | null;
  readonly results: readonly { seat: number; place: number | null; score: string }[] | null;
}

const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

/** Presentation model from a SeatView of any game (the view is the only input: nothing hidden can appear). */
 
export function tableModel(view: any, human: number, names?: readonly string[]): TableModel {
  const h = view.hand;
  const game: string = view.game ?? "callbreak";
  const n: number = game === "bhabhi" ? view.rules.players : 4;
  const areas = ringAreas(n, human);
  const suit = (x: string | null) => (x ? `${SUIT_GLYPH[x]} ${SUIT_NAMES[x]}` : "not chosen yet");
  const seats: SeatInfo[] = areas.map((area, seat) => {
    let badge = "–";
    let spoken = "";
    let out = false;
    if (game === "callbreak" && h) {
      const call = h.calls[seat];
      badge = call === null ? "–" : `${h.tricks[seat]}/${call}`;
      spoken = call === null ? "" : `called ${call}, won ${h.tricks[seat]}`;
    } else if (game === "courtpiece" && h) {
      const team = seat % 2;
      badge = `Team ${team === 0 ? "A" : "B"} · ${h.team_tricks[team]}`;
      spoken = `team ${team === 0 ? "A" : "B"}, ${h.team_tricks[team]} tricks`;
    } else if (game === "bhabhi" && h) {
      out = h.out[seat];
      const place = h.finish_order.indexOf(seat);
      badge = out ? `Away ${ORD[place] ?? ""}` : `${h.counts[seat]} cards`;
      spoken = out ? `got away ${ORD[place] ?? ""}` : `${h.counts[seat]} cards`;
    }
    return { seat, area, badge, spoken, isTurn: h?.turn === seat, dealer: h?.dealer === seat, out };
  });
  const hud: string[] = [];
  let notice: string | null = h?.annulled ? `Hand annulled (${String(h.annulled).replace(/_/g, " ")}). Same dealer deals again.` : null;
  if (game === "callbreak") {
    hud.push(h ? `Hand ${view.match.hands_played + (h.phase === "DONE" ? 0 : 1)} of ${view.rules.rounds}` : "Shuffling", `${SUIT_NAMES[view.rules.trump]} are trump ${SUIT_GLYPH[view.rules.trump]}`);
  } else if (game === "courtpiece") {
    hud.push(`${view.rules.variant === "double" ? "Double" : "Single"} Sir · to ${view.rules.target_points}`, `Points A ${view.match.points[0]} · B ${view.match.points[1]}`);
    if (h) hud.push(`Trump: ${suit(h.trump)}`);
    if (h && h.pile > 0) hud.push(`Pile ${h.pile}`);
    if (h?.phase === "TRUMP" && h.turn !== human) notice = notice ?? "Waiting for trump to be chosen";
  } else if (game === "bhabhi") {
    hud.push(`Hand ${view.match.hands_played + (h && h.phase !== "DONE" ? 1 : 0)} of ${view.rules.rounds}`, h ? `Pile ${h.waste_count}` : "Shuffling");
    if (h?.last_trick) {
      const who = h.last_trick.seat;
      notice = notice ?? (h.last_trick.outcome === "pickedUp" ? `${names?.[who] ?? `Seat ${who + 1}`} picked up the trick` : "Trick put aside");
    }
  }
  let results: TableModel["results"] = null;
  if (view.match.over) {
    const placements: readonly number[] | null = view.match.placements ?? (game === "courtpiece" && view.match.winner !== null ? [0, 1, 2, 3].map((x) => (x % 2 === view.match.winner ? 1 : 2)) : null);
    results = Array.from({ length: n }, (_, seat) => ({
      seat, place: placements?.[seat] ?? null,
      score: game === "callbreak" ? formatScore(view.match.totals[seat]) : game === "courtpiece" ? `${view.match.points[seat % 2]} pts` : `${view.match.bhabhi_counts[seat]}× Bhabhi`,
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
