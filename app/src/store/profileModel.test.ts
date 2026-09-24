import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, exportProfile, importProfile, mergeProfile, winRate } from "./profileModel";

describe("mergeProfile", () => {
  it("returns defaults for junk input", () => {
    for (const junk of [null, undefined, 5, "x", [], { sound: 3, stats: "no" }]) expect(mergeProfile(junk)).toEqual(DEFAULT_PROFILE);
  });

  it("fills fields missing from an older saved profile", () => {
    const old = { onboarded: true, name: "Sana", stats: { matches: 4, wins: 2 }, parent: { text: true } };
    const p = mergeProfile(old);
    expect(p.name).toBe("Sana");
    expect(p.stats).toEqual({ matches: 4, wins: 2, streak: 0, bhabhi: 0 });
    expect(p.parent).toMatchObject({ text: true, online: true, wifi: true });
    expect(p.sound).toEqual(DEFAULT_PROFILE.sound);
  });

  it("rejects wrong types and clamps lists", () => {
    const p = mergeProfile({ lang: "xx", avatar: -3, hints: "yes", name: "n".repeat(60), recent: ["a", 1, "b", "c", "d", "e", "f"], stats: { wins: -1 } });
    expect(p.lang).toBe("en");
    expect(p.avatar).toBe(0);
    expect(p.hints).toBe(false);
    expect(p.name).toHaveLength(24);
    expect(p.recent).toEqual(["a", "b", "c", "d", "e"]);
    expect(p.stats.wins).toBe(0);
  });

  it("keeps a PIN hash only together with its salt, and a well-formed lock", () => {
    expect(mergeProfile({ parent: { pinHash: "h" } }).parent.pinHash).toBeUndefined();
    const p = mergeProfile({ parent: { pinHash: "h", salt: "s", lock: { fails: 3, level: 2, left: 99, mark: 5 } } });
    expect(p.parent).toMatchObject({ pinHash: "h", salt: "s" });
    expect(p.parent.lock).toEqual({ fails: 3, level: 2, left: 99 });
    expect(mergeProfile({ parent: { lock: { fails: 1, until: 99 } } }).parent.lock).toEqual({ fails: 1, level: 0, left: 0 });
    expect(mergeProfile({ parent: { lock: { fails: "x" } } }).parent.lock).toBeUndefined();
  });
});

describe("export / import", () => {
  const me = mergeProfile({ onboarded: true, name: "Ali", stats: { matches: 3, wins: 1 }, parent: { pinHash: "h", salt: "s", text: false } });

  it("never exports the PIN hash, salt or lock", () => {
    const text = exportProfile(me);
    expect(text).not.toContain("pinHash");
    expect(text).not.toContain('"salt"');
  });

  it("round-trips stats but keeps the current parental controls", () => {
    const other = mergeProfile({ onboarded: true, name: "Zed", stats: { matches: 9, wins: 9 }, protectedMode: false, parent: { text: true } });
    const back = importProfile(exportProfile(other), me);
    expect(back?.name).toBe("Zed");
    expect(back?.stats.matches).toBe(9);
    expect(back?.protectedMode).toBe(me.protectedMode);
    expect(back?.parent).toEqual(me.parent);
  });

  it("rejects text that is not a TashZone export", () => {
    expect(importProfile("not json", me)).toBeNull();
    expect(importProfile('{"profile":{}}', me)).toBeNull();
  });
});

describe("winRate", () => {
  it("is 0 with no matches and rounds otherwise", () => {
    expect(winRate({ matches: 0, wins: 0, streak: 0, bhabhi: 0 })).toBe(0);
    expect(winRate({ matches: 3, wins: 2, streak: 0, bhabhi: 0 })).toBe(67);
  });
});
