/** Court Piece rule tests, ported from TashZone v1 `games/courtpiece.test.ts` to the new engine. */
import { describe, expect, it } from "vitest";
import { type CourtPieceRules, type CourtPieceState, type SeatMove, canonicalize, courtpiece, teamOf } from "../src/index.js";

const RULES: CourtPieceRules = {
  profile_id: "courtpiece.tz@1", seats: 4, variant: "single", stop_at_seven: true, ace_blocks_collect: false,
  target_points: 7, hand_points: 1, court_points: 3, dealer_rotation: "pagat", max_actions_per_hand: 256, turn_ms: 30000, window_ms: 4000,
};
const SEED = (n: number) => n.toString(16).padStart(2, "0").repeat(32);

function begin(over: Partial<CourtPieceRules> = {}, seed = 7): CourtPieceState {
  const r = courtpiece.step(courtpiece.initialState({ ...RULES, ...over }), { t: "BeginHand", actor: "system", hand_id: "h1", hand_seed: SEED(seed) });
  if (!r.ok) throw new Error(r.code);
  return r.state;
}
function act(s: CourtPieceState, seat: number, move: SeatMove): CourtPieceState {
  const r = courtpiece.step(s, courtpiece.toAction(move, seat, s.hand!.hand_id));
  if (!r.ok) throw new Error(`${seat} ${JSON.stringify(move)}: ${r.code}`);
  return r.state;
}
/** Plays the current hand to its end taking the first legal move each time. */
function playHand(s: CourtPieceState): CourtPieceState {
  const id = s.hand!.hand_id;
  let st = s;
  while (!st.match.over && st.hand!.hand_id === id && st.hand!.phase !== "DONE") {
    const seat = st.hand!.turn;
    st = act(st, seat, courtpiece.legalServer(st, seat)[0]!);
  }
  return st;
}

describe("Court Piece deal and trump (L15)", () => {
  it("deals 5 cards each, and only the caller acts first", () => {
    const s = begin();
    expect(s.hand!.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.hand!.stock).toHaveLength(32);
    expect(s.hand!.caller).toBe(1);
    expect(courtpiece.waitingOn(s)).toEqual({ mode: "TURN", seats: [1] });
    expect(courtpiece.legalServer(s, 1)).toHaveLength(4);
    expect(courtpiece.legalServer(s, 0)).toEqual([]);
  });
  it("hides the stock and other hands from every view", () => {
    const s = begin();
    for (let seat = 0; seat < 4; seat++) {
      const json = canonicalize(courtpiece.project(s, { kind: "seat", seat }));
      expect(json).not.toContain('"stock"');
      expect(json).not.toContain(s.hand!.seed);
      const cards = new Set(json.match(/"[2-9TJQKA][CDHS]"/g)?.map((x) => x.slice(1, 3)) ?? []);
      expect([...cards].sort()).toEqual([...s.hand!.hands[seat]!].sort());
    }
    expect(courtpiece.project(s, { kind: "seat", seat: 1 }).hand!.stock_count).toBe(32);
  });
  it("deals the rest after trump and lets the caller lead", () => {
    const s = act(begin(), 1, { t: "ChooseTrump", suit: "H" });
    expect(s.hand!.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(s.hand!.trump).toBe("H");
    expect(s.hand!.phase).toBe("PLAY");
    expect(courtpiece.waitingOn(s)).toEqual({ mode: "TURN", seats: [1] });
    expect(courtpiece.conservationHolds(s)).toBe(true);
  });
  it("has no must-beat rule: any card of the led suit is legal", () => {
    let s = act(begin(), 1, { t: "ChooseTrump", suit: "S" });
    const h = s.hand!;
    s = { ...s, hand: { ...h, hands: [h.hands[0]!, ["AD", ...h.hands[1]!.slice(1)], ["2D", "3D", ...h.hands[2]!.slice(2)], h.hands[3]!] } };
    s = act(s, 1, { t: "Play", card: "AD" });
    const legal = courtpiece.legalServer(s, 2).map((m) => (m.t === "Play" ? m.card : ""));
    expect(legal).toEqual(expect.arrayContaining(["2D", "3D"]));
  });
  it("explains an illegal card from the view (MUST_FOLLOW_SUIT)", () => {
    let s = act(begin(), 1, { t: "ChooseTrump", suit: "S" });
    const h = s.hand!;
    s = { ...s, hand: { ...h, hands: [h.hands[0]!, ["AD", ...h.hands[1]!.slice(1)], ["2D", "9C", ...h.hands[2]!.slice(2)], h.hands[3]!] } };
    s = act(s, 1, { t: "Play", card: "AD" });
    const v = courtpiece.project(s, { kind: "seat", seat: 2 });
    expect(courtpiece.explain(v, { t: "Play", card: "9C" })).toBe("MUST_FOLLOW_SUIT");
    expect(courtpiece.explain(courtpiece.project(s, { kind: "seat", seat: 3 }), { t: "Play", card: "2D" })).toBe("NOT_YOUR_TURN");
  });
});

describe("Court Piece hands", () => {
  it("stops a Single Sir hand when a team reaches 7 tricks and scores it", () => {
    const s = playHand(act(begin(), 1, { t: "ChooseTrump", suit: "C" }));
    const r = s.match.results[0]!;
    expect(Math.max(...r.tricks)).toBe(7);
    expect(r.points[r.winner]).toBe(r.court ? 3 : 1);
    expect(r.court).toBe(Math.min(...r.tricks) === 0);
  });
  it("rotates the dealer by Pagat rules (losing side deals; a court moves it across)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = playHand(act(begin({}, seed), 1, { t: "ChooseTrump", suit: "C" }));
      const r = s.match.results[0]!;
      const expected = r.court ? 2 : r.winner === teamOf(1) ? 0 : 1;
      expect(s.match.next_dealer).toBe(expected);
    }
  });
  it("Double Sir without stop-at-seven plays all 13 and the last trick collects the pile", () => {
    const s = playHand(act(begin({ variant: "double", stop_at_seven: false }), 1, { t: "ChooseTrump", suit: "C" }));
    const r = s.match.results[0]!;
    expect(r.tricks[0] + r.tricks[1]).toBe(13);
  });
  it("reveals every hand as dealt once the hand is over", () => {
    const s = playHand(act(begin(), 1, { t: "ChooseTrump", suit: "D" }));
    const v = courtpiece.project(s, { kind: "seat", seat: 0 });
    expect(v.hand!.revealed_hands!.flat()).toHaveLength(52);
    expect(courtpiece.visibleCardIds(s, { kind: "seat", seat: 0 }).size).toBe(52);
  });
  it("ends the match at the target points", () => {
    let s = courtpiece.initialState({ ...RULES, target_points: 2 });
    for (let hand = 1; hand < 50 && !s.match.over; hand++) {
      const r = courtpiece.step(s, { t: "BeginHand", actor: "system", hand_id: `h${hand}`, hand_seed: SEED(hand) });
      if (!r.ok) throw new Error(r.code);
      s = playHand(r.state);
    }
    expect(s.match.over).toBe(true);
    expect(Math.max(...s.match.points)).toBeGreaterThanOrEqual(2);
    expect(courtpiece.summary(s).placements).toEqual([0, 1, 2, 3].map((x) => (teamOf(x) === s.match.winner ? 1 : 2)));
  });
});

