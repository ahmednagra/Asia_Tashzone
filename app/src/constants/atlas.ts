/**
 * Atlas: the mockup's "All screens" board as a browsable index. Each entry opens the real route.
 * Errors are dialogs, not routes, so they are reference cards (href null) with their exact copy
 * from the mockup's overlay set. Labels and descriptions are per language.
 */
import { localized } from "../i18n";
import { ur } from "./lang/ur";
import { hi } from "./lang/hi";
import { ne } from "./lang/ne";
import { bn } from "./lang/bn";

export const ATLAS_GROUPS = ["All", "Start", "Home", "Rooms", "Table", "Results", "Settings", "Errors"] as const;
export type AtlasGroup = (typeof ATLAS_GROUPS)[number];

export interface AtlasEntry {
  id: string;
  group: Exclude<AtlasGroup, "All">;
  label: string;
  sub: string;
  /** app route, or null for a dialog that has no route of its own */
  href: string | null;
}

const ATLAS_EN = {
  groups: { All: "All", Start: "Start", Home: "Home", Rooms: "Rooms", Table: "Table", Results: "Results", Settings: "Settings", Errors: "Errors" },
  entries: {
    welcome: { label: "Welcome", sub: "the first screen and the wordmark" },
    language: { label: "Language", sub: "five languages, Urdu flips the layout" },
    age: { label: "Birth year", sub: "the drum, for the age gate" },
    mode: { label: "Easy or standard", sub: "one choice, no settings tour" },
    name: { label: "Your name", sub: "generated, never asked for" },

    home: { label: "Home", sub: "hero arc, stats, the shelf" },
    games: { label: "Games", sub: "every game, by family" },
    detail: { label: "Game detail", sub: "rules, learn, compare, presets" },
    ways: { label: "Ways to play", sub: "bots, Wi-Fi, hotspot, pass-and-play" },
    howto: { label: "How to play", sub: "the basics: ranks, tricks, trump" },

    setup: { label: "Set up", sub: "seats, preset, house rules" },
    wifiHost: { label: "Host on Wi-Fi", sub: "the code and the QR" },
    wifiJoin: { label: "Join on Wi-Fi", sub: "tables found nearby" },
    pin: { label: "PIN", sub: "the keypad" },
    hotspot: { label: "Hotspot", sub: "no router needed" },
    room: { label: "Private room", sub: "a code you send on" },
    online: { label: "Online room", sub: "a table played over the internet" },
    lobby: { label: "Lobby", sub: "waiting for the seats to fill" },
    pass: { label: "Pass and play", sub: "one phone, hand to hand" },

    playCallbreak: { label: "Callbreak", sub: "calls and tricks on every seat" },
    playCallbridge: { label: "Call Bridge", sub: "calls of 2 to 12" },
    playCourtpiece: { label: "Court Piece", sub: "partners, the rung, the pile" },
    playBhabhi: { label: "Bhabhi", sub: "the fan, the trick, the pickup" },

    handResult: { label: "Hand result", sub: "the ledger, and why each row scored" },
    handOver: { label: "Hand over", sub: "who was left holding the cards" },
    match: { label: "Match summary", sub: "the whole match, win or interrupted" },

    me: { label: "You", sub: "level, badges, recent hands" },
    themes: { label: "Table designs", sub: "regional cloths" },
    settings: { label: "Settings", sub: "the whole tree from one panel" },
    appearance: { label: "How it looks", sub: "theme, palette, cards" },
    playing: { label: "Playing", sub: "hints, clock, tracker, house rules" },
    sound: { label: "Sound and feel", sub: "the soundstage and haptics" },
    parent: { label: "Parent controls", sub: "what a PIN can hold back" },
    parentPin: { label: "Parent PIN", sub: "four digits" },
    rules: { label: "Rules and terms", sub: "every game, every word" },
    account: { label: "Account and data", sub: "on this phone only" },

    leave: { label: "Leave this match?", sub: "A bot plays your seat for the rest of the match. Come back any time the room is live." },
    paused: { label: "Table paused", sub: "The server is catching up. All clocks are frozen and restart in full." },
    lost: { label: "Connection lost", sub: "Your seat is kept. Play resumes at your next move." },
    unreachable: { label: "Cannot reach the table", sub: "A bot holds your seat. Rejoin any time the room is live." },
    serverUpdate: { label: "Server update", sub: "Your game goes on. If the update changes the rules, the match ends after this round." },
    interrupted: { label: "Match interrupted", sub: "A server update stopped the match. It counts as neither a win nor a loss." },
    updateToJoin: { label: "Update to join", sub: "This table uses newer rules than your TashZone. Update, then open the link again." },
    locked: { label: "This room is closed to new players", sub: "Ask the host to unlock it, or join another room." },
    waitingHost: { label: "Waiting for the host", sub: "The host will see your request in the lobby." },
    expired: { label: "That code has expired", sub: "Rooms close after sitting idle for a while." },
    refused: { label: "You cannot join this room", sub: "" },
    removed: { label: "The host removed you", sub: "You can't rejoin this room. Other rooms are fine." },
    offline: { label: "You are offline", sub: "Offline games still work. Online rooms reconnect on their own." },
    rulesChanged: { label: "Rules changed", sub: "This saved game uses older rules. Start a new game to keep playing." },
    voiceOff: { label: "Voice is off in Parent controls", sub: "A parent can turn it back on with the PIN." },
    saveFailed: { label: "Could not save your result", sub: "It retries on its own. If it keeps failing, give support the code." },
  },
};
export type AtlasText = typeof ATLAS_EN;
type EntryId = keyof AtlasText["entries"];

