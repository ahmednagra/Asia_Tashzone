/** Result screens' data (pure, tested in Node): built from the SeatView of a finished hand or match, never from hidden state. */
import { formatScore, seatName, tableModel } from "../table/logic";
import { mySeat } from "../table/insights";
import { CARD, T } from "../table/copy";
import { R } from "./copy";


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

export const ordinal = (n: number): string => CARD.ord(n);
const nameOf = (names: readonly string[], seat: number) => seatName(names, seat);
const signed = (tenths: number) => `${tenths > 0 ? "+" : ""}${formatScore(tenths)}`;

/** The hand that just finished (call when `view.hand.phase === "DONE"`); null when there is nothing to report. */
export function handResult(view: any, names: readonly string[]): HandResult | null {
  const me = mySeat(view);
  const m = view.match;
  const game: string = view.game ?? "callbreak";
  const done: number = m.hands_played;
  const total: number = view.rules.rounds ?? 0;
  const hasNext = !m.over;
  const round = game === "callbreak";
  const base = { title: round ? R.round(done) : R.hand(done), hasNext, nextLabel: hasNext ? (round ? R.dealRound(done + 1) : R.dealHand(done + 1)) : R.seeMatch };
  if (game === "callbreak") {
    const last = m.history[m.history.length - 1];
    if (!last) return null;
    const rows: ResultRow[] = (last.calls as number[]).map((call, seat) => ({
      key: String(seat), label: seat === me ? R.you : nameOf(names, seat),
      detail: R.calledWon(call, last.tricks[seat]),
      value: signed(last.deltas[seat]), tone: last.deltas[seat] > 0 ? "plus" : "minus", mine: seat === me,
    }));
    const made = last.deltas[me] > 0;
    return { ...base, headline: made ? R.madeCall : R.missedCall, blurb: R.whyScore, rowsTitle: R.roundOf(done, total), rows };
  }
  if (game === "courtpiece") {
    const last = m.results[m.results.length - 1];
    if (!last) return null;
    const myTeam = me % 2;
    const rows: ResultRow[] = [0, 1].map((t) => ({
      key: String(t), label: t === myTeam ? R.yourTeam : R.otherTeam, detail: R.teamDetail(last.tricks[t], m.points[t]),
      value: `+${last.points[t]}`, tone: last.points[t] > 0 ? "plus" : "plain", mine: t === myTeam,
    }));
    const won = last.winner === myTeam;
    return { ...base, headline: R.teamWonHand(won, !!last.court), blurb: R.pointsFromHand, rowsTitle: R.teamsStand, rows };
  }
  const last = m.results[m.results.length - 1];
  if (!last) return null;
  const left = view.hand?.counts?.[last.bhabhi];
  const rows: ResultRow[] = [
    ...(last.finish_order as number[]).map((seat, i) => ({ key: `o${seat}`, label: `${i + 1}. ${seat === me ? R.you : nameOf(names, seat)}`, detail: R.gotAway, value: R.safe, tone: "plus" as Tone, mine: seat === me })),
    { key: "b", label: `${last.finish_order.length + 1}. ${last.bhabhi === me ? R.you : nameOf(names, last.bhabhi)}`, detail: left === undefined ? undefined : R.leftWith(left), value: R.bhabhi, tone: "minus" as Tone, mine: last.bhabhi === me },
  ];
  return { ...base, headline: last.bhabhi === me ? R.youBhabhi : R.isBhabhi(nameOf(names, last.bhabhi)), blurb: last.bhabhi === me ? R.youHeld : R.youGotAway, rowsTitle: R.finishing, rows };
}

/** The whole match once `view.match.over`. */
export function gameResult(view: any, names: readonly string[]): GameResult | null {
  const tm = tableModel(view, mySeat(view));
  if (!tm.results) return null;
  const me = mySeat(view);
  const game = tm.game;
  const myRow = tm.results.find((r) => r.seat === me);
  const rows: ResultRow[] = tm.results.map((r) => ({
    key: String(r.seat), label: `${r.place ?? "-"}. ${r.seat === me ? R.you : nameOf(names, r.seat)}`,
    value: r.score, tone: r.place === 1 ? "gold" : "plain", mine: r.seat === me,
  }));
  const top = tm.results[0]!;
  if (game === "bhabhi") {
    const counts: readonly number[] = view.match.bhabhi_counts;
    const max = Math.max(...counts);
    const lost = max > 0 && counts[me] === max;
    const worst = counts.indexOf(max);
    return {
      label: lost ? R.matchAgainst : R.matchOver,
      head: max === 0 ? R.noBhabhi : worst === me ? R.you : nameOf(names, worst),
      line: max === 0 ? R.everybodyAway : lost ? R.youMost : R.mostOften(nameOf(names, worst)),
      rowsTitle: R.timesBhabhi, rows, won: !lost, lostBhabhi: lost,
    };
  }
  if (game === "courtpiece") {
    const won = (myRow?.place ?? 2) === 1;
    return { label: won ? R.teamTakes : R.otherTakes, head: won ? R.yourTeam : R.theOtherTeam, line: R.firstTo(view.rules.target_points), rowsTitle: R.points, rows: [0, 1].map((t) => ({ key: `t${t}`, label: t === me % 2 ? R.yourTeam : R.otherTeam, value: T.model.pts(view.match.points[t]), tone: t === view.match.winner ? "gold" : "plain", mine: t === me % 2 })), won, lostBhabhi: false };
  }
  const won = myRow?.place === 1;
  return {
    label: won ? R.wonMatch : R.matchOver, head: top.seat === me ? R.you : nameOf(names, top.seat),
    line: myRow?.place ? R.placed(myRow.place, tm.results.length) : "", rowsTitle: R.finalScores, rows, won, lostBhabhi: false,
  };
}
