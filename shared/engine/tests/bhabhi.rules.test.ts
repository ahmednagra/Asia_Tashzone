/** Bhabhi rule tests, ported from TashZone v1 `games/bhabhi.test.ts` to the new engine. */
import { describe, expect, it } from "vitest";
import { type BhabhiRules, type BhabhiState, type EngineEvent, type SeatMove, bhabhi, bhabhiPlacements, canonicalize, checkBhabhiRules } from "../src/index.js";

const RULES: BhabhiRules = {
  profile_id: "bhabhi.tz@1", players: 4, thulla: "immediate", first_trick_discard: true, power_holder_empty: "drawFromWaste",
  decks: 1, take_hand: false, two_player_cut: true, rounds: 3, bhabhi_limit: 0, handicap: 0, max_tricks: 2000,
  max_actions_per_hand: 40000, turn_ms: 30000, window_ms: 4000,
};
const SEED = (n: number) => n.toString(16).padStart(2, "0").repeat(32);

function begin(over: Partial<BhabhiRules> = {}, seed = 3): BhabhiState {
  const r = bhabhi.step(bhabhi.initialState({ ...RULES, ...over }), { t: "BeginHand", actor: "system", hand_id: "h1", hand_seed: SEED(seed) });
  if (!r.ok) throw new Error(r.code);
  return r.state;
}
function act(s: BhabhiState, seat: number, move: SeatMove): { state: BhabhiState; events: readonly EngineEvent[] } {
  const r = bhabhi.step(s, bhabhi.toAction(move, seat, s.hand!.hand_id));
  if (!r.ok) throw new Error(`${seat} ${JSON.stringify(move)}: ${r.code}`);
  return { state: r.state, events: r.events };
}
const play = (s: BhabhiState, seat: number, card: string) => act(s, seat, { t: "Play", card }).state;

/** A small hand-built table for exact rule checks. `waste` is the pile before the first trick shown. */
function table(hands: string[][], leader: number, over: Partial<BhabhiRules> = {}, firstTrick = false, waste: string[] = [], seed = 1): BhabhiState {
  const n = hands.length;
  const base = bhabhi.initialState({ ...RULES, players: n, ...over });
  const order = hands.map((_, i) => (leader + i) % n);
  return {
    ...base,
    hand: {
      hand_id: "t1", seed: SEED(seed), phase: "PLAY", annulled: null, dealer: 0, hands, dealt: hands, known: hands.map(() => []),
      waste, discards: [], voids: hands.map(() => []), trick: [], trick_order: order, turn: leader, thulla: null, first_trick: firstTrick,
      drawn_lead: null, last_trick: null, trick_count: 0, out: hands.map(() => false), finish_order: [], actions: 0,
    },
  };
}

