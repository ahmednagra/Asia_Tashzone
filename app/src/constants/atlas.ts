/**
 * Atlas: the mockup's "All screens" board as a browsable index. Each entry opens the real route.
 * Errors are dialogs, not routes, so they are reference cards (href null) with their exact copy
 * from the mockup's overlay set.
 */
export const ATLAS_GROUPS = ["All", "Start", "Home", "Rooms", "Table", "Results", "Settings", "Errors"] as const;
export type AtlasGroup = (typeof ATLAS_GROUPS)[number];

export interface AtlasEntry {
  group: Exclude<AtlasGroup, "All">;
  label: string;
  sub: string;
  /** app route, or null for a dialog that has no route of its own */
  href: string | null;
}

const e = (group: AtlasEntry["group"], label: string, sub: string, href: string | null): AtlasEntry => ({ group, label, sub, href });

export const ATLAS: AtlasEntry[] = [
  e("Start", "Welcome", "the first screen and the wordmark", "/onboarding/welcome"),
  e("Start", "Language", "four scripts, Urdu flips the chrome", "/onboarding/language"),
  e("Start", "Birth year", "the drum, for the age gate", "/onboarding/age"),
  e("Start", "Easy or standard", "one choice, no settings tour", "/onboarding/mode"),
  e("Start", "Your name", "generated, never asked for", "/onboarding/name"),

  e("Home", "Home", "hero arc, stats, the shelf", "/"),
  e("Home", "Games", "every game, by family", "/games"),
  e("Home", "Game detail", "rules, learn, compare, presets", "/game/callbreak"),
  e("Home", "Ways to play", "bots, Wi-Fi, hotspot, pass-and-play", "/game/callbreak/ways"),
  e("Home", "How to play", "the basics: ranks, tricks, trump", "/howto"),

  e("Rooms", "Set up", "seats, preset, house rules", "/game/callbreak/setup"),
  e("Rooms", "Host on Wi-Fi", "the code and the QR", "/wifi/host"),
  e("Rooms", "Join on Wi-Fi", "tables found nearby", "/wifi/join"),
  e("Rooms", "PIN", "the keypad", "/wifi/pin"),
  e("Rooms", "Hotspot", "no router needed", "/wifi/hotspot"),
  e("Rooms", "Private room", "a code you send on", "/room"),
  e("Rooms", "Online room", "a table played over the internet", "/online/callbreak"),
  e("Rooms", "Lobby", "waiting for the seats to fill", "/wait"),
  e("Rooms", "Pass and play", "one phone, hand to hand", "/pass"),

  e("Table", "Callbreak", "calls and tricks on every seat", "/play/callbreak"),
  e("Table", "Call Bridge", "calls of 2 to 12", "/play/callbridge"),
  e("Table", "Court Piece", "partners, the rung, the pile", "/play/courtpiece"),
  e("Table", "Bhabhi", "the fan, the trick, the pickup", "/play/bhabhi"),

  e("Results", "Hand result", "the ledger, and why each row scored", "/result/hand"),
  e("Results", "Hand over", "who was left holding the cards", "/result/game"),
  e("Results", "Match summary", "the whole match, win or interrupted", "/match"),

  e("Settings", "You", "level, badges, recent hands", "/me"),
  e("Settings", "Table designs", "regional cloths", "/themes"),
  e("Settings", "Settings", "the whole tree from one panel", "/settings"),
  e("Settings", "How it looks", "theme, palette, cards", "/settings/appearance"),
  e("Settings", "Playing", "hints, clock, tracker, house rules", "/settings/play"),
  e("Settings", "Sound and feel", "the soundstage and haptics", "/settings/sound"),
  e("Settings", "Parent controls", "what a PIN can hold back", "/settings/parent"),
  e("Settings", "Parent PIN", "four digits", "/settings/parent-pin"),
  e("Settings", "Rules and terms", "every game, every word", "/rules"),
  e("Settings", "Account and data", "on this phone only", "/settings/account"),

  e("Errors", "Leave this match?", "A bot plays your seat for the rest of the match. You can come back while the room is live.", null),
  e("Errors", "Table paused", "The server is catching up. Every clock is frozen and restarts in full.", null),
  e("Errors", "Connection lost", "Your seat is kept. Play resumes at your next move.", null),
  e("Errors", "Cannot reach the table", "A bot is holding your seat. You can rejoin while the room is live.", null),
  e("Errors", "Server update", "Your game continues. The match ends after this round if the update changes the rules.", null),
  e("Errors", "Match interrupted", "A server update stopped the match. It counts as neither a win nor a loss.", null),
  e("Errors", "Update to join", "This table uses newer rules than your copy of TashZone. Update, then open the link again.", null),
  e("Errors", "This room is closed to new players", "Ask the host to unlock it, or join another room.", null),
  e("Errors", "Waiting for the host", "The host will see your request in the lobby.", null),
  e("Errors", "That code has expired", "Rooms close once they have been idle for a while.", null),
  e("Errors", "You cannot join this room", "", null),
  e("Errors", "The host removed you", "You cannot rejoin this room. Other rooms are unaffected.", null),
  e("Errors", "You are offline", "Offline games still work. Online rooms reconnect on their own.", null),
  e("Errors", "Rules changed", "This saved game was made under an older rule version. Start a new game to keep playing.", null),
  e("Errors", "Voice is turned off in Parent controls", "A parent can turn it back on with the PIN.", null),
  e("Errors", "Could not save your result", "It will be retried on its own. If it keeps failing, quote the code to support.", null),
];

export function atlasFor(group: AtlasGroup): AtlasEntry[] { return group === "All" ? ATLAS : ATLAS.filter((x) => x.group === group); }