describe("Double Sir collection rules", () => {
  function midHand(lastWin: { seat: number; card: string } | null, aceBlocksCollect = false): CourtPieceState {
    const s = act(begin({ variant: "double", stop_at_seven: false, ace_blocks_collect: aceBlocksCollect }), 1, { t: "ChooseTrump", suit: "C" });
    return {
      ...s,
      hand: {
        ...s.hand!, hands: [["4D"], ["AD"], ["2D"], ["3D"]], stock: [],
        history: [[{ seat: 1, card: "KH" }, { seat: 2, card: "2H" }, { seat: 3, card: "3H" }, { seat: 0, card: "4H" }]],
        leader: 1, turn: 1, trick: [], pile: 1, last_win: lastWin,
      },
    };
  }
  const round = (s: CourtPieceState) => [1, 2, 3, 0].reduce((st, seat) => act(st, seat, { t: "Play", card: st.hand!.hands[seat]![0]! }), s);
  it("two consecutive tricks by the same player collect the pile", () => {
    const s = round(midHand({ seat: 1, card: "KH" }));
    expect(s.hand!.team_tricks).toEqual([0, 2]);
    expect(s.hand!.pile).toBe(0);
    expect(s.hand!.last_win).toBeNull();
  });
  it("a different winner adds to the pile instead", () => {
    const s = round(midHand({ seat: 3, card: "KH" }));
    expect(s.hand!.team_tricks).toEqual([0, 0]);
    expect(s.hand!.pile).toBe(2);
    expect(s.hand!.last_win).toEqual({ seat: 1, card: "AD" });
  });
  it("ace rule: two consecutive aces do not collect", () => {
    const s = round(midHand({ seat: 1, card: "AH" }, true));
    expect(s.hand!.team_tricks).toEqual([0, 0]);
    expect(s.hand!.pile).toBe(2);
  });
});
