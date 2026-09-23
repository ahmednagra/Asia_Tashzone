import { describe, expect, it } from "vitest";
import { type SeatMove, chooseMove, compile, sha256Hex } from "@tashzone/engine";
import { LocalTable } from "./localTable.js";

const rules = (() => { const c = compile("callbreak.np@1", { rounds: 3 }); if (!c.ok) throw new Error(); return c.rules; })();
const immediate = (fn: () => void) => { queueMicrotask(fn); return () => undefined; };
let n = 0;
const seed = () => sha256Hex(`local/${n++}`);
const tick = () => new Promise((r) => setTimeout(r, 0));


describe("offline LocalTable", () => {
  it("plays a full match against bots through the engine", async () => {
    const t = new LocalTable(rules, { randomSeed: seed, schedule: immediate });
    t.subscribe((v) => {
      if (v.legal.length === 0) return;
      const m = chooseMove(t.module, v, "medium", "h") ?? (v.legal[0]!.t === "RequestRedeal" ? null : v.legal[0]!);
      if (m) queueMicrotask(() => t.play(m));
    });
    t.start();
    for (let i = 0; i < 2000 && !t.state.match.over; i++) await tick();
    expect(t.state.match.over).toBe(true);
    expect(t.state.match.history).toHaveLength(3);
  });
  it("undo returns to before the human's last move; hint is always legal", async () => {
    const t = new LocalTable(rules, { randomSeed: seed, schedule: immediate });
    t.start();
    for (let i = 0; i < 50 && !t.view().legal.some((m: SeatMove) => m.t === "Call"); i++) await tick();
    const v = t.view();
    const hint = t.hint()!;
    expect(v.legal).toContainEqual(hint);
    const before = JSON.stringify(t.state);
    expect(t.play(hint)).toBe(true);
    expect(t.canUndo()).toBe(true);
    t.undo();
    expect(JSON.stringify(t.state)).toBe(before);
    expect(t.play({ t: "Call", n: 99 })).toBe(false);
  });
});

const compiled = (id: string, settings: Record<string, unknown>) => { const c = compile(id, settings); if (!c.ok) throw new Error(c.error); return c.rules; };

async function playOut(t: LocalTable, level: "easy" | "medium" = "medium") {
  t.subscribe((v) => {
    const moves = v.legal.filter((m: { t: string }) => m.t !== "Take" && m.t !== "RequestRedeal");
    if (moves.length === 0) return;
    const m = chooseMove(t.module, v, level, "human") ?? moves[0];
    queueMicrotask(() => t.play(m));
  });
  t.start();
  for (let i = 0; i < 20000 && !t.module.summary(t.state).over; i++) await tick();
}

describe("offline LocalTable — every game", () => {
  it("Court Piece: the human chooses trump when calling and finishes a match against Easy bots", async () => {
    const t = new LocalTable(compiled("courtpiece.tz@1", { target_points: 2 }), { randomSeed: seed, schedule: immediate, botLevel: "easy", humanSeat: 1 }); // seat 1 calls first (dealer 0)
    let sawTrump = false;
    t.subscribe((v) => { if (v.legal.some((m: { t: string }) => m.t === "ChooseTrump")) sawTrump = true; });
    await playOut(t);
    expect(t.module.summary(t.state).over).toBe(true);
    expect(sawTrump).toBe(true);
  });
  it("Bhabhi with 7 players and two decks finishes against Medium bots", async () => {
    const t = new LocalTable(compiled("bhabhi.tz@1", { players: 7, rounds: 1 }), { randomSeed: seed, schedule: immediate, botLevel: "medium" });
    expect(t.seats).toBe(7);
    await playOut(t);
    expect(t.module.summary(t.state).over).toBe(true);
    expect(t.module.summary(t.state).placements).toHaveLength(7);
  });
  it("Hard bots think in slices through the async driver and finish a Callbreak hand", async () => {
    let clock = 0;
    const t = new LocalTable(compiled("callbreak.np@1", { rounds: 3 }), {
      randomSeed: seed, schedule: immediate, botLevel: "hard",
      asyncBots: { now: () => (clock += 3), yieldToHost: () => new Promise((r) => setTimeout(r, 0)), maxMs: 60, sliceMs: 6 },
    });
    t.subscribe(() => undefined);
    t.start();
    for (let i = 0; i < 20000 && (t.state.match?.hands_played ?? 0) < 1; i++) {
      const v = t.view();
      const moves = v.legal.filter((m: { t: string }) => m.t !== "RequestRedeal");
      if (moves.length) t.play(chooseMove(t.module, v, "medium", "h") ?? moves[0]);
      await tick();
    }
    expect(t.state.match.hands_played).toBeGreaterThanOrEqual(1);
  });
  it("explains a refused move from the human's view", async () => {
    const t = new LocalTable(compiled("bhabhi.tz@1", { players: 4 }), { randomSeed: seed, schedule: immediate });
    t.start();
    for (let i = 0; i < 20 && !t.view().hand; i++) await tick();
    const v = t.view();
    const card = v.hand.my_hand.find((c: string) => !v.legal.some((m: { card?: string }) => m.card === c));
    if (card) {
      expect(t.play({ t: "Play", card })).toBe(false);
      expect(t.explain({ t: "Play", card })).not.toBeNull();
    }
  });
});
