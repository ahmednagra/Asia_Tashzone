/**
 * When a guest is asked to sign up. Pure TypeScript (no React Native) so the rules are unit-tested.
 *
 * Only on result screens, never mid-hand. The first sheet comes after N finished games or M minutes of play,
 * preferably on a win. Each "Not now" waits longer than the last (games and days), at most one sheet per app
 * session and a few in total. After that, a small card on the result screen that the player can switch off and
 * that retires itself after enough untapped views. Nothing at all in Protected Mode: children are never asked.
 * The server tunes every number through app-config (`signup_prompt`); these defaults apply when it is unreachable.
 */
import type { Profile, SignupState } from "../../store/profileModel";

export interface PromptConfig {
  enabled: boolean;
  firstAfterGames: number;
  playMinutes: number;
  maxSheets: number;
  cooldownGames: readonly number[];
  cooldownDays: readonly number[];
  cardMaxViews: number;
}

export const DEFAULT_PROMPT_CONFIG: PromptConfig = {
  enabled: true, firstAfterGames: 3, playMinutes: 10, maxSheets: 3, cooldownGames: [3, 10], cooldownDays: [0, 7], cardMaxViews: 10,
};

/** A trigger reached on a loss waits for a win, but never more than this many extra games. */
export const WIN_GRACE_GAMES = 2;
const DAY_MS = 86_400_000;

const whole = (v: unknown, d: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : d);
const wholes = (v: unknown, d: readonly number[], max: number) => {
  const list = Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x >= 0).map((x) => Math.min(max, Math.floor(x))) : [];
  return list.length ? list : d;
};

/** Reads app-config's `signup_prompt` block; anything missing or malformed falls back to the default for that field. */
export function promptConfigFrom(raw: unknown): PromptConfig {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_PROMPT_CONFIG;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : d.enabled,
    firstAfterGames: Math.max(1, whole(r.first_after_games, d.firstAfterGames, 50)),
    playMinutes: whole(r.play_minutes, d.playMinutes, 600),
    maxSheets: whole(r.max_sheets, d.maxSheets, 10),
    cooldownGames: wholes(r.cooldown_games, d.cooldownGames, 100),
    cooldownDays: wholes(r.cooldown_days, d.cooldownDays, 90),
    cardMaxViews: whole(r.card_max_views, d.cardMaxViews, 100),
  };
}

export interface PromptInput {
  config: PromptConfig;
  signup: SignupState;
  matches: number;
  won: boolean;
  /** false once this phone holds an account session */
  guest: boolean;
  protectedMode: boolean;
  /** true when the player can actually sign up here (Google or email offered by the server) */
  canSignUp: boolean;
  sheetShownThisSession: boolean;
  now: number;
}

export type PromptDecision = "sheet" | "card" | "none";

const pick = (list: readonly number[], i: number) => list[Math.min(i, list.length - 1)] ?? 0;

/** The game count at which the next sheet becomes due, or null when no sheet is due yet (or ever again). */
function sheetDueAt(i: PromptInput): number | null {
  const { config: c, signup: s } = i;
  if (s.sheets >= c.maxSheets) return null;
  if (s.sheets === 0) {
    const byTime = c.playMinutes > 0 && s.playMs >= c.playMinutes * 60_000;
    if (i.matches >= c.firstAfterGames) return c.firstAfterGames;
    return byTime ? i.matches : null;
  }
  const waitGames = pick(c.cooldownGames, s.sheets - 1);
  const waitDays = pick(c.cooldownDays, s.sheets - 1);
  if (i.now - s.lastSheetAt < waitDays * DAY_MS) return null;
  const due = s.lastSheetMatch + waitGames;
  return i.matches >= due ? due : null;
}

export function decidePrompt(i: PromptInput): PromptDecision {
  if (!i.guest || i.protectedMode || !i.config.enabled || !i.canSignUp) return "none";
  const due = sheetDueAt(i);
  if (due !== null && !i.sheetShownThisSession && (i.won || i.matches >= due + WIN_GRACE_GAMES)) return "sheet";
  const sheetsDone = i.signup.sheets >= i.config.maxSheets;
  const cardLive = !i.signup.cardOff && i.signup.cardViews < i.config.cardMaxViews;
  return sheetsDone && cardLive && i.matches >= i.config.firstAfterGames ? "card" : "none";
}

/** The profile change for a sheet that was just shown (whatever the player then chose). */
export function afterSheet(s: SignupState, matches: number, now: number): SignupState {
  return { ...s, sheets: s.sheets + 1, lastSheetMatch: matches, lastSheetAt: now };
}

/** A card view counts toward retiring it; tapping it starts the count again, "Don't show again" ends it. */
export function afterCard(s: SignupState, event: "view" | "tap" | "off"): SignupState {
  if (event === "off") return { ...s, cardOff: true };
  if (event === "tap") return { ...s, cardViews: 0 };
  return { ...s, cardViews: s.cardViews + 1 };
}

/** Foreground play is counted in slices; a slice longer than this is an idle phone, not play. */
export const MAX_PLAY_SLICE_MS = 30 * 60_000;
export const addPlayTime = (s: SignupState, ms: number): SignupState => ({ ...s, playMs: s.playMs + Math.max(0, Math.min(ms, MAX_PLAY_SLICE_MS)) });

/** Progress the sheet can honestly name: only wins, because a record of losses is nothing to protect. */
export const savedWins = (p: Pick<Profile, "stats">) => p.stats.wins;

/** At most one sheet per app session; module state, so it resets when the app process restarts. */
let sheetThisSession = false;
export const sheetShownThisSession = () => sheetThisSession;
export function markSheetShown(): void { sheetThisSession = true; }
/** Tests only. */
export function resetPromptSession(): void { sheetThisSession = false; }
