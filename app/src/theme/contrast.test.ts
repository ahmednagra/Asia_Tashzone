/** Re-measures every §13.1 claim so token edits cannot silently break accessibility. */
import { describe, expect, it } from "vitest";
import { cards, colors, contrast, onTable } from "./tokens";

describe("WCAG 2.1 contrast of semantic tokens (§13.1)", () => {
  for (const theme of ["dark", "light"] as const) {
    const c = colors[theme];
    it(`${theme}: body text ≥ 4.5 on bg and surface`, () => {
      for (const fg of [c.text, c.textSecondary, c.textMuted]) {
        expect(contrast(fg, c.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, c.surface)).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${theme}: primary and text-on-primary`, () => {
      expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c.primary, c.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${theme}: control borders ≥ 3`, () => {
      expect(contrast(c.borderControl, c.bg)).toBeGreaterThanOrEqual(3);
    });
  }
  it("on-table tokens ≥ 4.5 on both felts", () => {
    for (const felt of [colors.dark.tableFelt, colors.light.tableFelt]) {
      for (const [name, v] of Object.entries(onTable)) expect(contrast(v, felt), name).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("card suits on the face; four-colour deck ≥ 4.5", () => {
    for (const v of Object.values(cards.fourColor)) expect(contrast(v, cards.face)).toBeGreaterThanOrEqual(4.5);
    // gold on the face measures ~1.6, which is why legal emphasis is drawn on the felt
    expect(contrast(onTable.gold, cards.face)).toBeLessThan(2);
  });
  it("no purple or pink hues in semantic tokens", () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (d < 0.08) return null;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const all = [...Object.values(colors.dark), ...Object.values(colors.light), ...Object.values(onTable)];
    for (const v of all) { const h = hue(v); if (h !== null) expect(h < 260 || h > 345, v).toBe(true); }
  });
});