export const ATLAS_TEXT = localized("atlas", { en: ATLAS_EN, ur: ur.atlas, hi: hi.atlas, ne: ne.atlas, bn: bn.atlas });

const e = (group: AtlasEntry["group"], id: EntryId, href: string | null): AtlasEntry => ({
  id, group, href,
  get label() { return ATLAS_TEXT.entries[id].label; },
  get sub() { return ATLAS_TEXT.entries[id].sub; },
});

export const ATLAS: AtlasEntry[] = [
  e("Start", "welcome", "/onboarding/welcome"),
  e("Start", "language", "/onboarding/language"),
  e("Start", "age", "/onboarding/age"),
  e("Start", "mode", "/onboarding/mode"),
  e("Start", "name", "/onboarding/name"),

  e("Home", "home", "/"),
  e("Home", "games", "/games"),
  e("Home", "detail", "/game/callbreak"),
  e("Home", "ways", "/game/callbreak/ways"),
  e("Home", "howto", "/howto"),

  e("Rooms", "setup", "/game/callbreak/setup"),
  e("Rooms", "wifiHost", "/wifi/host"),
  e("Rooms", "wifiJoin", "/wifi/join"),
  e("Rooms", "pin", "/wifi/pin"),
  e("Rooms", "hotspot", "/wifi/hotspot"),
  e("Rooms", "room", "/room"),
  e("Rooms", "online", "/online/callbreak"),
  e("Rooms", "lobby", "/wait"),
  e("Rooms", "pass", "/pass"),

  e("Table", "playCallbreak", "/play/callbreak"),
  e("Table", "playCallbridge", "/play/callbridge"),
  e("Table", "playCourtpiece", "/play/courtpiece"),
  e("Table", "playBhabhi", "/play/bhabhi"),

  e("Results", "handResult", "/result/hand"),
  e("Results", "handOver", "/result/game"),
  e("Results", "match", "/match"),

  e("Settings", "me", "/me"),
  e("Settings", "themes", "/themes"),
  e("Settings", "settings", "/settings"),
  e("Settings", "appearance", "/settings/appearance"),
  e("Settings", "playing", "/settings/play"),
  e("Settings", "sound", "/settings/sound"),
  e("Settings", "parent", "/settings/parent"),
  e("Settings", "parentPin", "/settings/parent-pin"),
  e("Settings", "rules", "/rules"),
  e("Settings", "account", "/settings/account"),

  e("Errors", "leave", null),
  e("Errors", "paused", null),
  e("Errors", "lost", null),
  e("Errors", "unreachable", null),
  e("Errors", "serverUpdate", null),
  e("Errors", "interrupted", null),
  e("Errors", "updateToJoin", null),
  e("Errors", "locked", null),
  e("Errors", "waitingHost", null),
  e("Errors", "expired", null),
  e("Errors", "refused", null),
  e("Errors", "removed", null),
  e("Errors", "offline", null),
  e("Errors", "rulesChanged", null),
  e("Errors", "voiceOff", null),
  e("Errors", "saveFailed", null),
];

export function atlasFor(group: AtlasGroup): AtlasEntry[] { return group === "All" ? ATLAS : ATLAS.filter((x) => x.group === group); }
export const atlasGroupLabel = (group: AtlasGroup): string => ATLAS_TEXT.groups[group];
