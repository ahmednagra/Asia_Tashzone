/** Bot unit behaviour for every game (the full BT-01/BT-02 runs live in shared/testing). */
import { describe, expect, it } from "vitest";
import { type BaseView, type GameModule, bhabhi, callbreak, courtpiece } from "../src/index.js";
import { BOT_NAMES, chooseMove, estimateCallbreakTricks } from "../src/index.js";

const CB = {
  profile_id: "callbreak.np@1", seats: 4, direction: "counter_clockwise", dealer_rotation: "counter_clockwise",
  trump: "S", call_min: 1, call_max: 13, must_beat: true, trump_if_winning: true, first_lead_no_trump: false,
  redeal_on_request: false, low_call_sum: 0, redeal_cap: 3, scoring: "callbreak", failure: "full",
  bonus_call: 0, bonus_score: 0, overtrick_bonus: true, auto_redeal_no_trump: false, rounds: 1, tie: "shared",
  max_actions_per_hand: 256, guard_outcome: "annul", turn_ms: 20000, window_ms: 4000,
} as const;
const CP = { profile_id: "courtpiece.tz@1", seats: 4, variant: "single", stop_at_seven: true, ace_blocks_collect: false, target_points: 7, hand_points: 1, court_points: 3, dealer_rotation: "pagat", max_actions_per_hand: 256, turn_ms: 30000, window_ms: 4000 } as const;
const BH = { profile_id: "bhabhi.tz@1", players: 5, thulla: "immediate", first_trick_discard: true, power_holder_empty: "drawFromWaste", decks: 1, take_hand: true, two_player_cut: true, rounds: 1, bhabhi_limit: 0, handicap: 0, max_tricks: 2000, max_actions_per_hand: 40000, turn_ms: 30000, window_ms: 4000 } as const;

function started(module: GameModule, rules: unknown) {
  const r = module.step(module.initialState(rules), { t: "BeginHand", actor: "system", hand_id: "h1", hand_seed: "ab".repeat(32) });
  if (!r.ok) throw new Error(r.code);
  return r.state;
}

describe("bots", () => {
  it("estimates Callbreak tricks from honours and long trumps (v1 estimate)", () => {
    expect(estimateCallbreakTricks(["2H", "3D", "4C"])).toBeLessThan(0.5);
    expect(Math.round(estimateCallbreakTricks(["AS", "KS", "QS", "JS", "TS", "AH", "AD"]))).toBeGreaterThanOrEqual(5);
  });
  it.each([["callbreak", callbreak, CB], ["courtpiece", courtpiece, CP], ["bhabhi", bhabhi, BH]] as const)(
    "%s: every level answers only with a legal move, and nothing without a turn", (_n, module, rules) => {
      const s = started(module as GameModule, rules);
      const turn = (module as GameModule).waitingOn(s).seats[0]!;
      const v = (module as GameModule).project(s, { kind: "seat", seat: turn }) as BaseView;
      for (const level of ["easy", "medium", "hard"] as const) {
        const m = chooseMove(module as GameModule, v, level, "t", { samples: 3, maxPlayoutMoves: 100, maxSimulatedMoves: 300, endgameMaxCards: 6, endgameNodes: 500 });
        expect(v.legal).toContainEqual(m);
      }
      const other = (module as GameModule).project(s, { kind: "seat", seat: (turn + 1) % (module as GameModule).seatCount(rules) }) as BaseView;
      const offTurn = chooseMove(module as GameModule, other, "medium", "t");
      expect(offTurn === null || offTurn.t !== "Take").toBe(true); // bots never take a hand
    });
  it("has v1 bot names", () => { expect(BOT_NAMES).toContain("Jalebi"); });
});
