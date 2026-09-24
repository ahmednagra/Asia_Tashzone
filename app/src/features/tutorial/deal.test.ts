import { describe, expect, it } from "vitest";
import { LocalTable } from "@tashzone/match";
import { type Coach, type TipId, START, advance, coachState, dismiss, handOutcome, suggestedCall } from "./coach";
import { TUTORIAL_BOTS, TUTORIAL_SEED, tutorialRules } from "./deal";

type Policy = "hint" | "random";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function playHand(policy: Policy, seed: number, dismissChance: number) {
  const rules = tutorialRules()!;
  const queue: (() => void)[] = [];
  const table = new LocalTable(rules, {
    randomSeed: () => TUTORIAL_SEED,
    botLevel: TUTORIAL_BOTS,
    schedule: (fn) => { queue.push(fn); return () => { const i = queue.indexOf(fn); if (i >= 0) queue.splice(i, 1); }; },
  });
  const r = rng(seed);
  const shown: TipId[] = [];
  let coach: Coach = START;
  let first: { hand: string[]; leader: number | null; legal: string[] } | null = null;
  const observe = () => {
    const s = coachState(table.view());
    coach = advance(s, coach);
    while (coach.tip && shown[shown.length - 1] !== coach.tip) {
      shown.push(coach.tip);
      if (coach.tip !== "end" && r() < dismissChance) coach = dismiss(s, coach);
      else break;
    }
  };
  table.start();
  for (let guard = 0; guard < 2000; guard++) {
    while (queue.length) { queue.shift()!(); observe(); }
    observe();
    const v = table.view();
    if (v.hand?.phase === "DONE" || v.match.over) break;
    const legal: { t: string; card?: string; n?: number }[] = v.legal;
    if (legal.some((m) => m.t === "Call")) {
      const n = policy === "hint" ? suggestedCall(v) : 1 + Math.floor(r() * 8);
      expect(table.play({ t: "Call", n })).toBe(true);
      continue;
    }
    const plays = legal.flatMap((m) => (m.t === "Play" && m.card ? [m.card] : []));
    expect(plays.length).toBeGreaterThan(0);
    if (!first && v.hand.trick.length > 0) first = { hand: [...v.hand.my_hand], leader: v.hand.trick[0].seat, legal: plays };
    let card = plays[Math.floor(r() * plays.length)]!;
    if (policy === "hint") {
      const m = table.hint();
      if (m?.t === "Play") card = m.card;
    }
    expect(table.play({ t: "Play", card })).toBe(true);
  }
  observe();
  return { view: table.view(), shown, first };
}

describe("tutorial deal", () => {
  it("uses one hand of Classic Callbreak with no redeal window", () => {
    const rules = tutorialRules();
    expect(rules).not.toBeNull();
    expect(rules).toMatchObject({ rounds: 1, trump: "S", must_beat: true, trump_if_winning: true, redeal_on_request: false, call_min: 1, call_max: 8 });
  });

  it("deals a hand with a void suit, a few spades and a bot lead that must be beaten", () => {
    const { first } = playHand("hint", 1, 1);
    expect(first).not.toBeNull();
    const hand = first!.hand;
    expect(hand).toHaveLength(13);
    expect(hand.filter((c) => c[1] === "D")).toHaveLength(0);
    expect(hand.filter((c) => c[1] === "S").length).toBeGreaterThanOrEqual(3);
    expect(first!.leader).not.toBe(0);
    const led = first!.legal[0]![1];
    expect(first!.legal.every((c) => c[1] === led)).toBe(true);
    expect(first!.legal.length).toBeLessThan(hand.filter((c) => c[1] === led).length);
  });

  it("is the same hand every time", () => {
    const a = playHand("hint", 1, 1);
    const b = playHand("hint", 2, 1);
    expect(a.view.match.history).toEqual(b.view.match.history);
    expect(handOutcome(a.view)?.made).toBe(true);
  });

  it("teaches every lesson once, in order, whatever the player does", () => {
    const expected: TipId[] = ["welcome", "call", "follow", "beat", "won", "trump", "end"];
    for (let k = 0; k < 40; k++) {
      const { shown, view } = playHand(k % 4 === 0 ? "hint" : "random", k + 11, 1);
      expect(view.hand.phase).toBe("DONE");
      expect(new Set(shown).size).toBe(shown.length);
      expect(shown).toEqual(expected);
    }
  });

  it("never shows a tip twice when the player ignores the coach", () => {
    for (let k = 0; k < 20; k++) {
      const { shown } = playHand("random", k + 101, 0.3);
      expect(new Set(shown).size).toBe(shown.length);
      expect(shown[0]).toBe("welcome");
      expect(shown[shown.length - 1]).toBe("end");
      const order = shown.map((t) => ["welcome", "call", "follow", "beat", "won", "trump", "end"].indexOf(t));
      expect(order.every((x) => x >= 0)).toBe(true);
    }
  });
});
