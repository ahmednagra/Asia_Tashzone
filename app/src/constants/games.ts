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
      description: "Take at least as many tricks as you called. Spades are always trump.",
      rules: [
        { label: "The deal", text: "13 cards each." },
        { label: "Legal move", text: "Follow the led suit if you can; a spade beats any other suit." },
        { label: "Scoring", text: "Make your call to score it, extra tricks add 0.1 each, a miss loses your call." },
        { label: "Winning", text: "Highest total after the chosen number of rounds." },
      ],
    },
    callbridge: {
      description: "Call how many tricks you will take, then make your call or one more.",
      rules: [
        { label: "The deal", text: "13 cards each." },
        { label: "Legal move", text: "Follow suit if you can; otherwise play a spade if you have one." },
        { label: "Scoring", text: "Calls run from 2 to 12; you must make your call or one more." },
        { label: "Winning", text: "Highest total after the chosen number of hands." },
      ],
    },
    marriage: { description: "Draw and discard to build sequences and marriages before anyone else." },
    courtpiece: {
      alias: "Rung · Coat Pees",
      description: "Win seven of thirteen tricks with your partner; win streaks to score a court.",
      rules: [
        { label: "The deal", text: "5 cards, trump is chosen, then the rest." },
        { label: "Legal move", text: "Follow suit if able; otherwise any card." },
        { label: "Scoring", text: "Tricks won in a row collect the pile; first to seven wins the hand." },
        { label: "Winning", text: "First team to the points target." },
      ],
    },
    twentynine: { description: "Bid points with a partner, pick the trump and take the high cards." },
    bhabhi: {
      alias: "Thulla · Get Away",
      description: "Get rid of all your cards. The last player still holding cards is the Bhabhi.",
      rules: [
        { label: "The deal", text: "The whole deck, as equal as possible." },
        { label: "Turn order", text: "The ace of spades leads the first trick." },
        { label: "Legal move", text: "Follow suit if you can. If you cannot, any card interrupts the trick: a thulla." },
        { label: "Winning", text: "Escape with no cards. The last one holding cards is the Bhabhi." },
      ],
    },
    seep: { alias: "Sweep", description: "Capture cards from the floor by matching values and build houses." },
    teenpatti: { description: "A three-card showdown: hold the best hand when the cards are shown." },
  },
  setup: {
    rounds: "Rounds", hands: "Hands", points: "Points to win",
    untilBhabhi: (n: number) => `Until ${n}× Bhabhi`,
    handicaps: { even: "Even deal", challenging: "Challenging", pro: "Pro" },
    presets: {
      "callbreak.np@1": {
        classic: { label: "Classic", hint: "Call 1–8, extra tricks add 0.1, no-spade hands redealt" },
        "easy-follow": { label: "Easy follow", hint: "Follow suit; no need to beat the card" },
        "call-bridge-classic": { label: "Call Bridge", hint: "Call 2–13, no bonus for extra tricks" },
        standard: { label: "Nepal standard", hint: "Call 1–13, ask for a redeal with a weak hand" },
        "lakdi-india": { label: "Lakdi", hint: "Standard rules, played clockwise" },
      },
      "callbridge.bd@1": {
        standard: { label: "Standard", hint: "Call 2–12; make your call or one more" },
      },
      "courtpiece.tz@1": {
        double: { label: "Double Sir", hint: "Win two tricks in a row to collect them" },
        single: { label: "Single Sir", hint: "First team to 7 tricks wins the hand" },
        "double-ace": { label: "Double Sir with Ace", hint: "Two aces in a row do not collect the pile" },
      },
      "bhabhi.tz@1": {
        standard: { label: "Standard", hint: "A thulla ends the trick; win with your last card and you draw" },
        "full-trick": { label: "Full trick", hint: "Everyone plays, then the pickup happens" },
        "quick-escape": { label: "Quick escape", hint: "Your last card always gets you away" },
        "take-hand": { label: "Take-the-hand", hint: "You may take the next player's cards" },
      },
    },
  },
  genericError: "That move is not allowed right now",
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
  MUST_TRUMP: "No card of the lead suit: play a trump",
  MUST_OVERTRUMP: "Play a higher trump",
  MUST_NOT_LEAD_TRUMP: "You may not lead a spade on the first trick",
  MUST_LEAD_ACE_OF_SPADES: "Start with the ace of spades",
  CALL_OUT_OF_RANGE: "Choose one of the numbers shown",
  CARD_NOT_IN_HAND: "That card is no longer in your hand",
  WRONG_PHASE: "That cannot be done at this moment",
  MATCH_OVER: "This game has finished",
};
export type ErrorCodes = typeof ERRORS_EN;

/** Player-facing text for the engine's stable rule codes (v1). */
export const ERROR_MESSAGES: Record<string, string> = localized<Record<string, string>>("game-errors", { en: ERRORS_EN, ur: ur.errors, hi: hi.errors, ne: ne.errors, bn: bn.errors });
export let GENERIC_ERROR: string = DATA.genericError;
subscribeLang(() => { GENERIC_ERROR = DATA.genericError; });
export const errorText = (code?: string | null): string => (code ? ERROR_MESSAGES[code] : undefined) ?? DATA.genericError;
