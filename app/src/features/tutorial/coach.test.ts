import { describe, expect, it } from "vitest";
import { type CoachState, type TipId, IDLE, START, TIP_ORDER, advance, coachState, dismiss, handOutcome, nextTip, suggestedCall } from "./coach";

const at = (patch: Partial<CoachState>): CoachState => ({ ...IDLE, ...patch });

function view(hand: Record<string, unknown>, legal: { t: string; card?: string; n?: number }[] = [], extra: Record<string, unknown> = {}) {
  return {
    viewer: { kind: "seat", seat: 0 },
    rules: { trump: "S", call_min: 1, call_max: 8 },
    legal,
    hand: { phase: "PLAY", annulled: null, my_hand: [], calls: [null, null, null, null], turn: 0, trick: [], last_trick_winner: null, ...hand },
    match: { history: [] },
    ...extra,
  };
}

describe("coachState", () => {
  it("is idle before the deal", () => {
    expect(coachState(null)).toEqual(IDLE);
    expect(coachState({ hand: null })).toEqual(IDLE);
  });

  it("sees the call turn", () => {
    const s = coachState(view({ phase: "CALL", my_hand: ["AS"] }, [{ t: "Call", n: 1 }, { t: "Call", n: 2 }]));
    expect(s).toMatchObject({ dealt: true, called: false, canCall: true, following: false });
  });

  it("sees following and the must-beat restriction", () => {
    const v = view({ my_hand: ["2H", "KH", "AH", "3S"], trick: [{ seat: 1, card: "QH" }] }, [{ t: "Play", card: "KH" }, { t: "Play", card: "AH" }]);
    expect(coachState(v)).toMatchObject({ following: true, mustBeat: true, trumpToWin: false });
    const all = view({ my_hand: ["2H", "3H"], trick: [{ seat: 1, card: "QH" }] }, [{ t: "Play", card: "2H" }, { t: "Play", card: "3H" }]);
    expect(coachState(all)).toMatchObject({ following: true, mustBeat: false });
  });

  it("sees a forced winning spade when void in the led suit", () => {
    const v = view({ my_hand: ["2H", "3S", "9S"], trick: [{ seat: 3, card: "6D" }] }, [{ t: "Play", card: "3S" }, { t: "Play", card: "9S" }]);
    expect(coachState(v)).toMatchObject({ following: true, mustBeat: false, trumpToWin: true });
    const free = view({ my_hand: ["2H", "3S"], trick: [{ seat: 3, card: "6D" }, { seat: 2, card: "AS" }] }, [{ t: "Play", card: "2H" }, { t: "Play", card: "3S" }]);
    expect(coachState(free).trumpToWin).toBe(false);
  });

  it("is not following when it is not your turn or you lead", () => {
    expect(coachState(view({ my_hand: ["2H"], turn: 2, trick: [{ seat: 1, card: "QH" }] })).following).toBe(false);
    expect(coachState(view({ my_hand: ["2H"], trick: [] }, [{ t: "Play", card: "2H" }])).following).toBe(false);
  });

  it("sees a trick you won and the end of the hand", () => {
    expect(coachState(view({ my_hand: ["2H"], last_trick_winner: 0 })).wonLast).toBe(true);
    expect(coachState(view({ my_hand: ["2H"], last_trick_winner: 2 })).wonLast).toBe(false);
    expect(coachState(view({ phase: "DONE", my_hand: [] })).done).toBe(true);
    expect(coachState(view({ phase: "DONE", annulled: "guard", my_hand: [] })).done).toBe(false);
  });
});

describe("nextTip", () => {
  it("follows the lesson order when several apply", () => {
    const s = at({ dealt: true, canCall: true });
    expect(nextTip(s, new Set())).toBe("welcome");
    expect(nextTip(s, new Set<TipId>(["welcome"]))).toBe("call");
    const both = at({ dealt: true, called: true, following: true, mustBeat: true });
    expect(nextTip(both, new Set<TipId>(["welcome", "call"]))).toBe("follow");
    expect(nextTip(both, new Set<TipId>(["welcome", "call", "follow"]))).toBe("beat");
  });

  it("never repeats a seen tip", () => {
    const all = new Set<TipId>(TIP_ORDER);
    expect(nextTip(at({ dealt: true, canCall: true, following: true, mustBeat: true, trumpToWin: true, wonLast: true, done: true }), all)).toBeNull();
  });

  it("shows nothing when nothing applies", () => {
    expect(nextTip(IDLE, new Set())).toBeNull();
  });
});

describe("advance / dismiss", () => {
  it("walks the steps with Got it", () => {
    let c = advance(at({ dealt: true }), START);
    expect(c.tip).toBe("welcome");
    const calling = at({ dealt: true, canCall: true });
    c = advance(calling, c);
    expect(c.tip).toBe("welcome");
    c = dismiss(calling, c);
    expect(c.tip).toBe("call");
    expect(c.seen.has("welcome")).toBe(true);
  });

  it("advances by itself when the player does the thing", () => {
    let c = advance(at({ dealt: true, canCall: true }), { tip: null, seen: new Set<TipId>(["welcome"]) });
    expect(c.tip).toBe("call");
    c = advance(at({ dealt: true, called: true }), c);
    expect(c.tip).toBeNull();
    expect(c.seen.has("call")).toBe(true);
    c = advance(at({ dealt: true, called: true, canCall: true }), c);
    expect(c.tip).toBeNull();
  });

  it("moves on to the end once the hand is over", () => {
    const c = advance(at({ dealt: true, called: true, done: true }), { tip: "won", seen: new Set<TipId>(["welcome", "call"]) });
    expect(c.tip).toBe("end");
    expect(c.seen.has("won")).toBe(true);
  });

  it("returns the same object when nothing changes", () => {
    const c = advance(at({ dealt: true }), START);
    expect(advance(at({ dealt: true }), c)).toBe(c);
    expect(dismiss(IDLE, START)).toBe(START);
  });
});

describe("helpers", () => {
  it("suggests a call inside the allowed range", () => {
    const hand = ["AS", "KS", "QS", "JS", "TS", "9S", "8S", "7S", "6S", "5S", "4S", "3S", "2S"];
    expect(suggestedCall(view({ my_hand: hand }))).toBe(8);
    expect(suggestedCall(view({ my_hand: ["2H", "3D"] }))).toBe(1);
  });

  it("reads the hand result in points", () => {
    const made = view({ phase: "DONE" }, [], { match: { history: [{ calls: [4, 2, 2, 3], tricks: [5, 2, 3, 3], deltas: [41, 20, 21, 30] }] } });
    expect(handOutcome(made)).toEqual({ call: 4, won: 5, made: true, points: "4.1" });
    const missed = view({ phase: "DONE" }, [], { match: { history: [{ calls: [4, 2, 2, 3], tricks: [2, 2, 3, 3], deltas: [-40, 20, 21, 30] }] } });
    expect(handOutcome(missed)).toEqual({ call: 4, won: 2, made: false, points: "4" });
    expect(handOutcome(view({}))).toBeNull();
  });
});
