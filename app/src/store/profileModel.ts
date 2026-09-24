/** Pure profile model (no React Native imports) so it can be unit-tested. The provider lives in profile.tsx. */

import { LANG_CODES as LANGS, type Lang } from "../i18n";

export type { Lang };

/** Wrong-PIN tracking, persisted so restarting the app does not reset the lock-out. */
export interface PinLock { fails: number; level: number; left: number; mark?: number }

export interface Profile {
  onboarded: boolean;
  lang: Lang;
  /** birth year from the age screen; undefined when skipped */
  born?: number;
  /** under 13 or skipped: text chat and online extras stay off until a parent unlocks them */
  protectedMode: boolean;
  name: string;
  avatar: number;
  /** "easy mode": four-colour deck, large cards, hints on, no timer */
  easy: boolean;
  hints: boolean;
  timer: boolean;
  sound: { master: boolean; effects: boolean; haptics: boolean };
  /** `pinHash` = SHA-256(salt:pin); `salt` is random per install; `lock` tracks failed attempts */
  parent: { pinHash?: string; salt?: string; lock?: PinLock; text: boolean; online: boolean; wifi: boolean };
  stats: { matches: number; wins: number; streak: number; bhabhi: number };
  /** game ids, most recent first (max 5) */
  recent: string[];
}

export const DEFAULT_PROFILE: Profile = {
  onboarded: false, lang: "en", protectedMode: true, name: "", avatar: 0, easy: false, hints: false, timer: true,
  sound: { master: true, effects: true, haptics: true },
  parent: { text: false, online: true, wifi: true },
  stats: { matches: 0, wins: 0, streak: 0, bhabhi: 0 },
  recent: [],
};

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const count = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Merges a stored (possibly older, partial or corrupt) object over the defaults so every field exists with the right type. */
export function mergeProfile(raw: unknown): Profile {
  const r = obj(raw);
  const d = DEFAULT_PROFILE;
  const sound = obj(r.sound), parent = obj(r.parent), stats = obj(r.stats), lock = obj(parent.lock);
  const hasLock = typeof lock.fails === "number";
  return {
    onboarded: bool(r.onboarded, d.onboarded),
    lang: LANGS.includes(r.lang as Lang) ? (r.lang as Lang) : d.lang,
    born: typeof r.born === "number" && Number.isFinite(r.born) ? r.born : undefined,
    protectedMode: bool(r.protectedMode, d.protectedMode),
    name: typeof r.name === "string" ? r.name.slice(0, 24) : d.name,
    avatar: count(r.avatar, d.avatar),
    easy: bool(r.easy, d.easy),
    hints: bool(r.hints, d.hints),
    timer: bool(r.timer, d.timer),
    sound: { master: bool(sound.master, d.sound.master), effects: bool(sound.effects, d.sound.effects), haptics: bool(sound.haptics, d.sound.haptics) },
    parent: {
      pinHash: typeof parent.pinHash === "string" && typeof parent.salt === "string" ? parent.pinHash : undefined,
      salt: typeof parent.pinHash === "string" && typeof parent.salt === "string" ? parent.salt : undefined,
      lock: hasLock ? { fails: count(lock.fails, 0), level: count(lock.level, 0), left: count(lock.left, 0) } : undefined,
      text: bool(parent.text, d.parent.text), online: bool(parent.online, d.parent.online), wifi: bool(parent.wifi, d.parent.wifi),
    },
    stats: { matches: count(stats.matches, 0), wins: count(stats.wins, 0), streak: count(stats.streak, 0), bhabhi: count(stats.bhabhi, 0) },
    recent: Array.isArray(r.recent) ? r.recent.filter((g): g is string => typeof g === "string").slice(0, 5) : [],
  };
}

/** What "Share my data" exports: everything except the parent PIN hash, salt and lock state. */
export function exportProfile(p: Profile): string {
  const { pinHash: _h, salt: _s, lock: _l, ...parent } = p.parent;
  return JSON.stringify({ app: "tashzone", version: 1, profile: { ...p, parent } }, null, 2);
}

/** Parses exported text back into a profile; the caller's own parent PIN fields are kept. Returns null when it is not a TashZone export. */
export function importProfile(text: string, current: Profile): Profile | null {
  try {
    const data = obj(JSON.parse(text));
    if (data.app !== "tashzone" || !data.profile) return null;
    const next = mergeProfile(data.profile);
    // parental controls are never taken from pasted text, or a child could switch them off by importing
    return { ...next, onboarded: true, protectedMode: current.protectedMode, parent: current.parent };
  } catch {
    return null;
  }
}

/** Win rate as a whole percent; 0 before the first match. */
export const winRate = (s: Profile["stats"]) => (s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0);
