import { formatScore } from "../play/table/logic";

/** `result` of the server's MatchEnded frame: engine `summary` plus the game id. */
export interface MatchResult { game?: string; totals?: readonly number[]; placements?: readonly number[] | null }

export interface StandingRow { seat: number; name: string; place: number | null; score: string; you: boolean }

/** Player-facing score for one seat's total (Callbreak / Call Bridge in tenths, Court Piece team points, Bhabhi count). */
export function scoreLabel(game: string | undefined, total: number): string {
  if (game === "bhabhi") return `${total}× Bhabhi`;
  if (game === "courtpiece") return `${total} pts`;
  return formatScore(total);
}

/** Rows sorted best place first (ties keep seat order). Interrupted matches have no places. */
export function standings(result: MatchResult | null, names: readonly string[], mySeat: number | null): StandingRow[] {
  const totals = result?.totals ?? [];
  return totals
    .map((t, seat) => ({ seat, name: names[seat] || `Seat ${seat + 1}`, place: result?.placements?.[seat] ?? null, score: scoreLabel(result?.game, t), you: seat === mySeat }))
    .sort((a, b) => (a.place ?? 99) - (b.place ?? 99) || a.seat - b.seat);
}
