import { describe, expect, it } from "vitest";
import { scoreLabel, standings } from "./standings";

describe("standings", () => {
  it("orders by place and marks the viewer", () => {
    const rows = standings({ game: "callbreak", totals: [142, 163, 91, -20], placements: [2, 1, 3, 4] }, ["You", "Sana", "Bilal", "Hira"], 0);
    expect(rows.map((r) => r.name)).toEqual(["Sana", "You", "Bilal", "Hira"]);
    expect(rows[1]).toMatchObject({ you: true, score: "14.2", place: 2 });
    expect(rows[3]!.score).toBe("−2.0");
  });
  it("has no places for an interrupted match and names missing seats", () => {
    const rows = standings({ game: "bhabhi", totals: [1, 0], placements: null }, ["A"], null);
    expect(rows.map((r) => r.place)).toEqual([null, null]);
    expect(rows[1]!.name).toBe("Seat 2");
    expect(scoreLabel("courtpiece", 5)).toBe("5 pts");
  });
  it("returns nothing without a result", () => {
    expect(standings(null, [], 0)).toEqual([]);
  });
});