describe("Bhabhi deal and first trick", () => {
  it("deals the whole deck as evenly as possible", () => {
    expect(begin().hand!.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    expect(begin({ players: 3 }).hand!.hands.map((h) => h.length).sort()).toEqual([17, 17, 18]);
    expect(bhabhi.conservationHolds(begin({ players: 5 }))).toBe(true);
  });
  it("the ace of spades holder leads it", () => {
    const s = begin();
    const leader = s.hand!.turn;
    expect(s.hand!.hands[leader]).toContain("AS");
    expect(bhabhi.legalServer(s, leader)).toEqual([{ t: "Play", card: "AS" }]);
    const v = bhabhi.project(s, { kind: "seat", seat: leader });
    const other = s.hand!.hands[leader]!.find((c) => c !== "AS")!;
    expect(bhabhi.explain(v, { t: "Play", card: other })).toBe("MUST_LEAD_ACE_OF_SPADES");
  });
  it("discards the first trick even with a thulla", () => {
    let s = table([["AS", "2H"], ["3S", "4H"], ["5D", "6H"]], 0, {}, true);
    s = play(s, 0, "AS");
    s = play(s, 1, "3S");
    s = play(s, 2, "5D");
    expect(s.hand!.last_trick!.outcome).toBe("discarded");
    expect(s.hand!.waste).toEqual(["AS", "3S", "5D"]);
  });
});

describe("Bhabhi thulla", () => {
  it("immediate thulla: highest card of the led suit picks up and leads", () => {
    let s = table([["9H", "2C"], ["KH", "3C"], ["4S", "5D"]], 0);
    s = play(s, 0, "9H");
    s = play(s, 1, "KH");
    const r = act(s, 2, { t: "Play", card: "4S" });
    expect(r.events.map((e) => e.t)).toEqual(expect.arrayContaining(["Thulla", "PickedUp"]));
    expect([...r.state.hand!.hands[1]!].sort()).toEqual(["3C", "4S", "9H", "KH"].sort());
    expect(r.state.hand!.known[1]!.slice().sort()).toEqual(["4S", "9H", "KH"].sort());
    expect(r.state.hand!.turn).toBe(1);
  });
  it("immediate thulla stops the trick for players who have not played", () => {
    let s = table([["9H", "2C"], ["4S", "3C"], ["KH", "5D"]], 0);
    s = play(s, 0, "9H");
    s = play(s, 1, "4S");
    expect(s.hand!.trick).toEqual([]);
    expect(s.hand!.hands[0]!.slice().sort()).toEqual(["2C", "4S", "9H"].sort());
  });
  it("finishTrick thulla lets everyone play, then the highest of the led suit picks up", () => {
    let s = table([["9H", "2C"], ["4S", "3C"], ["KH", "5D"]], 0, { thulla: "finishTrick" });
    s = play(s, 0, "9H");
    s = play(s, 1, "4S");
    expect(s.hand!.trick).toHaveLength(2);
    s = play(s, 2, "KH");
    expect(s.hand!.hands[2]!.slice().sort()).toEqual(["4S", "5D", "9H", "KH"].sort());
    expect(s.hand!.turn).toBe(2);
  });
  it("must follow suit when able", () => {
    const s = play(table([["9H", "2C"], ["4H", "3C"], ["KD", "5D"]], 0), 0, "9H");
    expect(bhabhi.legalServer(s, 1)).toEqual([{ t: "Play", card: "4H" }]);
    expect(bhabhi.explain(bhabhi.project(s, { kind: "seat", seat: 1 }), { t: "Play", card: "3C" })).toBe("MUST_FOLLOW_SUIT");
  });
});

describe("Bhabhi getting away (L19)", () => {
  it("a player who empties their hand without the power gets away", () => {
    let s = table([["AD", "2C"], ["9D"], ["3D", "5S"]], 0);
    s = play(play(play(s, 0, "AD"), 1, "9D"), 2, "3D");
    expect(s.hand!.out[1]).toBe(true);
    expect(s.hand!.finish_order).toEqual([1]);
    expect(s.hand!.turn).toBe(0);
  });
  it("power holder with no cards draws from the pile as it was before this trick, then leads (Pagat)", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = table([["AD"], ["9D", "4C"], ["3D", "5S"]], 0, {}, false, ["2H", "7C"], seed);
      s = play(play(play(s, 0, "AD"), 1, "9D"), 2, "3D");
      expect(s.hand!.out[0]).toBe(false);
      expect(s.hand!.hands[0]).toHaveLength(1);
      expect(["2H", "7C"]).toContain(s.hand!.hands[0]![0]); // never the card just played
      expect(s.hand!.waste).toHaveLength(4);
      expect(s.hand!.turn).toBe(0);
      expect(s.hand!.drawn_lead).toBe(0);
    }
  });
  it("never reveals a card drawn from the waste to anyone else", () => {
    let s = table([["AD"], ["9D", "4C"], ["3D", "5S"]], 0, {}, false, ["2H", "7C"]);
    s = play(play(s, 0, "AD"), 1, "9D");
    const r = act(s, 2, { t: "Play", card: "3D" });
    const drawn = r.state.hand!.hands[0]![0]!;
    const publicEvents = bhabhi.projectEvents(r.events, { kind: "seat", seat: 1 });
    expect(publicEvents.some((e) => e.t === "DrewFromWaste")).toBe(true);
    expect(canonicalize(publicEvents.filter((e) => e.t === "DrewFromWaste" || e.t === "DrewCard"))).not.toContain(drawn);
    expect(bhabhi.projectEvents(r.events, { kind: "seat", seat: 0 }).some((e) => e.t === "DrewCard" && e.card === drawn)).toBe(true);
  });
  it("power holder gets away when the pile was empty before the trick", () => {
    const s = play(play(play(table([["AD"], ["9D", "4C"], ["3D", "5S"]], 0), 0, "AD"), 1, "9D"), 2, "3D");
    expect(s.hand!.out[0]).toBe(true);
  });
  it("pass-to-next house rule lets the power holder get away", () => {
    const s = play(play(play(table([["AD"], ["9D", "4C"], ["3D", "5S"]], 0, { power_holder_empty: "passToNext" }, false, ["2H"]), 0, "AD"), 1, "9D"), 2, "3D");
    expect(s.hand!.out[0]).toBe(true);
    expect(s.hand!.turn).toBe(1);
  });
  it("the last player holding cards is the Bhabhi", () => {
    const s = play(play(play(table([["AD"], ["9D"], ["3D", "5S"]], 0, { rounds: 1, power_holder_empty: "passToNext" }), 0, "AD"), 1, "9D"), 2, "3D");
    expect(s.match.over).toBe(true);
    expect(s.match.results[0]).toEqual({ hand_id: "t1", finish_order: [0, 1], bhabhi: 2 });
    expect(s.match.bhabhi_counts).toEqual([0, 0, 1]);
  });
  it("draw-from-next takes a card from the next player still holding cards and leads it", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let s = table([["AD"], ["9D", "4C", "6C"], ["3D", "5S"]], 0, { power_holder_empty: "drawFromNext" }, false, ["2H"], seed);
      s = play(play(play(s, 0, "AD"), 1, "9D"), 2, "3D");
      expect(s.hand!.out[0]).toBe(false);
      expect(["4C", "6C"]).toContain(s.hand!.hands[0]![0]);
      expect(s.hand!.hands[1]).toHaveLength(1);
      expect(s.hand!.waste).toEqual(["2H", "AD", "9D", "3D"]);
      expect(s.hand!.drawn_lead).toBe(0);
    }
  });
  it("draw-from-next clears the donor's public cards so nobody can name the one taken", () => {
    let s = table([["AD"], ["9D", "4C", "6C"], ["3D", "5S"]], 0, { power_holder_empty: "drawFromNext" }, false, ["2H"]);
    s = { ...s, hand: { ...s.hand!, known: [[], ["4C"], []] } };
    s = play(play(play(s, 0, "AD"), 1, "9D"), 2, "3D");
    expect(s.hand!.known[1]).toEqual([]);
  });
  it("escape-if-3-plus lets the power holder away while three still hold cards", () => {
    const s = play(play(play(table([["AD"], ["9D", "4C"], ["3D", "5S"]], 0, { power_holder_empty: "escapeIfThreePlus" }, false, ["2H"]), 0, "AD"), 1, "9D"), 2, "3D");
    expect(s.hand!.out[0]).toBe(true);
  });
  it("escape-if-3-plus draws from the pile once only two players are left", () => {
    let s = table([["AD"], ["9D", "4C"], ["3C"]], 0, { power_holder_empty: "escapeIfThreePlus" }, false, ["2H"]);
    s = { ...s, hand: { ...s.hand!, out: [false, false, true], trick_order: [0, 1] } };
    s = play(play(s, 0, "AD"), 1, "9D");
    expect(s.hand!.out[0]).toBe(false);
    expect(s.hand!.hands[0]).toEqual(["2H"]);
  });
  it("every power-holder rule conserves the deck and finishes the hand", () => {
    for (const rule of ["drawFromWaste", "drawFromNext", "escapeIfThreePlus", "passToNext"] as const) {
      let s = begin({ power_holder_empty: rule, rounds: 1 });
      for (let i = 0; i < 5000 && !s.match.over; i++) {
        const seat = s.hand!.turn;
        s = act(s, seat, bhabhi.legalServer(s, seat).find((m) => m.t === "Play")!).state;
        if (!s.match.over) expect(bhabhi.conservationHolds(s)).toBe(true);
      }
      expect(s.match.over).toBe(true);
    }
  });
});

