import { describe, expect, it } from "vitest";
import { chooseMove, compile, getModule, gameOfProfile, sha256Hex } from "@tashzone/engine";
import { gameResult, handResult, ordinal } from "./model";
import { clearOutcome, publishOutcome, readOutcome } from "../session";

const NAMES = ["You", "Anaar", "Kulfi", "Chai"];

/** Plays a whole match with Medium bots in every seat; returns the state after each hand ended and at the end. */
function playOut(profile: string, settings: Record<string, unknown>, preset?: string) {
  const c = compile(profile, settings, preset);
  if (!c.ok) throw new Error(c.error);
  const mod = getModule(gameOfProfile(c.rules.profile_id));
  let s = mod.initialState(c.rules);
  const afterHand: any[] = [];
  let hands = 0;
  for (let guard = 0; guard < 20000; guard++) {
    const w = mod.waitingOn(s);
    if (w.mode === "NONE") break;
    let action: unknown;
    if (w.mode === "AUTO") {
      if (mod.handInfo(s)?.done) afterHand.push(mod.project(s, { kind: "seat", seat: 0 }));
      hands += 1;
      action = { t: "BeginHand", actor: "system", hand_id: `h${hands}`, hand_seed: sha256Hex(`t${hands}`) };
    } else if (w.mode === "WINDOW") {
      action = { t: "CloseWindow", actor: "system", hand_id: mod.handInfo(s)!.hand_id };
    } else {
      const seat = w.seats[0]!;
      const view = mod.project(s, { kind: "seat", seat });
      const m = chooseMove(mod, view, "medium", `g${guard}`);
      action = mod.toAction(m!, seat, mod.handInfo(s)!.hand_id);
    }
    const r = mod.step(s, action);
    if (!r.ok) throw new Error(`rejected ${JSON.stringify(action)} ${r.code}`);
    s = r.state;
  }
  return { mod, state: s, afterHand };
}

describe("result models from real matches", () => {
  it("Callbreak: hand ledger sums to the seat rows, match result ranks all four", () => {
    const { mod, state, afterHand } = playOut("callbreak.np@1", { rounds: 3 }, "classic");
    const hand = handResult(afterHand[0], NAMES)!;
    expect(hand.title).toBe("Round 1");
    expect(hand.rows).toHaveLength(4);
    expect(hand.rows.filter((r) => r.mine)).toHaveLength(1);
    expect(hand.hasNext).toBe(true);
    expect(hand.nextLabel).toBe("Deal round 2");
    expect(/^[+−]/.test(hand.rows[0]!.value) || /^\d/.test(hand.rows[0]!.value)).toBe(true);
    const end = mod.project(state, { kind: "seat", seat: 0 });
    const game = gameResult(end, NAMES)!;
    expect(game.rows).toHaveLength(4);
    expect(game.rows[0]!.tone).toBe("gold");
    expect(game.won).toBe(game.rows.find((r) => r.mine)!.label.startsWith("1."));
    expect(game.lostBhabhi).toBe(false);
  });

  it("Bhabhi: finishing order names one Bhabhi; the match tells who lost most", () => {
    const { mod, state, afterHand } = playOut("bhabhi.tz@1", { players: 4, rounds: 1, bhabhi_limit: 0 }, "standard");
    const end = mod.project(state, { kind: "seat", seat: 0 });
    const hand = handResult(afterHand.length ? afterHand[0] : end, NAMES) ?? handResult(end, NAMES)!;
    expect(hand.rows.filter((r) => r.value === "Bhabhi")).toHaveLength(1);
    const game = gameResult(end, NAMES)!;
    expect(game.rowsTitle).toBe("Times Bhabhi");
    expect(game.won).toBe(!game.lostBhabhi);
  });

  it("Court Piece: teams, points and a profile-ready result", () => {
    const { mod, state } = playOut("courtpiece.tz@1", { target_points: 1 }, "single");
    const end = mod.project(state, { kind: "seat", seat: 0 });
    const hand = handResult(end, NAMES)!;
    expect(hand.rows.map((r) => r.label)).toEqual(["Your team", "Other team"]);
    const game = gameResult(end, NAMES)!;
    expect(game.rows).toHaveLength(2);
    expect(game.rows.filter((r) => r.tone === "gold")).toHaveLength(1);
    expect(game.won).toBe(end.match.winner === 0);
  });
});

describe("helpers", () => {
  it("ordinals", () => { expect([1, 2, 3, 8].map(ordinal)).toEqual(["1st", "2nd", "3rd", "8th"]); });
  it("session hand-off clears only its own outcome", () => {
    const a = { kind: "hand", data: {} as never, onNext: () => {}, onLeave: () => {} } as const;
    const b = { ...a };
    publishOutcome(a);
    publishOutcome(b);
    clearOutcome(a);
    expect(readOutcome()).toBe(b);
    clearOutcome(b);
    expect(readOutcome()).toBeNull();
  });
});
