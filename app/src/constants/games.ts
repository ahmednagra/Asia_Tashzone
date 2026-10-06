/** Catalogue (01_GAME_RULES.md). Only frozen, implemented profiles are playable; others follow the roadmap. Player-facing text is per language. */
import { LANG_CODES, localized, subscribeLang, type Lang, type Tables } from "../i18n";
import type { GameEntry, SetupInfo } from "../types/game";
import { ur } from "./lang/ur";
import { hi } from "./lang/hi";
import { ne } from "./lang/ne";
import { bn } from "./lang/bn";

const GAMES_DATA_EN = {
  teams: { solo: "Solo", pairs: "Pairs" },
  regions: { nepal: "Nepal", india: "India", bangladesh: "Bangladesh", pakistan: "Pakistan", punjab: "Punjab" },
  tags: {
    trick: "Trick-taking", bidding: "Bidding", spadesTrump: "Spades trump", rummy: "Rummy family", melds: "Melds",
    partners: "Partners", trumpChosen: "Trump chosen", shedding: "Shedding", pickUp: "Pick-up", players38: "3 to 8 players",
    capturing: "Capturing", houses: "Houses", comparing: "Comparing", threeCards: "Three cards",
  },
  games: {
    callbreak: {
      description: "Win at least the tricks you call. Spades are always trump.",
      rules: [
        { label: "The deal", text: "13 cards each." },
        { label: "Legal move", text: "Follow suit and beat the top card if you can. Out of the suit? Play a spade if it would win." },
        { label: "Scoring", text: "Make your call to score it, plus 0.1 per extra trick. Miss it and lose your call." },
        { label: "Winning", text: "Highest total after the chosen rounds." },
      ],
    },
    callbridge: {
      description: "Call your tricks, then win exactly that many or one more.",
      rules: [
        { label: "The deal", text: "13 cards each." },
        { label: "Legal move", text: "Follow suit if you can. Out of the suit? Play a spade if it would win." },
        { label: "Scoring", text: "Calls run 2 to 12. Win exactly your call or one more." },
        { label: "Winning", text: "Highest total after the chosen hands." },
      ],
    },
    marriage: { description: "Draw and discard to build sequences and marriages first." },
    courtpiece: {
      alias: "Rung · Coat Pees",
      description: "Win 7 of 13 tricks with your partner. Sweep them all for a court.",
      rules: [
        { label: "The deal", text: "5 cards, trump is named, then 8 more." },
        { label: "Legal move", text: "Follow suit if you can; otherwise any card." },
        { label: "Scoring", text: "Two tricks in a row take the pile; first to 7 tricks wins the hand." },
        { label: "Winning", text: "First team to the target points." },
      ],
    },
    twentynine: { description: "Bid points with a partner, pick the trump and take the high cards." },
    bhabhi: {
      alias: "Thulla · Get Away",
      description: "Get rid of all your cards. The last one holding cards is the Bhabhi.",
      rules: [
        { label: "The deal", text: "The whole deck, as equal as possible." },
        { label: "Turn order", text: "The ace of spades leads the first trick." },
        { label: "Legal move", text: "Follow suit if you can. If not, any card is a thulla and stops the trick." },
        { label: "Winning", text: "Empty your hand to get away. The last one holding cards is the Bhabhi." },
      ],
    },
    seep: { alias: "Sweep", description: "Capture floor cards by matching values, and build houses." },
    teenpatti: { description: "Three cards each: the best hand at the showdown wins." },
  },
  setup: {
    rounds: "Rounds", hands: "Hands", points: "Points to win",
    untilBhabhi: (n: number) => `Until ${n}× Bhabhi`,
    handicaps: { even: "Even deal", challenging: "Challenging", pro: "Pro" },
    presets: {
      "callbreak.np@1": {
        classic: { label: "Classic", hint: "Call 1–8, extra tricks add 0.1, no-spade hands redealt" },
        "easy-follow": { label: "Easy follow", hint: "Follow suit; no need to beat the top card" },
        "call-bridge-classic": { label: "Call Bridge", hint: "Call 2–13, no bonus for extra tricks" },
        standard: { label: "Nepal standard", hint: "Call 1–13, ask for a redeal with a weak hand" },
        "lakdi-india": { label: "Lakdi", hint: "Standard rules, played clockwise" },
      },
      "callbridge.bd@1": {
        standard: { label: "Standard", hint: "Call 2–12; make your call or one more" },
      },
      "courtpiece.tz@1": {
        double: { label: "Double Sir", hint: "Win two tricks in a row to take the pile" },
        single: { label: "Single Sir", hint: "First team to 7 tricks wins the hand" },
        "double-ace": { label: "Double Sir with Ace", hint: "Two aces in a row don't take the pile" },
      },
      "bhabhi.tz@1": {
        standard: { label: "Standard", hint: "A thulla ends the trick; win with your last card and you draw" },
        "full-trick": { label: "Full trick", hint: "Everyone plays before the pickup" },
        "quick-escape": { label: "Quick escape", hint: "Your last card always gets you away" },
        "take-hand": { label: "Take-the-hand", hint: "You may take the next player's cards" },
      },
    },
  },
  genericError: "That move isn't allowed now",
};