describe("Bhabhi last two players empty together", () => {
  it("the power holder is the Bhabhi and is not also listed as getting away", () => {
    let s = table([["AD"], ["9D"]], 0, { rounds: 1 }, false, ["2H"]);
    s = { ...s, rules: { ...s.rules, players: 3 }, hand: { ...s.hand!, hands: [["AD"], ["9D"], []], out: [false, false, true], trick_order: [0, 1], known: [[], [], []], voids: [[], [], []] } };
    s = { ...s, match: { ...s.match, bhabhi_counts: [0, 0, 0], place_totals: [0, 0, 0] } };
    s = play(play(s, 0, "AD"), 1, "9D");
    expect(s.match.results[0]!.bhabhi).toBe(0);
    expect(s.match.results[0]!.finish_order).not.toContain(0);
  });
});

describe("Bhabhi public table information", () => {
  it("records the last trick and the voids a cut shows; lists discards for the card tracker", () => {
    let s = table([["9H", "2C"], ["KH", "3C"], ["4S", "5D"]], 0);
    s = play(play(play(s, 0, "9H"), 1, "KH"), 2, "4S");
    expect(s.hand!.last_trick).toMatchObject({ outcome: "pickedUp", seat: 1 });
    expect(s.hand!.voids[2]).toContain("H");
    let d = table([["9H", "2C"], ["KH", "3C"], ["4H", "5D"]], 0);
    d = play(play(play(d, 0, "9H"), 1, "KH"), 2, "4H");
    expect(d.hand!.discards).toEqual(["9H", "KH", "4H"]);
    expect(bhabhi.project(d, { kind: "seat", seat: 0 }).hand!.discards).toEqual(["9H", "KH", "4H"]);
  });
  it("reveals the whole deal to everyone when the hand ends", () => {
    let s = begin({ rounds: 1 });
    for (let i = 0; i < 5000 && !s.match.over; i++) s = act(s, s.hand!.turn, bhabhi.legalServer(s, s.hand!.turn).find((m) => m.t === "Play")!).state;
    const v = bhabhi.project(s, { kind: "seat", seat: 1 });
    expect(v.hand!.revealed_hands!.flat()).toHaveLength(52);
  });
});

