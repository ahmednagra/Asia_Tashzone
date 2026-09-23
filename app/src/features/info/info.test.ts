import { describe, expect, it } from "vitest";
import { GAMES } from "../../constants/games";
import { RULES, TEASERS, playableIds, rulesFor } from "../../constants/rules";
import { HOWTO_SECTIONS } from "../../constants/howto";
import { ATLAS, ATLAS_GROUPS, atlasFor } from "../../constants/atlas";

/** Route files under src/app, as paths like "game/[id]/setup" ((group) folders and "index" dropped). */
const files = Object.keys((import.meta as unknown as { glob: (p: string) => Record<string, unknown> }).glob("../../app/**/*.tsx"));
const ROUTES = files
  .map((f) => f.replace("../../app/", "").replace(/\.tsx$/, "").split("/").filter((seg) => !/^\(.+\)$/.test(seg)))
  .map((segs) => (segs[segs.length - 1] === "index" ? segs.slice(0, -1) : segs))
  .filter((segs) => segs[segs.length - 1] !== "_layout");

/** Does an href match a route file, treating [param] segments as wildcards? */
function routeExists(href: string): boolean {
  const want = href.split("?")[0]!.split("/").filter(Boolean);
  return ROUTES.some((r) => r.length === want.length && r.every((seg, i) => /^\[.+\]$/.test(seg) || seg === want[i]));
}

describe("rules content", () => {
  it("every playable game has rules", () => {
    for (const id of playableIds()) expect(rulesFor(id), id).toBeDefined();
    expect(playableIds().length).toBeGreaterThan(0);
  });
  it("only playable games have full rules; the rest have a teaser", () => {
    for (const g of GAMES) {
      if (g.status === "play") expect(RULES[g.id]).toBeDefined();
      else { expect(RULES[g.id]).toBeUndefined(); expect(TEASERS[g.id], g.id).toBeDefined(); }
    }
  });
  it("every section has a title and a body, with unique ids", () => {
    for (const r of Object.values(RULES)) {
      expect(r.goal.length).toBeGreaterThan(0);
      expect(r.players.length).toBeGreaterThan(0);
      expect(new Set(r.sections.map((s) => s.id)).size).toBe(r.sections.length);
      for (const s of r.sections) {
        expect(s.title.trim(), `${r.gameId}/${s.id}`).not.toBe("");
        expect(s.body.length, `${r.gameId}/${s.id}`).toBeGreaterThan(0);
        for (const line of s.body) expect(line.trim()).not.toBe("");
      }
      for (const t of r.terms) { expect(t.term).not.toBe(""); expect(t.meaning).not.toBe(""); }
    }
  });
  it("teasers say something", () => { for (const t of Object.values(TEASERS)) expect(t.goal.length).toBeGreaterThan(0); });
});

describe("how to play content", () => {
  it("has titled, non-empty sections with valid cards", () => {
    for (const s of HOWTO_SECTIONS) {
      expect(s.title).not.toBe("");
      expect(s.body.length).toBeGreaterThan(0);
      for (const ex of s.examples ?? []) {
        for (const c of ex.cards) expect(c).toMatch(/^[23456789TJQKA][SHDC]$/);
        if (ex.winner !== undefined) expect(ex.winner).toBeLessThan(ex.cards.length);
      }
    }
  });
});

describe("atlas content", () => {
  it("has entries in every group but All", () => {
    for (const g of ATLAS_GROUPS.filter((x) => x !== "All")) expect(atlasFor(g).length, g).toBeGreaterThan(0);
    expect(atlasFor("All")).toHaveLength(ATLAS.length);
  });
  it("labels are unique and non-empty", () => {
    expect(new Set(ATLAS.map((a) => a.label)).size).toBe(ATLAS.length);
    for (const a of ATLAS) expect(a.label).not.toBe("");
  });
  it("every href opens an existing route", () => {
    for (const a of ATLAS) if (a.href) expect(routeExists(a.href), a.href).toBe(true);
  });
});
