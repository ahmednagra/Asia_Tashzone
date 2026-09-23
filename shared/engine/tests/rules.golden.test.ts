/** L2 golden scenarios — callbreak.np@1 / callbridge.bd@1 clauses (01_GAME_RULES.md §1.3). */
import { describe, expect, it } from "vitest";
import { callbreak, explain, initialState, legalPlays, placements, project, redealEligible, scoreHand, step, suitOf, winningIndex } from "../src/index.js";
import { RULES, playState } from "./helpers.js";

const L = (hand: string[], trick: [number, string][], rules = RULES, trickNo = 2) =>
  legalPlays(hand, trick.map(([seat, card]) => ({ seat, card })), rules, trickNo);

describe("follow obligations (canonical, G-12 decision: must-beat on)", () => {
  it("must follow suit", () => {
    expect(L(["2H", "9C", "AS"], [[0, "5C"]])).toEqual(["9C"]);
  });
  it("must beat the current winner of the led suit when able", () => {
    expect(L(["3C", "9C", "KC"], [[0, "5C"], [3, "TC"]])).toEqual(["KC"]);
  });
  it("may play any led-suit card when unable to beat", () => {
    expect(L(["3C", "4C"], [[0, "TC"]])).toEqual(["3C", "4C"]);
  });
  it("a trump already in the trick voids the led-suit must-beat obligation", () => {
    expect(L(["3C", "KC"], [[0, "TC"], [3, "2S"]])).toEqual(["3C", "KC"]);
  });
  it("void: must play a trump if it would become the winner", () => {
    expect(L(["2S", "9H"], [[0, "AC"]])).toEqual(["2S"]);
  });
  it("void: must overtrump when a lower trump is winning", () => {
    expect(L(["3S", "9S", "9H"], [[0, "AC"], [3, "5S"]])).toEqual(["9S"]);
  });
  it("void with only losing trumps may play any card (G-13 decision, S11)", () => {
    expect(L(["3S", "9H"], [[0, "AC"], [3, "QS"]])).toEqual(["9H", "3S"]);
  });
  it("leading: any card; CB-05 bars a trump first lead unless only trumps", () => {
    expect(L(["2S", "3H"], [], RULES, 1)).toEqual(["3H", "2S"]);
    const r5 = { ...RULES, first_lead_no_trump: true };
    expect(L(["2S", "3H"], [], r5, 1)).toEqual(["3H"]);
    expect(L(["2S", "4S"], [], r5, 1)).toEqual(["2S", "4S"]);
    expect(L(["2S", "3H"], [], r5, 2)).toEqual(["3H", "2S"]);
  });
  it("CB-01 relaxed play: follow suit only", () => {
    const relaxed = { ...RULES, must_beat: false, trump_if_winning: false };
    expect(L(["3C", "KC"], [[0, "TC"]], relaxed)).toEqual(["3C", "KC"]);
    expect(L(["2S", "9H"], [[0, "AC"]], relaxed)).toEqual(["9H", "2S"]);
  });
  it("Call Bridge: no must-beat, forced winning trump kept", () => {
    const cb = { ...RULES, must_beat: false };
    expect(L(["3C", "KC"], [[0, "TC"]], cb)).toEqual(["3C", "KC"]);
    expect(L(["2S", "9H"], [[0, "AC"]], cb)).toEqual(["2S"]);
  });
});

describe("trick resolution (P-12)", () => {
  it("highest of led suit wins without trumps; off-suit never wins", () => {
    expect(winningIndex([{ seat: 0, card: "5C" }, { seat: 3, card: "AH" }, { seat: 2, card: "9C" }], "S")).toBe(2);
  });
  it("highest trump wins", () => {
    expect(winningIndex([{ seat: 0, card: "AC" }, { seat: 3, card: "2S" }, { seat: 2, card: "3S" }, { seat: 1, card: "KC" }], "S")).toBe(2);
  });
});

describe("scoring (integer tenths, EC-01)", () => {
  it("callbreak made, overtricks, failed, CB-08 shortfall", () => {
    expect(scoreHand(RULES, 4, 4)).toBe(40);
    expect(scoreHand(RULES, 4, 6)).toBe(42);
    expect(scoreHand(RULES, 4, 3)).toBe(-40);
    expect(scoreHand({ ...RULES, failure: "shortfall" }, 4, 3)).toBe(-10);
  });
  it("call bridge: exact or +1 made; ≥8 scores 13 points; +2 fails", () => {
    const cb = { ...RULES, scoring: "callbridge" as const, bonus_call: 8, bonus_score: 130 };
    expect(scoreHand(cb, 5, 5)).toBe(50);
    expect(scoreHand(cb, 5, 6)).toBe(50);
    expect(scoreHand(cb, 5, 7)).toBe(-50);
    expect(scoreHand(cb, 5, 4)).toBe(-50);
    expect(scoreHand(cb, 8, 9)).toBe(130);
  });
  it("final ties share a placement (G-14 decision)", () => {
    expect(placements([50, 80, 80, -10])).toEqual([3, 1, 1, 4]);
  });
});