describe("Bhabhi two decks (L32)", () => {
  it("deals 104 cards and the holder of the first ace of spades dealt starts", () => {
    const s = begin({ decks: 2, players: 8 });
    expect(s.hand!.hands.flat()).toHaveLength(104);
    expect(s.hand!.hands[s.hand!.turn]).toContain("AS");
    expect(bhabhi.conservationHolds(s)).toBe(true);
  });
  it("identical cards: the first one played is higher", () => {
    let s = table([["KH", "2C"], ["KH", "3C"], ["4H", "5D"]], 0, { decks: 2, players: 4 });
    s = { ...s, rules: { ...s.rules, players: 3 } };
    s = play(play(play(s, 0, "KH"), 1, "KH"), 2, "4H");
    expect(s.hand!.last_trick!.seat).toBe(0);
  });
  it("checks deck and player counts: two decks for 4–8, one deck for 3–6", () => {
    expect(checkBhabhiRules({ ...RULES, players: 7, decks: 1 })).not.toBeNull();
    expect(checkBhabhiRules({ ...RULES, players: 3, decks: 2 })).not.toBeNull();
    expect(checkBhabhiRules({ ...RULES, players: 8, decks: 2 })).toBeNull();
  });
});

describe("Bhabhi take the hand (L33)", () => {
  const four = (over: Partial<BhabhiRules> = {}) => table([["9H", "2C"], ["KH", "3C"], ["4D", "5D"], ["6S", "7S"]], 0, { take_hand: true, ...over });
  it("is only offered with the house rule, before a trick, to players still holding cards", () => {
    expect(bhabhi.legalServer(four({ take_hand: false }), 2).some((m) => m.t === "Take")).toBe(false);
    expect(bhabhi.legalServer(four(), 2)).toEqual([{ t: "Take" }]);
    expect(bhabhi.legalServer(four(), 0)[0]).toEqual({ t: "Take" });
    const mid = play(four(), 0, "9H");
    expect(bhabhi.legalServer(mid, 2).some((m) => m.t === "Take")).toBe(false);
  });
  it("moves the next player's cards to the taker; that player gets away", () => {
    const r = act(four(), 2, { t: "Take" });
    expect(r.state.hand!.hands[2]!.slice().sort()).toEqual(["4D", "5D", "6S", "7S"].sort());
    expect(r.state.hand!.out[3]).toBe(true);
    expect(r.state.hand!.finish_order).toEqual([3]);
    expect(bhabhi.projectEvents(r.events, { kind: "seat", seat: 1 }).find((e) => e.t === "TookHand")).toMatchObject({ seat: 2, from: 3, count: 2 });
  });
  it("the taker leads when they took the hand of the player due to lead", () => {
    const r = act(four(), 3, { t: "Take" });
    expect(r.state.hand!.turn).toBe(3);
  });
  it("needs at least three players holding cards", () => {
    let s = four();
    s = { ...s, hand: { ...s.hand!, out: [false, false, true, true], trick_order: [0, 1] } };
    expect(bhabhi.legalServer(s, 1).some((m) => m.t === "Take")).toBe(false);
  });
});