export type GamesData = typeof GAMES_DATA_EN;
type GameId = keyof GamesData["games"];
type RegionId = keyof GamesData["regions"];
type TagId = keyof GamesData["tags"];
type ProfileId = keyof GamesData["setup"]["presets"];

const DATA_TABLES: Tables<GamesData> = { en: GAMES_DATA_EN, ur: ur.data, hi: hi.data, ne: ne.data, bn: bn.data };
const DATA = localized("games-data", DATA_TABLES);

interface GameBase {
  id: GameId; name: string; profile?: string; status: GameEntry["status"]; suit: NonNullable<GameEntry["suit"]>;
  seats: [number, number]; team: keyof GamesData["teams"]; difficulty: NonNullable<GameEntry["difficulty"]>;
  regions: RegionId[]; tags: TagId[];
}

const BASE: GameBase[] = [
  { id: "callbreak", name: "Callbreak", profile: "callbreak.np@1", status: "play", suit: "S", seats: [4, 4], team: "solo", difficulty: "Medium", regions: ["nepal", "india"], tags: ["trick", "bidding", "spadesTrump"] },
  { id: "callbridge", name: "Call Bridge", profile: "callbridge.bd@1", status: "play", suit: "S", seats: [4, 4], team: "solo", difficulty: "Medium", regions: ["bangladesh"], tags: ["trick", "bidding", "spadesTrump"] },
  { id: "marriage", name: "Marriage", status: "soon", suit: "H", seats: [2, 5], team: "solo", difficulty: "Hard", regions: ["nepal"], tags: ["rummy", "melds"] },
  { id: "courtpiece", name: "Court Piece", profile: "courtpiece.tz@1", status: "play", suit: "H", seats: [4, 4], team: "pairs", difficulty: "Medium", regions: ["pakistan", "india"], tags: ["trick", "partners", "trumpChosen"] },
  { id: "twentynine", name: "Twenty-Nine", status: "soon", suit: "C", seats: [4, 4], team: "pairs", difficulty: "Hard", regions: ["india", "bangladesh"], tags: ["trick", "partners", "bidding"] },
  { id: "bhabhi", name: "Bhabhi", profile: "bhabhi.tz@1", status: "play", suit: "H", seats: [3, 8], team: "solo", difficulty: "Easy", regions: ["pakistan", "india"], tags: ["shedding", "pickUp", "players38"] },
  { id: "seep", name: "Seep", status: "soon", suit: "C", seats: [4, 4], team: "pairs", difficulty: "Medium", regions: ["punjab"], tags: ["capturing", "partners", "houses"] },
  { id: "teenpatti", name: "Teen Patti", status: "soon", suit: "D", seats: [3, 6], team: "solo", difficulty: "Easy", regions: ["india", "nepal"], tags: ["comparing", "threeCards"] },
];

type GameText = { alias?: string; description: string; rules?: { label: string; text: string }[] };
const textOf = (id: GameId): GameText => DATA.games[id] as GameText;

function entry(b: GameBase): GameEntry {
  const g: GameEntry = { id: b.id, name: b.name, status: b.status, suit: b.suit, seats: b.seats, difficulty: b.difficulty, region: "" };
  if (b.profile) g.profile = b.profile;
  const live: PropertyDescriptorMap = {
    region: { enumerable: true, get: () => b.regions.map((r) => DATA.regions[r]).join(" · ") },
    teams: { enumerable: true, get: () => DATA.teams[b.team] },
    tags: { enumerable: true, get: () => b.tags.map((t) => DATA.tags[t]) },
    description: { enumerable: true, get: () => textOf(b.id).description },
  };
  if ((GAMES_DATA_EN.games[b.id] as GameText).alias) live.alias = { enumerable: true, get: () => textOf(b.id).alias };
  if ((GAMES_DATA_EN.games[b.id] as GameText).rules) live.rules = { enumerable: true, get: () => textOf(b.id).rules };
  return Object.defineProperties(g, live);
}

export const GAMES: GameEntry[] = BASE.map(entry);