describe("redeal eligibility W-CB-1", () => {
  it("no spades or no A/K/Q/J", () => {
    expect(redealEligible(["2H", "AH"], "S")).toBe(true);
    expect(redealEligible(["2S", "9H", "TD"], "S")).toBe(true);
    expect(redealEligible(["2S", "JH"], "S")).toBe(false);
  });
});

describe("step validation order and rejection codes (P-10, L-04)", () => {
  const st = playState({ hands: [["3C"], ["4C"], ["5C"], ["6C", "AC"]], turn: 3, trick: [[0, "TC"]].map(([s, c]) => ({ seat: s as number, card: c as string })), trick_no: 13 });
  it("rejects malformed, out-of-turn, illegal, wrong hand", () => {
    expect(step(st, { t: "Play", actor: 3, hand_id: "t1" })).toMatchObject({ ok: false, code: "BAD_SCHEMA" });
    expect(step(st, { t: "Play", actor: 1, hand_id: "t1", card: "4C" })).toMatchObject({ ok: false, code: "NOT_YOUR_TURN" });
    expect(step(st, { t: "Play", actor: 3, hand_id: "t1", card: "6C" })).toMatchObject({ ok: false, code: "ILLEGAL_ACTION" });
    expect(step(st, { t: "Play", actor: 3, hand_id: "zz", card: "AC" })).toMatchObject({ ok: false, code: "WRONG_HAND" });
    expect(step(st, { t: "Play", actor: 3, hand_id: "t1", card: "AC" }).ok).toBe(true);
  });
  it("rejection leaves the input state untouched", () => {
    const before = JSON.stringify(st);
    step(st, { t: "Play", actor: 3, hand_id: "t1", card: "6C" });
    step(st, { t: "Play", actor: 3, hand_id: "t1", card: "AC" });
    expect(JSON.stringify(st)).toBe(before);
  });
});

describe("TashZone v1 Callbreak options", () => {
  it("overtrick bonus off scores exactly 10×call when made", () => {
    expect(scoreHand({ ...RULES, overtrick_bonus: false }, 4, 6)).toBe(40);
    expect(scoreHand({ ...RULES, overtrick_bonus: true }, 4, 6)).toBe(42);
  });
  it("automatic no-spade redeal: every hand holds a spade, redeals are counted and public", () => {
    let redealt = 0;
    for (let i = 1; i <= 40; i++) {
      const r = step(initialState({ ...RULES, auto_redeal_no_trump: true, redeal_on_request: false }), { t: "BeginHand", actor: "system", hand_id: "h", hand_seed: i.toString(16).padStart(64, "0") });
      if (!r.ok) throw new Error(r.code);
      for (const h of r.state.hand!.hands) expect(h.some((c) => suitOf(c) === "S")).toBe(true);
      expect(r.events.find((e) => e.t === "HandStarted")).toMatchObject({ redeals: r.state.hand!.redeals });
      redealt += r.state.hand!.redeals;
    }
    expect(redealt).toBeGreaterThan(0); // a no-spade hand happens ~5% of deals, so 40 deals see some
  });
  it("explains illegal moves with the v1 codes, from the view only", () => {
    const st = playState({ hands: [["3C"], ["4C"], ["5C"], ["6C", "AC", "2H"]], turn: 3, trick: [{ seat: 0, card: "TC" }], trick_no: 13 });
    const v = project(st, { kind: "seat", seat: 3 });
    expect(explain(v, { t: "Play", card: "6C" })).toBe("MUST_BEAT");
    expect(explain(v, { t: "Play", card: "2H" })).toBe("MUST_FOLLOW_SUIT");
    expect(explain(v, { t: "Play", card: "AC" })).toBeNull();
    expect(explain(project(st, { kind: "seat", seat: 1 }), { t: "Play", card: "4C" })).toBe("NOT_YOUR_TURN");
    const void3 = playState({ hands: [["3C"], ["4C"], ["5C"], ["2S", "9H"]], turn: 3, trick: [{ seat: 0, card: "AC" }, { seat: 1, card: "QS" }], trick_no: 13 });
    expect(explain(project(void3, { kind: "seat", seat: 3 }), { t: "Play", card: "2S" })).toBeNull();
    expect(callbreak.id).toBe("callbreak");
  });
});