describe("Bhabhi two-player cut (L34)", () => {
  const cut = (on: boolean) => {
    let s = table([["9H"], ["2C", "3C"], []], 0, { two_player_cut: on }, false, []);
    s = { ...s, hand: { ...s.hand!, out: [false, false, true], trick_order: [0, 1], drawn_lead: 0 } };
    return play(s, 0, "9H");
  };
  it("a cut of a drawn lead with two players left makes the leader the Bhabhi", () => {
    const s = play(cut(true), 1, "2C");
    expect(s.match.results[0]!.bhabhi).toBe(0);
  });
  it("without the house rule the leader picks the trick up as usual", () => {
    const s = play(cut(false), 1, "2C");
    expect(s.match.results).toHaveLength(0);
    expect(s.hand!.hands[0]!.slice().sort()).toEqual(["2C", "9H"].sort());
  });
});

describe("Bhabhi match length and ranking (L35)", () => {
  it("adds finishing places across hands to break ties in times Bhabhi; a full tie shares", () => {
    expect(bhabhiPlacements([1, 1, 0, 2], [5, 4, 9, 8])).toEqual([3, 2, 1, 4]);
    expect(bhabhiPlacements([1, 1, 0], [4, 4, 6])).toEqual([2, 2, 1]);
  });
  it("can end the match once someone has been the Bhabhi enough times", () => {
    const s = play(play(play(table([["AD"], ["9D"], ["3D", "5S"]], 0, { rounds: 5, bhabhi_limit: 1, power_holder_empty: "passToNext" }), 0, "AD"), 1, "9D"), 2, "3D");
    expect(s.match.over).toBe(true);
    expect(s.match.placements).toEqual([1, 2, 3]);
  });
});

describe("Bhabhi handicap deals (L39)", () => {
  it("deals seat 0 extra cards from the other hands and still deals every card exactly once", () => {
    const s = begin({ handicap: 3 });
    expect(s.hand!.hands[0]).toHaveLength(16);
    expect(bhabhi.conservationHolds(s)).toBe(true);
    expect(s.hand!.hands[s.hand!.turn]).toContain("AS");
  });
});
