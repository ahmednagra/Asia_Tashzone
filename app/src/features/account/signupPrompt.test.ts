import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../../store/profileModel";
import { DEFAULT_PROMPT_CONFIG, type PromptInput, addPlayTime, afterCard, afterSheet, decidePrompt, promptConfigFrom } from "./signupPrompt";

const DAY = 86_400_000;
const base = (over: Partial<PromptInput> = {}): PromptInput => ({
  config: DEFAULT_PROMPT_CONFIG, signup: DEFAULT_PROFILE.signup, matches: 3, won: true, guest: true,
  protectedMode: false, canSignUp: true, sheetShownThisSession: false, now: 100 * DAY, ...over,
});

describe("decidePrompt", () => {
  it("asks after the 3rd finished game, on a win", () => {
    expect(decidePrompt(base({ matches: 2 }))).toBe("none");
    expect(decidePrompt(base({ matches: 3 }))).toBe("sheet");
  });

  it("waits for a win after a loss, but at most two more games", () => {
    expect(decidePrompt(base({ matches: 3, won: false }))).toBe("none");
    expect(decidePrompt(base({ matches: 4, won: false }))).toBe("none");
    expect(decidePrompt(base({ matches: 5, won: false }))).toBe("sheet");
  });

  it("asks after 10 minutes of play even before the 3rd game", () => {
    const signup = addPlayTime(DEFAULT_PROFILE.signup, 10 * 60_000);
    expect(decidePrompt(base({ matches: 1, signup }))).toBe("sheet");
    expect(decidePrompt(base({ matches: 1, signup: addPlayTime(DEFAULT_PROFILE.signup, 9 * 60_000) }))).toBe("none");
  });

  it("never asks children, account holders, or when sign-up is unavailable or switched off", () => {
    expect(decidePrompt(base({ protectedMode: true }))).toBe("none");
    expect(decidePrompt(base({ guest: false }))).toBe("none");
    expect(decidePrompt(base({ canSignUp: false }))).toBe("none");
    expect(decidePrompt(base({ config: { ...DEFAULT_PROMPT_CONFIG, enabled: false } }))).toBe("none");
  });

  it("shows at most one sheet per app session", () => {
    expect(decidePrompt(base({ sheetShownThisSession: true }))).toBe("none");
  });

  it("backs off further after each Not now: 3 games, then 10 games and 7 days", () => {
    const first = afterSheet(DEFAULT_PROFILE.signup, 3, 100 * DAY);
    expect(decidePrompt(base({ signup: first, matches: 5 }))).toBe("none");
    expect(decidePrompt(base({ signup: first, matches: 6 }))).toBe("sheet");
    const second = afterSheet(first, 6, 100 * DAY);
    expect(decidePrompt(base({ signup: second, matches: 16, now: 106 * DAY }))).toBe("none"); // 10 games, but not 7 days
    expect(decidePrompt(base({ signup: second, matches: 15, now: 108 * DAY }))).toBe("none"); // 7 days, but 9 games
    expect(decidePrompt(base({ signup: second, matches: 16, now: 107 * DAY }))).toBe("sheet");
  });

  it("switches to the result card after the last sheet, and the card can be retired or switched off", () => {
    let s = DEFAULT_PROFILE.signup;
    for (let i = 0; i < 3; i++) s = afterSheet(s, 3 + i * 20, 0);
    expect(decidePrompt(base({ signup: s, matches: 70, won: false }))).toBe("card");
    expect(decidePrompt(base({ signup: s, matches: 70, won: true }))).toBe("card");
    let viewed = s;
    for (let i = 0; i < 10; i++) viewed = afterCard(viewed, "view");
    expect(decidePrompt(base({ signup: viewed, matches: 70 }))).toBe("none");
    expect(decidePrompt(base({ signup: afterCard(viewed, "tap"), matches: 70 }))).toBe("card");
    expect(decidePrompt(base({ signup: afterCard(s, "off"), matches: 70 }))).toBe("none");
  });
});

describe("promptConfigFrom", () => {
  it("reads the server block and falls back per field", () => {
    expect(promptConfigFrom(null)).toEqual(DEFAULT_PROMPT_CONFIG);
    const c = promptConfigFrom({ enabled: false, first_after_games: 0, play_minutes: -1, max_sheets: 5, cooldown_games: ["x", 4], cooldown_days: [], card_max_views: 2.7 });
    expect(c).toEqual({ ...DEFAULT_PROMPT_CONFIG, enabled: false, firstAfterGames: 1, maxSheets: 5, cooldownGames: [4], cardMaxViews: 2 });
  });
});

describe("addPlayTime", () => {
  it("ignores negative slices and caps idle ones", () => {
    expect(addPlayTime(DEFAULT_PROFILE.signup, -5).playMs).toBe(0);
    expect(addPlayTime(DEFAULT_PROFILE.signup, 5 * 60 * 60_000).playMs).toBe(30 * 60_000);
  });
});
