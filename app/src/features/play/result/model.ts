/** Result screens' data (pure, tested in Node): built from the SeatView of a finished hand or match, never from hidden state. */
import { formatScore, tableModel } from "../table/logic";
import { mySeat } from "../table/insights";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Tone = "plus" | "minus" | "gold" | "plain";
export interface ResultRow { key: string; label: string; detail?: string; value: string; tone: Tone; mine: boolean }

export interface HandResult {
  /** "Round 3", "Hand 2" */
  title: string;
  headline: string;
  blurb: string;
  rowsTitle: string;
  rows: ResultRow[];
  /** the match continues with another hand */
  hasNext: boolean;
  nextLabel: string;
}

export interface GameResult {
  label: string;
  head: string;
  line: string;
  rowsTitle: string;
  rows: ResultRow[];
  /** what the profile records */
  won: boolean;
  lostBhabhi: boolean;
}

const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
export const ordinal = (n: number): string => ORD[n - 1] ?? `${n}th`;
const nameOf = (names: readonly string[], seat: number) => names[seat] ?? `Seat ${seat + 1}`;
const signed = (tenths: number) => `${tenths > 0 ? "+" : ""}${formatScore(tenths)}`;
const unit = (game: string) => (game === "callbreak" ? "Round" : "Hand");

/** The hand that just finished (call when `view.hand.phase === "DONE"`); null when there is nothing to report. */
export function handResult(view: any, names: readonly string[]): HandResult | null {
  const me = mySeat(view);
  const m = view.match;
  const game: string = view.game ?? "callbreak";
  const done: number = m.hands_played;
  const total: number = view.rules.rounds ?? 0;
  const hasNext = !m.over;
  const base = { title: `${unit(game)} ${done}`, hasNext, nextLabel: hasNext ? `Deal ${unit(game).toLowerCase()} ${done + 1}` : "See the match result" };
  if (game === "callbreak") {
    const last = m.history[m.history.length - 1];
    if (!last) return null;
    const rows: ResultRow[] = (last.calls as number[]).map((call, seat) => ({
      key: String(seat), label: seat === me ? "You" : nameOf(names, seat),
      detail: `called ${call}, won ${last.tricks[seat]}`,
      value: signed(last.deltas[seat]), tone: last.deltas[seat] > 0 ? "plus" : "minus", mine: seat === me,
    }));
    const made = last.deltas[me] > 0;
    return { ...base, headline: made ? "You made your call" : "You missed your call", blurb: "Why the score changed:", rowsTitle: `Round ${done} of ${total}`, rows };
  }
  if (game === "courtpiece") {
    const last = m.results[m.results.length - 1];
    if (!last) return null;
    const myTeam = me % 2;
    const rows: ResultRow[] = [0, 1].map((t) => ({
      key: String(t), label: t === myTeam ? "Your team" : "Other team", detail: `${last.tricks[t]} tricks · ${m.points[t]} points in all`,
      value: `+${last.points[t]}`, tone: last.points[t] > 0 ? "plus" : "plain", mine: t === myTeam,
    }));
    const won = last.winner === myTeam;
    return { ...base, headline: `${won ? "Your team won" : "The other team won"} the hand${last.court ? ": a court" : ""}`, blurb: "Points from this hand:", rowsTitle: "Where the teams stand", rows };
  }
  const last = m.results[m.results.length - 1];
  if (!last) return null;
  const left = view.hand?.counts?.[last.bhabhi];
  const rows: ResultRow[] = [
    ...(last.finish_order as number[]).map((seat, i) => ({ key: `o${seat}`, label: `${i + 1}. ${seat === me ? "You" : nameOf(names, seat)}`, detail: "got away", value: "safe", tone: "plus" as Tone, mine: seat === me })),
    { key: "b", label: `${last.finish_order.length + 1}. ${last.bhabhi === me ? "You" : nameOf(names, last.bhabhi)}`, detail: left === undefined ? undefined : `left with ${left}`, value: "Bhabhi", tone: "minus" as Tone, mine: last.bhabhi === me },
  ];
  return { ...base, headline: last.bhabhi === me ? "You are the Bhabhi" : `${nameOf(names, last.bhabhi)} is the Bhabhi`, blurb: last.bhabhi === me ? "You were left holding the cards." : "You got away.", rowsTitle: "Finishing order", rows };
}

/** The whole match once `view.match.over`. */
export function gameResult(view: any, names: readonly string[]): GameResult | null {
  const tm = tableModel(view, mySeat(view));
  if (!tm.results) return null;
  const me = mySeat(view);
  const game = tm.game;
  const myRow = tm.results.find((r) => r.seat === me);
  const rows: ResultRow[] = tm.results.map((r) => ({
    key: String(r.seat), label: `${r.place ?? "-"}. ${r.seat === me ? "You" : nameOf(names, r.seat)}`,
    value: r.score, tone: r.place === 1 ? "gold" : "plain", mine: r.seat === me,
  }));
  const top = tm.results[0]!;
  if (game === "bhabhi") {
    const counts: readonly number[] = view.match.bhabhi_counts;
    const max = Math.max(...counts);
    const lost = max > 0 && counts[me] === max;
    const worst = counts.indexOf(max);
    return {
      label: lost ? "This match goes against you" : "The match is over",
      head: max === 0 ? "No Bhabhi" : worst === me ? "You" : nameOf(names, worst),
      line: max === 0 ? "Everybody got away." : lost ? "You were left holding the cards most often. That makes you the Bhabhi." : `${nameOf(names, worst)} was left holding the cards most often.`,
      rowsTitle: "Times Bhabhi", rows, won: !lost, lostBhabhi: lost,
    };
  }
  if (game === "courtpiece") {
    const won = (myRow?.place ?? 2) === 1;
    return { label: won ? "Your team takes it" : "The other team takes it", head: won ? "Your team" : "The other team", line: `First to ${view.rules.target_points} points.`, rowsTitle: "Points", rows: [0, 1].map((t) => ({ key: `t${t}`, label: t === me % 2 ? "Your team" : "Other team", value: `${view.match.points[t]} pts`, tone: t === view.match.winner ? "gold" : "plain", mine: t === me % 2 })), won, lostBhabhi: false };
  }
  const won = myRow?.place === 1;
  return {
    label: won ? "You won the match" : "The match is over", head: top.seat === me ? "You" : nameOf(names, top.seat),
    line: myRow?.place ? `You placed ${ordinal(myRow.place)} of ${tm.results.length}.` : "", rowsTitle: "Final scores", rows, won, lostBhabhi: false,
  };
}