const presetsOf = (profile: ProfileId) => DATA.setup.presets[profile] as Record<string, { label: string; hint: string }>;
function preset(profile: ProfileId, id: string): SetupInfo["presets"][number] {
  return { id, get label() { return presetsOf(profile)[id]!.label; }, get hint() { return presetsOf(profile)[id]!.hint; } };
}
const presets = (profile: ProfileId) => Object.keys(GAMES_DATA_EN.setup.presets[profile]).map((id) => preset(profile, id));
const numbered = (values: number[], settings: (n: number) => Record<string, unknown>) => values.map((n) => ({ label: String(n), settings: settings(n) }));
type LengthWord = "rounds" | "hands" | "points";
function withLengthLabel<T extends Omit<SetupInfo, "lengthLabel">>(word: LengthWord, info: T): T & SetupInfo {
  return Object.defineProperty(info, "lengthLabel", { enumerable: true, get: () => DATA.setup[word] }) as T & SetupInfo;
}
const handicap = (value: number, word: keyof GamesData["setup"]["handicaps"]) => ({ value, get label() { return DATA.setup.handicaps[word]; } });

/** Setup choices per profile (TashZone v1): presets shown first-to-last, match lengths, player counts. */
export const SETUP: Record<string, SetupInfo> = {
  "callbreak.np@1": withLengthLabel("rounds", {
    presets: presets("callbreak.np@1"),
    lengths: numbered([5, 10, 15], (r) => ({ rounds: r })), defaultLength: 0,
  }),
  "callbridge.bd@1": withLengthLabel("hands", {
    presets: presets("callbridge.bd@1"),
    lengths: numbered([5, 10, 15], (r) => ({ rounds: r })), defaultLength: 0,
  }),
  "courtpiece.tz@1": withLengthLabel("points", {
    presets: presets("courtpiece.tz@1"),
    lengths: numbered([3, 5, 7], (p) => ({ target_points: p })), defaultLength: 0,
  }),
  "bhabhi.tz@1": withLengthLabel("hands", {
    presets: presets("bhabhi.tz@1"),
    lengths: [
      ...numbered([1, 3, 5], (r) => ({ rounds: r, bhabhi_limit: 0 })),
      { get label() { return DATA.setup.untilBhabhi(3); }, settings: { rounds: 15, bhabhi_limit: 3 } },
    ],
    defaultLength: 1, players: [3, 4, 5, 6, 7, 8],
    handicaps: [handicap(0, "even"), handicap(3, "challenging"), handicap(6, "pro")],
  }),
};

export function presetLines(profile: string, lang: Lang): { label: string; hint: string }[] {
  const en = GAMES_DATA_EN.setup.presets[profile as ProfileId] as Record<string, { label: string; hint: string }> | undefined;
  if (!en) return [];
  const tr = DATA_TABLES[lang]?.setup?.presets?.[profile as ProfileId] as Record<string, { label?: string; hint?: string } | undefined> | undefined;
  return Object.keys(en).map((id) => ({ label: tr?.[id]?.label ?? en[id]!.label, hint: tr?.[id]?.hint ?? en[id]!.hint }));
}

const SEARCH = new Map<string, string>();
export function searchText(g: GameEntry): string {
  const hit = SEARCH.get(g.id);
  if (hit !== undefined) return hit;
  const b = BASE.find((x) => x.id === g.id);
  const parts: string[] = [g.name];
  if (b) {
    for (const l of LANG_CODES) {
      const d = DATA_TABLES[l];
      const text = d?.games?.[b.id] as Partial<GameText> | undefined;
      parts.push(text?.alias ?? "", text?.description ?? "");
      for (const r of b.regions) parts.push(d?.regions?.[r] ?? "");
      for (const t of b.tags) parts.push(d?.tags?.[t] ?? "");
    }
  }
  const out = parts.filter(Boolean).join(" ").toLowerCase();
  SEARCH.set(g.id, out);
  return out;
}

const ERRORS_EN = {
  NOT_YOUR_TURN: "Wait for your turn",
  MUST_FOLLOW_SUIT: "Follow the lead suit",
  MUST_BEAT: "Play a higher card of the lead suit",
  MUST_TRUMP: "Out of the lead suit: play a trump",
  MUST_OVERTRUMP: "Play a higher trump",
  MUST_NOT_LEAD_TRUMP: "You can't lead a spade on the first trick",
  MUST_LEAD_ACE_OF_SPADES: "Start with the ace of spades",
  CALL_OUT_OF_RANGE: "Pick one of the numbers shown",
  CARD_NOT_IN_HAND: "That card isn't in your hand any more",
  WRONG_PHASE: "You can't do that right now",
  MATCH_OVER: "This game is over",
};
export type ErrorCodes = typeof ERRORS_EN;

/** Player-facing text for the engine's stable rule codes (v1). */
export const ERROR_MESSAGES: Record<string, string> = localized<Record<string, string>>("game-errors", { en: ERRORS_EN, ur: ur.errors, hi: hi.errors, ne: ne.errors, bn: bn.errors });
export let GENERIC_ERROR: string = DATA.genericError;
subscribeLang(() => { GENERIC_ERROR = DATA.genericError; });
export const errorText = (code?: string | null): string => (code ? ERROR_MESSAGES[code] : undefined) ?? DATA.genericError;
