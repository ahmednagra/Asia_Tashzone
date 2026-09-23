/** Catalogue (01_GAME_RULES.md). Only frozen, implemented profiles are playable; others follow the roadmap. */
import type { GameEntry, SetupInfo } from "../types/game";

export const GAMES: GameEntry[] = [
  {
    id: "callbreak", name: "Callbreak", region: "Nepal · India", profile: "callbreak.np@1", status: "play",
    suit: "S", seats: [4, 4], teams: "Solo", difficulty: "Medium", tags: ["Trick-taking", "Bidding", "Spades trump"],
    description: "Take at least as many tricks as you called. Spades are always trump.",
    rules: [
      { label: "The deal", text: "13 cards each." },
      { label: "Legal move", text: "Follow the led suit if you can; a spade beats any other suit." },
      { label: "Scoring", text: "Make your call to score it, extra tricks add 0.1 each, a miss loses your call." },
      { label: "Winning", text: "Highest total after the chosen number of rounds." },
    ],
  },
  {
    id: "callbridge", name: "Call Bridge", region: "Bangladesh", profile: "callbridge.bd@1", status: "play",
    suit: "S", seats: [4, 4], teams: "Solo", difficulty: "Medium", tags: ["Trick-taking", "Bidding", "Spades trump"],
    description: "Call how many tricks you will take, then make your call or one more.",
    rules: [
      { label: "The deal", text: "13 cards each." },
      { label: "Legal move", text: "Follow suit if you can; otherwise play a spade if you have one." },
      { label: "Scoring", text: "Calls run from 2 to 12; you must make your call or one more." },
      { label: "Winning", text: "Highest total after the chosen number of hands." },
    ],
  },
  {
    id: "marriage", name: "Marriage", region: "Nepal", status: "soon",
    suit: "H", seats: [2, 5], teams: "Solo", difficulty: "Hard", tags: ["Rummy family", "Melds"],
    description: "Draw and discard to build sequences and marriages before anyone else.",
  },
  {
    id: "courtpiece", name: "Court Piece", alias: "Rung · Coat Pees", region: "Pakistan · India", profile: "courtpiece.tz@1", status: "play",
    suit: "H", seats: [4, 4], teams: "Pairs", difficulty: "Medium", tags: ["Trick-taking", "Partners", "Trump chosen"],
    description: "Win seven of thirteen tricks with your partner; win streaks to score a court.",
    rules: [
      { label: "The deal", text: "5 cards, trump is chosen, then the rest." },
      { label: "Legal move", text: "Follow suit if able; otherwise any card." },
      { label: "Scoring", text: "Tricks won in a row collect the pile; first to seven wins the hand." },
      { label: "Winning", text: "First team to the points target." },
    ],
  },
  {
    id: "twentynine", name: "Twenty-Nine", region: "India · Bangladesh", status: "soon",
    suit: "C", seats: [4, 4], teams: "Pairs", difficulty: "Hard", tags: ["Trick-taking", "Partners", "Bidding"],
    description: "Bid points with a partner, pick the trump and take the high cards.",
  },
  {
    id: "bhabhi", name: "Bhabhi", alias: "Thulla · Get Away", region: "Pakistan · India", profile: "bhabhi.tz@1", status: "play",
    suit: "H", seats: [3, 8], teams: "Solo", difficulty: "Easy", tags: ["Shedding", "Pick-up", "3 to 8 players"],
    description: "Get rid of all your cards. The last player still holding cards is the Bhabhi.",
    rules: [
      { label: "The deal", text: "The whole deck, as equal as possible." },
      { label: "Turn order", text: "The ace of spades leads the first trick." },
      { label: "Legal move", text: "Follow suit if you can. If you cannot, any card interrupts the trick: a thulla." },
      { label: "Winning", text: "Escape with no cards. The last one holding cards is the Bhabhi." },
    ],
  },
  {
    id: "seep", name: "Seep", alias: "Sweep", region: "Punjab", status: "soon",
    suit: "C", seats: [4, 4], teams: "Pairs", difficulty: "Medium", tags: ["Capturing", "Partners", "Houses"],
    description: "Capture cards from the floor by matching values and build houses.",
  },
  {
    id: "teenpatti", name: "Teen Patti", region: "India · Nepal", status: "soon",
    suit: "D", seats: [3, 6], teams: "Solo", difficulty: "Easy", tags: ["Comparing", "Three cards"],
    description: "A three-card showdown: hold the best hand when the cards are shown.",
  },
];

/** Setup choices per profile (TashZone v1): presets shown first-to-last, match lengths, player counts. */
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
