import { describe, expect, it } from "vitest";
import { bhabhi, compile, sha256Hex } from "@tashzone/engine";
import { cardLabel, fanLayout, formatScore, handOrder, positionOf, ringAreas, tableModel } from "./logic";

describe("presentation helpers", () => {
  it("human at the bottom, clockwise to the left; table never mirrors", () => {
    expect([0, 1, 2, 3].map((s) => positionOf(s, 0))).toEqual(["bottom", "left", "top", "right"]);
    expect(positionOf(0, 2)).toBe("top");
  });
  it("screen-reader names and scores", () => {
    expect(cardLabel("QH", true)).toBe("Queen of Hearts, playable");
    expect(cardLabel("TS")).toBe("10 of Spades");
    expect(formatScore(42)).toBe("4.2");
    expect(formatScore(-40)).toBe("−4.0");
  });
  it("hand order alternates colours with trumps last; narrow screens get two rows", () => {
    expect(handOrder(["2S", "AH", "3D", "KC"])).toEqual(["3D", "KC", "AH", "2S"]);
    expect(fanLayout(13, 700, 64).rows).toBe(1);
    expect(fanLayout(13, 320, 64).rows).toBe(2);
    expect(fanLayout(13, 700, 64, 2).rows).toBe(2);
  });
});

describe("seat ring for 3–8 players", () => {
  it("keeps the human at the bottom and matches the 4-seat layout", () => {
    expect(ringAreas(4, 0)).toEqual(["bottom", "left", "top", "right"]);
    expect(ringAreas(4, 2)).toEqual([0, 1, 2, 3].map((x) => positionOf(x, 2)));
    expect(ringAreas(3, 0)).toEqual(["bottom", "left", "right"]);
    expect(ringAreas(6, 0)).toEqual(["bottom", "left", "top", "top", "top", "right"]);
    expect(ringAreas(8, 3).filter((a) => a === "bottom")).toHaveLength(1);
    expect(ringAreas(8, 0)).toEqual(["bottom", "left", "left", "top", "top", "top", "right", "right"]);
  });
});

describe("table model", () => {
  it("builds seats, badges and results for a 7-player Bhabhi table from a SeatView only", () => {
    const c = compile("bhabhi.tz@1", { players: 7, rounds: 1 });
    if (!c.ok) throw new Error(c.error);
    let s = bhabhi.initialState(c.rules);
    const r = bhabhi.step(s, { t: "BeginHand", actor: "system", hand_id: "h1", hand_seed: sha256Hex("tm") });
    if (!r.ok) throw new Error(r.code);
    s = r.state;
    const model = tableModel(bhabhi.project(s, { kind: "seat", seat: 0 }), 0);
    expect(model.seats).toHaveLength(7);
    expect(model.seats[0]!.area).toBe("bottom");
    expect(model.seats.every((x) => /cards$/.test(x.badge))).toBe(true);
    expect(model.results).toBeNull();
  });
});
