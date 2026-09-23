/** Bots: BT-01 legality at every level, BT-02 no-peek, Hard slicing and exact endgame; DR-05 digest stability. */
import { describe, expect, it } from "vitest";
import {
  type CallbreakState, type CourtPieceState, type BaseView, callbreak, canonicalize, courtpiece, getModule,
} from "../src/index.js";
import { type HardBudget, chooseMove, chooseMoveAsync } from "../src/index.js";
import { behaviourDigest, botChooser, driveMatch, rulesOf, shortRules } from "../src/index.js";

const FAST: HardBudget = { samples: 4, maxPlayoutMoves: 200, maxSimulatedMoves: 800, endgameMaxCards: 8, endgameNodes: 1500 };

describe("Hard bot", () => {
  it.each(["callbreak.np@1", "courtpiece.tz@1", "bhabhi.tz@1"])("BT-01 never proposes an illegal move — %s", (profile) => {
    const { module, rules } = rulesOf(profile);
    let decisions = 0;
    driveMatch(module, shortRules(module.id, rules, 1), `hard/${profile}`, (m, s, seat, legal, n) => {
      const move = botChooser("hard", FAST)(m, s, seat, legal, n);
      if (move) { expect(legal.map((x) => canonicalize(x))).toContain(canonicalize(move)); decisions++; }
      return move ?? legal.find((x) => x.t !== "RequestRedeal" && x.t !== "Take") ?? null;
    });
    expect(decisions).toBeGreaterThan(20);
  });

  it("BT-02 no-peek: the decision depends on the view only", () => {
    const { module, rules } = rulesOf("courtpiece.tz@1");
    const d = driveMatch(module, shortRules("courtpiece", rules, 1), "np", botChooser("medium"));
    const v = module.project(d.state, { kind: "seat", seat: 1 }) as BaseView;
    expect(chooseMove(module, v, "hard", "s", FAST)).toEqual(chooseMove(module, JSON.parse(JSON.stringify(v)), "hard", "s", FAST));
  });

  it("thinks in slices, yields to the host and stops at its time cap with a legal move", async () => {
    const { rules } = rulesOf("courtpiece.tz@1");
    let s = courtpiece.initialState(rules) as CourtPieceState;
    const r = courtpiece.step(s, { t: "BeginHand", actor: "system", hand_id: "a1", hand_seed: "ab".repeat(32) });
    if (!r.ok) throw new Error();
    s = r.state;
    const t = courtpiece.step(s, { t: "ChooseTrump", actor: 1, hand_id: "a1", suit: "S" });
    if (!t.ok) throw new Error();
    const view = courtpiece.project(t.state, { kind: "seat", seat: 1 });
    let clock = 0;
    let yields = 0;
    const move = await chooseMoveAsync(courtpiece, view, "hard", "slice", {
      now: () => (clock += 5), maxMs: 200, sliceMs: 10, yieldToHost: async () => { yields++; },
    });
    expect(yields).toBeGreaterThan(0);
    expect(view.legal.map((x) => canonicalize(x))).toContain(canonicalize(move));
  });

  it("solves a fully determined Callbreak endgame exactly (the provably best move)", () => {
    const { rules } = rulesOf("callbreak.np@1", { redeal_on_request: false });
    const r0 = callbreak.step(callbreak.initialState(rules), { t: "BeginHand", actor: "system", hand_id: "e1", hand_seed: "cd".repeat(32) });
    if (!r0.ok) throw new Error();
    // Two tricks left, every other card public. Leading KH first lets seat 3 trump it with 2S (one trick);
    // leading AS first draws seat 3's only spade, so KH then wins too (two tricks). AS is the only best move,
    // and it sorts after KH, so the answer cannot come from move-list order.
    const s: CallbreakState = {
      ...r0.state,
      hand: {
        ...r0.state.hand!, phase: "PLAY", calls: [1, 1, 1, 1], tricks: [0, 4, 4, 3], trick_no: 12, turn: 0, leader: 0, trick: [],
        hands: [["KH", "AS"], ["3H", "4C"], ["5H", "6C"], ["2S", "7C"]],
        played: [], history: [],
      },
    };
    const used = new Set(s.hand!.hands.flat());
    const rest = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"].flatMap((rk) => ["C","D","H","S"].map((su) => rk + su)).filter((c) => !used.has(c));
    const hist = [];
    for (let i = 0; i < rest.length; i += 4) hist.push([0, 1, 2, 3].map((seat, j) => ({ seat, card: rest[i + j]! })));
    const state = { ...s, hand: { ...s.hand!, played: rest, history: hist } } as CallbreakState;
    const view = callbreak.project(state, { kind: "seat", seat: 0 });
    expect(view.legal).toEqual([{ t: "Play", card: "KH" }, { t: "Play", card: "AS" }]);
    expect(chooseMove(callbreak, view, "hard", "exact", { ...FAST, endgameMaxCards: 12, endgameNodes: 4000 })).toEqual({ t: "Play", card: "AS" });
  });
});

describe("behaviour digest (02_ENGINE.md §9)", () => {
  it("is stable across runs, independent of the build, and differs between profiles", () => {
    const a = behaviourDigest("courtpiece.tz@1", "x", 1);
    expect(behaviourDigest("courtpiece.tz@1", "y", 1)).toBe(a);
    expect(behaviourDigest("bhabhi.tz@1", "x", 1)).not.toBe(a);
  });
  it("every module is reachable from the registry", () => {
    for (const id of ["callbreak", "courtpiece", "bhabhi"]) expect(getModule(id).id).toBe(id);
  });
});
