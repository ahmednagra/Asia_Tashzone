/** Re-measures every theme claim so token edits cannot silently break accessibility or long-session comfort. */
import { describe, expect, it } from "vitest";
import { ALL_THEME_IDS, THEME_IDS, cards, contrast, festivalWindow, onTable, openFestivals, roomFor, themes, toThemeId } from "./tokens";

const solid = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

describe.each(ALL_THEME_IDS)("theme %s", (id) => {
  const t = themes[id];
  const c = t.c;

  it("body text sits inside the comfort band (7:1 to 18:1) on the ground", () => {
    const r = contrast(c.text, c.bg);
    expect(r).toBeGreaterThanOrEqual(7);
    expect(r).toBeLessThanOrEqual(18);
    expect(c.bg.toUpperCase()).not.toBe("#000000");
    expect(c.text.toUpperCase()).not.toBe("#FFFFFF");
  });

  it("all text ≥ 4.5 on ground, surface and raised surface", () => {
    for (const fg of [c.text, c.textSecondary, c.textMuted]) {
      for (const bg of [c.bg, c.surface, c.surfaceRaised]) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("status colours ≥ 4.5 on ground and surface", () => {
    for (const fg of [c.success, c.warning, c.error, c.info]) {
      for (const bg of [c.bg, c.surface]) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accent and primary ≥ 4.5 on the ground, with readable ink on them", () => {
    expect(contrast(t.accent.color, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.primary, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.accent.on, t.accent.color)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it("primary button ink ≥ 4.5 on every fill stop", () => {
    for (const fill of t.button.fill) expect(contrast(t.button.ink, fill), fill).toBeGreaterThanOrEqual(4.5);
  });

  it("value colours ≥ 4.5 on ground, surface and felt", () => {
    for (const v of Object.values(t.value)) {
      for (const bg of [c.bg, c.surface, t.felt.base]) expect(contrast(v, bg), `${v} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("control borders ≥ 3 on the ground", () => {
    expect(contrast(c.borderControl, c.bg)).toBeGreaterThanOrEqual(3);
  });

  it("on-table tokens ≥ 4.5 on the felt", () => {
    expect(c.tableFelt).toBe(t.felt.base);
    for (const felt of [t.felt.base, t.felt.deep]) {
      for (const [name, v] of Object.entries(onTable)) expect(contrast(v, felt), `${name} on ${felt}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses solid hex for every semantic colour", () => {
    for (const v of Object.values(c)) expect(solid(v), v).toBe(true);
  });
});

describe("shared rules", () => {
  it("card suits on the face; four-colour deck ≥ 4.5", () => {
    for (const v of Object.values(cards.fourColor)) expect(contrast(v, cards.face)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(onTable.gold, cards.face)).toBeLessThan(2);
  });

  it("the three rooms are visibly different", () => {
    const [a, b, d] = THEME_IDS.map((id) => themes[id]);
    expect(new Set([a!.felt.base, b!.felt.base, d!.felt.base]).size).toBe(3);
    expect(new Set([a!.surface.kind, b!.surface.kind, d!.surface.kind]).size).toBe(3);
    expect(new Set([a!.button.kind, b!.button.kind, d!.button.kind]).size).toBe(3);
    expect(new Set([a!.type.display, b!.type.display, d!.type.display]).size).toBe(3);
  });

  it("old saved theme names map to a real room", () => {
    expect(toThemeId("dark")).toBe("emerald");
    expect(toThemeId("light")).toBe("emerald");
    expect(toThemeId(undefined)).toBe("emerald");
    expect(toThemeId("gold")).toBe("gold");
    expect(toThemeId("arcade")).toBe("arcade");
    expect(toThemeId("eid")).toBe("eid");
  });

  it("no purple or pink hues in semantic tokens", () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (d < 0.08) return null;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const all = [...ALL_THEME_IDS.flatMap((id) => [...Object.values(themes[id].c), ...Object.values(themes[id].value)]), ...Object.values(onTable)];
    for (const v of all) { const h = hue(v); if (h !== null) expect(h < 260 || h > 345, v).toBe(true); }
  });
});

describe("festival rooms", () => {
  it("open only around the festival dates", () => {
    expect(festivalWindow("eid", new Date(2026, 2, 20))).not.toBeNull();
    expect(festivalWindow("eid", new Date(2026, 2, 16))).toBeNull();
    expect(festivalWindow("eid", new Date(2026, 2, 27))).not.toBeNull();
    expect(festivalWindow("eid", new Date(2026, 2, 28))).toBeNull();
    expect(festivalWindow("diwali", new Date(2026, 10, 8))).not.toBeNull();
    expect(openFestivals(new Date(2026, 6, 1))).toEqual([]);
  });

  it("fall back to Mehfil outside their window without losing the choice", () => {
    expect(roomFor("diwali", new Date(2026, 10, 10)).id).toBe("diwali");
    expect(roomFor("diwali", new Date(2026, 6, 1)).id).toBe("emerald");
    expect(roomFor("gold", new Date(2026, 6, 1)).id).toBe("gold");
  });

  it("stay distinct from the three permanent rooms", () => {
    const base = new Set(THEME_IDS.map((id) => themes[id].felt.base));
    expect(base.has(themes.eid.felt.base)).toBe(false);
    expect(base.has(themes.diwali.felt.base)).toBe(false);
  });
});
