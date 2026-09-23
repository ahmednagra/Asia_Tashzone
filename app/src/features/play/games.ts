/** Catalogue (01_GAME_RULES.md). Only frozen, implemented profiles are playable; others follow the roadmap. */
export interface GameEntry { id: string; name: string; alias?: string; region: string; profile?: string; status: "play" | "soon" }
export const GAMES: GameEntry[] = [
  { id: "callbreak", name: "Callbreak", region: "Nepal · India", profile: "callbreak.np@1", status: "play" },
  { id: "callbridge", name: "Call Bridge", region: "Bangladesh", profile: "callbridge.bd@1", status: "play" },
  { id: "marriage", name: "Marriage", region: "Nepal", status: "soon" },
  { id: "courtpiece", name: "Court Piece", alias: "Rung · Coat Pees", region: "Pakistan · India", profile: "courtpiece.tz@1", status: "play" },
  { id: "twentynine", name: "Twenty-Nine", region: "India · Bangladesh", status: "soon" },
  { id: "bhabhi", name: "Bhabhi", alias: "Thulla · Get Away", region: "Pakistan · India", profile: "bhabhi.tz@1", status: "play" },
  { id: "seep", name: "Seep", alias: "Sweep", region: "Punjab", status: "soon" },
  { id: "teenpatti", name: "Teen Patti", region: "India · Nepal", status: "soon" },
];

/** Setup choices per profile (TashZone v1): presets shown first-to-last, match lengths, player counts. */
export interface SetupInfo {
  presets: { id: string; label: string; hint: string }[];
  lengthLabel: string;
  lengths: { label: string; settings: Record<string, unknown> }[];
  defaultLength: number;
  players?: number[];
  handicaps?: { value: number; label: string }[];
}
export const SETUP: Record<string, SetupInfo> = {
  "callbreak.np@1": {
    presets: [
      { id: "classic", label: "Classic", hint: "Call 1–8, extra tricks add 0.1, no-spade hands redealt" },
      { id: "easy-follow", label: "Easy follow", hint: "Follow suit; no need to beat the card" },
      { id: "call-bridge-classic", label: "Call Bridge", hint: "Call 2–13, no bonus for extra tricks" },
      { id: "standard", label: "Nepal standard", hint: "Call 1–13, ask for a redeal with a weak hand" },
      { id: "lakdi-india", label: "Lakdi", hint: "Standard rules, played clockwise" },
    ],
    lengthLabel: "Rounds", lengths: [5, 10, 15].map((r) => ({ label: String(r), settings: { rounds: r } })), defaultLength: 0,
  },
  "callbridge.bd@1": {
    presets: [{ id: "standard", label: "Standard", hint: "Call 2–12; make your call or one more" }],
    lengthLabel: "Hands", lengths: [5, 10, 15].map((r) => ({ label: String(r), settings: { rounds: r } })), defaultLength: 0,
  },
  "courtpiece.tz@1": {
    presets: [
      { id: "double", label: "Double Sir", hint: "Win two tricks in a row to collect them" },
      { id: "single", label: "Single Sir", hint: "First team to 7 tricks wins the hand" },
      { id: "double-ace", label: "Double Sir with Ace", hint: "Two aces in a row do not collect the pile" },
    ],
    lengthLabel: "Points to win", lengths: [3, 5, 7].map((p) => ({ label: String(p), settings: { target_points: p } })), defaultLength: 0,
  },
  "bhabhi.tz@1": {
    presets: [
      { id: "standard", label: "Standard", hint: "A thulla ends the trick; win with your last card and you draw" },
      { id: "full-trick", label: "Full trick", hint: "Everyone plays, then the pickup happens" },
      { id: "quick-escape", label: "Quick escape", hint: "Your last card always gets you away" },
      { id: "take-hand", label: "Take-the-hand", hint: "You may take the next player's cards" },
    ],
    lengthLabel: "Hands",
    lengths: [
      ...[1, 3, 5].map((r) => ({ label: String(r), settings: { rounds: r, bhabhi_limit: 0 } })),
      { label: "Until 3× Bhabhi", settings: { rounds: 15, bhabhi_limit: 3 } },
    ],
    defaultLength: 1, players: [3, 4, 5, 6, 7, 8],
    handicaps: [{ value: 0, label: "Even deal" }, { value: 3, label: "Challenging" }, { value: 6, label: "Pro" }],
  },
};

/** Player-facing text for the engine's stable rule codes (v1). */
export const ERROR_MESSAGES: Record<string, string> = {
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
export const GENERIC_ERROR = "That move is not allowed right now";
