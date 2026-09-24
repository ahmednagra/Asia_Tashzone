import { afterEach, describe, expect, it } from "vitest";
import { LANG_CODES, localized, missingKeys, registry, setLang } from "./index";
import "../components/ui/copy";

const modules = import.meta.glob(["../**/copy.ts", "../constants/*.ts"], { eager: true });

afterEach(() => setLang("en"));

describe("localized()", () => {
  const T = localized("test-fixture", {
    en: { hi: "Hello", n: (x: number) => `${x} cards`, nested: { a: "A", b: "B" }, list: ["one", "two"] },
    ur: { hi: "سلام", nested: { a: "الف" } },
  });

  it("reads the current language and falls back to English per key", () => {
    expect(T.hi).toBe("Hello");
    setLang("ur");
    expect(T.hi).toBe("سلام");
    expect(T.n(3)).toBe("3 cards");
    expect(T.nested.a).toBe("الف");
    expect(T.nested.b).toBe("B");
    expect(T.list).toEqual(["one", "two"]);
    setLang("hi");
    expect(T.hi).toBe("Hello");
  });

  it("finds missing and mistyped keys", () => {
    expect(missingKeys({ a: "x", b: { c: "y" } }, { a: "z", b: {} })).toEqual(["b.c"]);
    expect(missingKeys({ f: () => "" }, { f: "nope" })).toEqual(["f"]);
    expect(missingKeys(["a", "b"], ["c"])).toEqual(["(root)"]);
  });
});

describe("every translation table is complete", () => {
  it("loads the copy modules", () => {
    expect(Object.keys(modules).length).toBeGreaterThan(0);
    expect(registry.size).toBeGreaterThan(1);
  });

  const names = [...registry.keys()].filter((n) => n !== "test-fixture");
  for (const name of names) {
    for (const lang of LANG_CODES.filter((l) => l !== "en")) {
      it(`${name} has every string in ${lang}`, () => {
        const t = registry.get(name)!;
        expect(t[lang], `${name} has no ${lang} table`).toBeDefined();
        expect(missingKeys(t.en, t[lang])).toEqual([]);
      });
    }
  }

  it("function strings accept the same arguments in every language", () => {
    const arity = (v: unknown, path: string, out: Record<string, number>) => {
      if (typeof v === "function") out[path] = v.length;
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) arity(x, `${path}.${k}`, out);
      return out;
    };
    for (const name of names) {
      const t = registry.get(name)!;
      const base = arity(t.en, name, {});
      for (const lang of LANG_CODES.filter((l) => l !== "en")) {
        const other = arity(t[lang], name, {});
        for (const [k, n] of Object.entries(base)) if (k in other) expect(other[k], `${k} in ${lang}`).toBe(n);
      }
    }
  });
});
