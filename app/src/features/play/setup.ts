/** Table setup choices (pure, tested in Node): defaults, deep-link parameters, engine settings and a readable summary. */
import type { BotLevel } from "@tashzone/engine";
import type { SetupInfo } from "../../types/game";

export interface Choice { preset: string; length: number; players: number; level: BotLevel; handicap: number }

export const BOT_LEVELS: readonly { value: BotLevel; label: string }[] = [
  { value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" },
];

export function defaultChoice(info: SetupInfo): Choice {
  return { preset: info.presets[0]!.id, length: info.defaultLength, players: 4, level: "medium", handicap: 0 };
}

type Param = string | string[] | undefined;
const one = (p: Param): string | undefined => (Array.isArray(p) ? p[0] : p);
const int = (p: Param): number | null => {
  const v = one(p);
  return v !== undefined && /^\d{1,3}$/.test(v) ? Number(v) : null;
};

/**
 * Route parameters -> a complete choice, or null when anything the setup asks for is missing or invalid
 * (then the built-in setup sheet is shown). Needs preset, length (index), level, plus players / handicap
 * for the games that have them.
 */
export function parseSetupParams(info: SetupInfo, p: Record<string, Param>): Choice | null {
  const preset = one(p.preset);
  if (!preset || !info.presets.some((x) => x.id === preset)) return null;
  const length = int(p.length);
  if (length === null || length >= info.lengths.length) return null;
  const level = one(p.level);
  if (!BOT_LEVELS.some((l) => l.value === level)) return null;
  let players = 4;
  if (info.players) {
    const n = int(p.players);
    if (n === null || !info.players.includes(n)) return null;
    players = n;
  }
  let handicap = 0;
  if (info.handicaps) {
    const h = int(p.handicap);
    if (h === null || !info.handicaps.some((x) => x.value === h)) return null;
    handicap = h;
  }
  return { preset, length, players, level: level as BotLevel, handicap };
}

/** Room settings handed to the engine compiler. */
export function settingsFor(info: SetupInfo, c: Choice): Record<string, unknown> {
  const settings: Record<string, unknown> = { ...info.lengths[c.length]!.settings };
  if (info.players) settings.players = c.players;
  if (info.handicaps) settings.handicap = c.handicap;
  return settings;
}

/** [label, value] rows for the table-info sheet. */
export function describeChoice(info: SetupInfo, c: Choice): [string, string][] {
  const rows: [string, string][] = [
    ["Rules", info.presets.find((x) => x.id === c.preset)?.label ?? c.preset],
    [info.lengthLabel, info.lengths[c.length]?.label ?? String(c.length)],
  ];
  if (info.players) rows.push(["Players", String(c.players)]);
  rows.push(["Bots", BOT_LEVELS.find((l) => l.value === c.level)?.label ?? c.level]);
  if (info.handicaps) rows.push(["Deal", info.handicaps.find((h) => h.value === c.handicap)?.label ?? String(c.handicap)]);
  return rows;
}
