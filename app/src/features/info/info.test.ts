import { afterEach, describe, expect, it } from "vitest";
import { LANG_CODES, setLang } from "../../i18n";
import { ERROR_MESSAGES, GAMES, GENERIC_ERROR, SETUP } from "../../constants/games";
import { RULES, TEASERS, playableIds, rulesFor } from "../../constants/rules";
import { HOWTO } from "../../constants/howto";
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
    for (const s of HOWTO.sections) {
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

describe("every language", () => {
  afterEach(() => setLang("en"));
  const en = { rules: playableIds().map((id) => rulesFor(id)!), teasers: GAMES.filter((g) => g.status !== "play").map((g) => TEASERS[g.id]!) };

  for (const lang of LANG_CODES) {
    it(`every playable game has full rules in ${lang}`, () => {
      setLang(lang);
      for (const [i, id] of playableIds().entries()) {
        const r = rulesFor(id);
        expect(r, `${lang}/${id}`).toBeDefined();
        const base = en.rules[i]!;
        expect(r!.sections.map((x) => x.id)).toEqual(base.sections.map((x) => x.id));
        for (const [j, sec] of r!.sections.entries()) {
          expect(sec.title.trim(), `${lang}/${id}/${sec.id}`).not.toBe("");
          expect(sec.body.length, `${lang}/${id}/${sec.id}`).toBe(base.sections[j]!.body.length);
          for (const line of sec.body) expect(line.trim(), `${lang}/${id}/${sec.id}`).not.toBe("");
        }
        expect(r!.terms.length).toBe(base.terms.length);
        for (const t of r!.terms) { expect(t.term.trim()).not.toBe(""); expect(t.meaning.trim()).not.toBe(""); }
        expect(r!.varies.length).toBe(base.varies.length);
        if (lang !== "en") expect(r!.goal, `${lang}/${id} goal`).not.toBe(base.goal);
      }
      for (const [i, t] of en.teasers.entries()) {
        const x = TEASERS[t.gameId]!;
        expect(x.goal.trim()).not.toBe("");
        expect(x.terms.length).toBe(en.teasers[i]!.terms.length);
        expect(x.deal === undefined).toBe(t.deal === undefined);
      }
    });

    it(`catalogue, setup, how-to and atlas follow the language (${lang})`, () => {
      setLang(lang);
      const other = lang !== "en";
      const cb = GAMES.find((g) => g.id === "callbreak")!;
      expect(cb.name).toBe("Callbreak");
      expect(cb.description!.trim()).not.toBe("");
      expect(cb.region.trim()).not.toBe("");
      expect(cb.rules!.length).toBe(4);
      for (const info of Object.values(SETUP)) {
        expect(info.lengthLabel.trim()).not.toBe("");
        for (const p of info.presets) { expect(p.label.trim()).not.toBe(""); expect(p.hint.trim()).not.toBe(""); }
        for (const l of info.lengths) expect(l.label.trim()).not.toBe("");
        for (const h of info.handicaps ?? []) expect(h.label.trim()).not.toBe("");
      }
      expect(HOWTO.sections.length).toBe(5);
      for (const sec of HOWTO.sections) for (const ex of sec.examples ?? []) expect(ex.caption.trim()).not.toBe("");
      expect(new Set(ATLAS.map((a) => a.label)).size).toBe(ATLAS.length);
      expect(ERROR_MESSAGES.MUST_FOLLOW_SUIT!.trim()).not.toBe("");
      expect(GENERIC_ERROR.trim()).not.toBe("");
      if (other) {
        setLang("en");
        const enText = [cb.description, SETUP["bhabhi.tz@1"]!.presets[0]!.hint, HOWTO.intro, ERROR_MESSAGES.MUST_FOLLOW_SUIT, GENERIC_ERROR];
        setLang(lang);
        expect([cb.description, SETUP["bhabhi.tz@1"]!.presets[0]!.hint, HOWTO.intro, ERROR_MESSAGES.MUST_FOLLOW_SUIT, GENERIC_ERROR].filter((x, i) => x === enText[i])).toEqual([]);
      }
    });
  }

  it("difficulty and ids stay stable across languages", () => {
    const before = GAMES.map((g) => [g.id, g.profile, g.difficulty, g.status]);
    setLang("ur");
    expect(GAMES.map((g) => [g.id, g.profile, g.difficulty, g.status])).toEqual(before);
    expect(SETUP["callbreak.np@1"]!.presets.map((p) => p.id)).toEqual(["classic", "easy-follow", "call-bridge-classic", "standard", "lakdi-india"]);
  });
});
