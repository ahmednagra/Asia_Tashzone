import { describe, expect, it } from "vitest";
import { bhabhi, compile, sha256Hex } from "@tashzone/engine";
import { cardLabel, fanLayout, formatScore, handGeometry, handOrder, positionOf, ringAreas, tableModel } from "./logic";

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
  it("hand geometry keeps a 28 dp strip and makes Spread real for 13 cards", () => {
    const fan = handGeometry(13, 344, 60, "fan");
    expect(fan.rows).toBe(2);
    const firstRow = fan.spots.filter((p) => p.z < 100);
    expect(firstRow[1]!.x - firstRow[0]!.x).toBeGreaterThanOrEqual(28);
    const spread = handGeometry(13, 344, 60, "spread");
    expect(spread.rows).toBe(2);
    const row0 = spread.spots.filter((p) => p.z < 100);
    for (let i = 1; i < row0.length; i++) expect(row0[i]!.x - row0[i - 1]!.x).toBeGreaterThanOrEqual(spread.cardW);
    expect(row0[row0.length - 1]!.x + spread.cardW).toBeLessThanOrEqual(344);
    expect(spread.cardW).toBeGreaterThanOrEqual(40);
    expect(handGeometry(0, 344, 60).spots).toEqual([]);
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
