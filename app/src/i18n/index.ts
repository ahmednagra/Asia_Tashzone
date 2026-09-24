import type { TextStyle } from "react-native";

export type Lang = "en" | "ur" | "hi" | "ne" | "bn";
export const LANG_CODES: readonly Lang[] = ["en", "ur", "hi", "ne", "bn"];
export const RTL_LANGS: ReadonlySet<Lang> = new Set<Lang>(["ur"]);

type Widen<T> =
  T extends string ? string
  : T extends (...a: infer A) => infer R ? (...a: A) => Widen<R>
  : T extends readonly (infer U)[] ? readonly Widen<U>[]
  : T extends object ? { [K in keyof T]: Widen<T[K]> }
  : T;
type DeepPartial<T> =
  T extends (...a: never[]) => unknown ? T
  : T extends readonly (infer U)[] ? readonly DeepPartial<U>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;
export type Translation<T> = DeepPartial<Widen<T>>;
export type Tables<T> = { en: T } & { [L in Exclude<Lang, "en">]?: Translation<T> };

let current: Lang = "en";
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;
export const isRTL = (l: Lang = current) => RTL_LANGS.has(l);
export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  listeners.forEach((fn) => fn());
}
export function subscribeLang(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function merge(base: unknown, over: unknown): unknown {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base)) {
    if (!Array.isArray(over) || over.length !== base.length) return base;
    return base.map((b, i) => merge(b, over[i]));
  }
  if (isPlain(base)) {
    if (!isPlain(over)) return base;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], over[k]);
    return out;
  }
  if (typeof base === "function") return typeof over === "function" ? over : base;
  return typeof over === typeof base ? over : base;
}

export const registry = new Map<string, Tables<object>>();

export function localized<T extends object>(name: string, tables: Tables<T>): T {
  registry.set(name, tables as Tables<object>);
  const cache = new Map<Lang, T>();
  const resolve = (): T => {
    const l = current;
    let hit = cache.get(l);
    if (!hit) {
      hit = (l === "en" ? tables.en : merge(tables.en, tables[l])) as T;
      cache.set(l, hit);
    }
    return hit;
  };
  return new Proxy(tables.en, {
    get: (_, prop) => Reflect.get(resolve(), prop),
    has: (_, prop) => Reflect.has(resolve(), prop),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_, prop) => {
      const d = Reflect.getOwnPropertyDescriptor(resolve(), prop);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

export function pick<T>(tables: { en: T } & Partial<Record<Exclude<Lang, "en">, T>>, l: Lang = current): T {
  return tables[l] ?? tables.en;
}

export function missingKeys(en: unknown, other: unknown, path = ""): string[] {
  if (Array.isArray(en)) {
    if (!Array.isArray(other) || other.length !== en.length) return [path || "(root)"];
    return en.flatMap((v, i) => missingKeys(v, other[i], `${path}[${i}]`));
  }
  if (isPlain(en)) {
    if (!isPlain(other)) return [path || "(root)"];
    return Object.keys(en).flatMap((k) => missingKeys(en[k], other[k], path ? `${path}.${k}` : k));
  }
  if (typeof en === "function") return typeof other === "function" ? [] : [path];
  return typeof other === typeof en ? [] : [path];
}

export function scriptText(l: Lang = current): TextStyle {
  if (l === "ur") return { letterSpacing: 0, textTransform: "none", writingDirection: "rtl" };
  if (l === "en") return {};
  return { letterSpacing: 0, textTransform: "none" };
}

export const NASTALIQ = "Noto Nastaliq Urdu";

export function displayFace(latinFace: string, size: number, l: Lang = current): TextStyle {
  if (l === "ur") return { fontFamily: NASTALIQ, fontSize: size, lineHeight: Math.round(size * 1.9), letterSpacing: 0, textTransform: "none", writingDirection: "rtl" };
  if (l === "en") return { fontFamily: latinFace, fontSize: size };
  return { fontFamily: latinFace, fontSize: size, lineHeight: Math.round(size * 1.45), letterSpacing: 0, textTransform: "none" };
}

const LOCALES: Record<Lang, string> = { en: "en-GB", ur: "ur-PK-u-nu-latn", hi: "hi-IN-u-nu-latn", ne: "ne-NP-u-nu-latn", bn: "bn-BD-u-nu-latn" };

export function shortDate(d: Date, l: Lang = current): string {
  try {
    return d.toLocaleDateString(LOCALES[l], { day: "numeric", month: "short", timeZone: "UTC" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
