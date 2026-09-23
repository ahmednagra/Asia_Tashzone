/** C-22 / CG-07: the generated settings schema accepts exactly what the compiler accepts. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import Ajv2020 from "ajv/dist/2020.js";
import { BHABHI_TZ_1, CALLBREAK_NP_1, COURTPIECE_TZ_1, PROFILES, compile, profileHash, settingsSchema } from "../src/index.js";

describe("profile compiler", () => {
  it("defaults match the frozen profile and decisions", () => {
    const c = compile("callbreak.np@1");
    expect(c.ok).toBe(true); if (!c.ok) return;
    expect(c.rules).toMatchObject({ must_beat: true, trump_if_winning: true, direction: "counter_clockwise", rounds: 5, call_min: 1, call_max: 13 });
    expect(c.effective_profile_hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("preset Lakdi (India) = clockwise play and rotation", () => {
    const c = compile("callbreak.np@1", {}, "lakdi-india");
    expect(c.ok && c.rules.direction === "clockwise" && c.rules.dealer_rotation === "clockwise").toBe(true);
  });
  it("toggles change the effective hash; profile hash is stable", () => {
    const a = compile("callbreak.np@1"); const b = compile("callbreak.np@1", { relaxed_play: true });
    expect(a.ok && b.ok && a.effective_profile_hash !== b.effective_profile_hash).toBe(true);
    expect(profileHash(CALLBREAK_NP_1)).toBe(profileHash(CALLBREAK_NP_1));
  });
  it("rejects unknown settings and bad values", () => {
    expect(compile("callbreak.np@1", { nope: true })).toMatchObject({ ok: false });
    expect(compile("callbreak.np@1", { rounds: 7 })).toMatchObject({ ok: false });
    expect(compile("callbridge.bd@1", { relaxed_play: true })).toMatchObject({ ok: false });
  });
  it("CG-07 schema ⇔ compiler agreement over random settings", () => {
    const ajv = new Ajv2020({ strict: false });
    for (const p of Object.values(PROFILES)) {
      const validate = ajv.compile(settingsSchema(p));
      const keys = [...p.toggles.map((t) => t.id), "bogus"];
      const strings = p.toggles.flatMap((t) => (t.values ?? []).filter((v) => typeof v === "string")) as string[];
      const value = fc.oneof(fc.boolean(), fc.integer({ min: 0, max: 22 }), fc.constantFrom("x", ...strings));
      fc.assert(fc.property(fc.dictionary(fc.constantFrom(...keys), value), (settings) => {
        expect(validate(settings)).toBe(compile(p.id, settings).ok);
      }), { numRuns: 600 });
    }
  });
});

describe("v1 profiles and presets", () => {
  it("Callbreak v1 presets reproduce the v1 configurations", () => {
    const classic = compile("callbreak.np@1", {}, "classic");
    expect(classic.ok && [classic.rules.call_min, classic.rules.call_max, classic.rules.overtrick_bonus, classic.rules.auto_redeal_no_trump, classic.rules.redeal_on_request]).toEqual([1, 8, true, true, false]);
    const easy = compile("callbreak.np@1", {}, "easy-follow");
    expect(easy.ok && [easy.rules.must_beat, easy.rules.trump_if_winning]).toEqual([false, true]);
    const cb = compile("callbreak.np@1", {}, "call-bridge-classic");
    expect(cb.ok && [cb.rules.call_min, cb.rules.call_max, cb.rules.overtrick_bonus]).toEqual([2, 13, false]);
  });
  it("Court Piece defaults and presets", () => {
    const d = compile("courtpiece.tz@1");
    expect(d.ok && d.game).toBe("courtpiece");
    expect(d.ok && [d.rules.variant, d.rules.target_points, d.rules.dealer_rotation]).toEqual(["single", 7, "pagat"]);
    const ace = compile("courtpiece.tz@1", {}, "double-ace");
    expect(ace.ok && [ace.rules.variant, ace.rules.ace_blocks_collect]).toEqual(["double", true]);
    expect(COURTPIECE_TZ_1.default_preset).toBe("double");
  });
  it("Bhabhi forces two decks for 7–8 players unless decks is explicit, and refuses bad combinations", () => {
    const seven = compile("bhabhi.tz@1", { players: 7 });
    expect(seven.ok && seven.rules.decks).toBe(2);
    expect(compile("bhabhi.tz@1", { players: 7, decks: 1 })).toMatchObject({ ok: false });
    expect(compile("bhabhi.tz@1", { players: 3, decks: 2 })).toMatchObject({ ok: false });
    const five = compile("bhabhi.tz@1", { players: 5, decks: 2 });
    expect(five.ok && five.rules.decks).toBe(2);
    expect(BHABHI_TZ_1.toggles.map((t) => t.id)).toContain("take_hand");
  });
});
