import { describe, expect, it } from "vitest";
import { compile } from "@tashzone/engine";
import { SETUP } from "../../constants/games";
import { defaultChoice, describeChoice, parseSetupParams, settingsFor } from "./setup";

const bhabhi = SETUP["bhabhi.tz@1"]!;
const callbreak = SETUP["callbreak.np@1"]!;

describe("setup route parameters", () => {
  it("starts immediately only when everything the game asks for is present and valid", () => {
    expect(parseSetupParams(callbreak, { preset: "classic", length: "1", level: "hard" })).toEqual({ preset: "classic", length: 1, players: 4, level: "hard", handicap: 0 });
    expect(parseSetupParams(callbreak, { preset: "classic", length: "1" })).toBeNull();
    expect(parseSetupParams(callbreak, { preset: "nope", length: "0", level: "easy" })).toBeNull();
    expect(parseSetupParams(callbreak, { preset: "classic", length: "9", level: "easy" })).toBeNull();
    expect(parseSetupParams(callbreak, { preset: "classic", length: "-1", level: "easy" })).toBeNull();
    expect(parseSetupParams(callbreak, { preset: "classic", length: "0", level: "godlike" })).toBeNull();
  });
  it("Bhabhi also needs players and handicap, both validated against the setup", () => {
    const ok = { preset: "standard", length: "0", level: "medium", players: "6", handicap: "3" };
    expect(parseSetupParams(bhabhi, ok)).toEqual({ preset: "standard", length: 0, players: 6, level: "medium", handicap: 3 });
    expect(parseSetupParams(bhabhi, { ...ok, players: "9" })).toBeNull();
    expect(parseSetupParams(bhabhi, { ...ok, handicap: "4" })).toBeNull();
    expect(parseSetupParams(bhabhi, { ...ok, players: undefined })).toBeNull();
    expect(parseSetupParams(bhabhi, { ...ok, level: ["easy", "hard"] })).toMatchObject({ level: "easy" });
  });
  it("every profile's default choice compiles", () => {
    for (const [id, info] of Object.entries(SETUP)) {
      const c = defaultChoice(info);
      const r = compile(id, settingsFor(info, c), c.preset);
      expect(r.ok, id).toBe(true);
    }
  });
  it("describes the choice for the info sheet", () => {
    const rows = describeChoice(bhabhi, { preset: "standard", length: 1, players: 5, level: "easy", handicap: 0 });
    expect(rows).toEqual([["Rules", "Standard"], ["Hands", "3"], ["Players", "5"], ["Bots", "Easy"], ["Deal", "Even deal"]]);
  });
});
