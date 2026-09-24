import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../../store/profileModel";
import type { MeView, ProgressView } from "../../types/api";
import { fromServer, progressKey, toProgress } from "./progressSync";

describe("progress sync", () => {
  it("never sends a record the server would refuse as inconsistent", () => {
    for (const stats of [
      { matches: 10, wins: 4, streak: 2, bhabhi: 3 },
      { matches: 2, wins: 5, streak: 9, bhabhi: 0 },
      { matches: 0, wins: 0, streak: 0, bhabhi: 0 },
    ]) {
      const b = toProgress(stats);
      expect(b.wins).toBeLessThanOrEqual(b.matches);
      expect(b.best_streak).toBeLessThanOrEqual(b.wins);
      expect(b.first_out + b.times_bhabhi).toBeLessThanOrEqual(b.hands_played);
      expect(b.xp).toBe(0);
    }
  });

  it("takes the account's name, avatar and record and starts a new streak", () => {
    const me = { display_name: "Asha", avatar_id: 3 } as MeView;
    const progress = { matches: 12, wins: 7, times_bhabhi: 2, best_streak: 4 } as ProgressView;
    const p = fromServer(me, progress, { ...DEFAULT_PROFILE, lang: "ur", stats: { matches: 1, wins: 1, streak: 1, bhabhi: 0 } });
    expect(p).toMatchObject({ name: "Asha", avatar: 3, lang: "ur", onboarded: true, stats: { matches: 12, wins: 7, streak: 0, bhabhi: 2 } });
  });

  it("only re-syncs when the name, avatar or record changes", () => {
    const a = { ...DEFAULT_PROFILE, name: "Asha" };
    expect(progressKey(a)).toBe(progressKey({ ...a, sound: { ...a.sound, master: false } }));
    expect(progressKey(a)).not.toBe(progressKey({ ...a, stats: { ...a.stats, matches: 1 } }));
  });
});
