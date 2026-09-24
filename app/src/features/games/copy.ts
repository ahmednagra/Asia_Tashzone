/** All English strings and small pure helpers for the home, catalogue, game, ways and setup screens. */
import { GAMES, SETUP } from "../../constants/games";
import type { GameEntry } from "../../types/game";

export const T = {
  home: {
    title: "TashZone", sub: "A table for the games you grew up with.",
    level: (n: number) => `Level ${n}`,
    stats: ["Matches", "Wins", "Streak", "Bhabhi"] as const,
    pick: "Pick a game", all: (n: number) => `All ${n} ›`,
    join: "Join a friend", joinNearby: "Nearby", joinCode: "Room code",
  },
  tile: { last: "last played", soon: "Coming soon", players: "players", solo: "Solo", play: (n: string) => `Deal ${n} now`, open: (n: string) => `${n}, open game page` },
  games: {
    title: "Games", search: "Search games", placeholder: "Search — Bhabhi, Rung, Thulla…", count: (n: number, all: number) => (n === all ? `${all} games` : `${n} of ${all}`),
    filters: { all: "All", play: "Ready", soon: "Coming soon" },
    emptyTitle: (q: string) => `Nothing called “${q}”`, emptyHint: "Try a local name: Rung, Thulla, Get Away, Sweep.", showAll: "Show everything",
    emptyFilterTitle: "No games here yet", emptyFilterHint: "Nothing matches this filter right now.",
    inDev: "In development",
  },
  detail: {
    rules: "Rules", tags: "Features", play: "Play", soon: "Coming soon", soonNote: "This game is still in development and cannot be dealt yet.",
    notFound: "Game not found", notFoundBody: "This game is not in the catalogue. It may have been renamed or removed.", back: "Back to games",
    players: (a: string) => `${a} players`, pick: "The rules for this game are still being written.",
    aka: "Also called",
  },
  ways: {
    title: "Ways to play", rules: "Rules",
    bots: { t: "Play with bots", d: "Offline · saved after every move", b: "Offline" },
    pass: { t: "Pass and play", d: "One phone, hand it round", b: "One phone" },
    wifi: { t: "Same Wi-Fi", d: "Host a table for friends on one network", b: "No internet" },
    room: { t: "Private room", d: "Share a six-character code", b: "Online" },
    later: "Later", soonGame: "This game is still in development.", soonMode: "Coming soon",
  },
  setup: {
    title: "Play with bots", rules: "Rules in play", length: "Length", players: "Players", bots: "Bot skill", deal: "Deal",
    playersHint: "Empty chairs are filled by bots.", start: "Deal the cards", notPlayable: "This game cannot be dealt yet.",
    notFound: "There is no bot table for this game.",
    levels: [
      { id: "easy", label: "Easy", hint: "Plays a legal card, forgets the table." },
      { id: "medium", label: "Medium", hint: "Reads voids and holds its high cards back." },
      { id: "hard", label: "Professional", hint: "Counts every card and hunts for the trap." },
    ],
  },
} as const;

export const SUIT_GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;

export const playable = (g: GameEntry): boolean => g.status === "play" && !!g.profile && !!SETUP[g.profile];
export const findGame = (id: string | undefined): GameEntry | undefined => GAMES.find((g) => g.id === id);
export const playersText = (g: GameEntry): string => {
  const [a, b] = g.seats ?? [4, 4];
  return a === b ? String(a) : `${a}–${b}`;
};

export interface BotSetup { preset: string; length: number; players: number; level: "easy" | "medium" | "hard"; handicap: number }

/** Defaults for a bot table of this game (same defaults the setup screen opens with). */
export function defaultSetup(g: GameEntry): BotSetup | undefined {
  const info = g.profile ? SETUP[g.profile] : undefined;
  if (!info) return undefined;
  const [lo, hi] = g.seats ?? [4, 4];
  const want = Math.min(Math.max(4, lo), hi);
  const players = info.players ? (info.players.includes(want) ? want : info.players[0]!) : want;
  return { preset: info.presets[0]!.id, length: info.defaultLength, players, level: "medium", handicap: 0 };
}

/** Route params for /play/[game]: all strings; `length` is the index into SETUP.lengths. */
export function playParams(g: GameEntry, c: BotSetup): Record<string, string> {
  return { game: g.id, preset: c.preset, length: String(c.length), players: String(c.players), level: c.level, handicap: String(c.handicap) };
}
