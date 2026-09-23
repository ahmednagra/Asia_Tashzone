/** Court Piece and Bhabhi online (L10): full matches through the real server, journal replay, seat counts, handicap refusal. */
import { afterEach, describe, expect, it } from "vitest";
import { GENESIS, courtpiece, bhabhi, replayModule, stateHash, verifyChain } from "@tashzone/engine";
import { compile } from "@tashzone/engine";
import { Client, startServer, token } from "./test-harness.js";

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of cleanup) await c(); cleanup = []; });
async function boot() { const s = await startServer(); cleanup.push(() => s.server.close()); return s; }

async function playOnline(room: string, profile_id: string, settings: Record<string, number | boolean | string>, humans: number[]) {
  const s = await boot();
  const clients = humans.map((seat) => new Client(s.port, token(room, seat, { profile_id, settings })));
  for (const c of clients) { await c.connect(); await c.waitFor((m) => m.type === "TableSnapshot"); }
  clients[0]!.send({ type: "Start" });
  const end = await clients[0]!.waitFor((m) => m.type === "MatchEnded", 60000);
  return { ...s, clients, end };
}

async function replayJournal(journal: { records(room: string, hand: string): Promise<any[]> }, room: string, seals: any[]) {
  const all = [];
  for (const seal of seals) {
    const recs = await journal.records(room, seal.verification_record.hand_id);
    expect(verifyChain(recs, GENESIS)).toEqual({ ok: true, root: seal.verification_record.chain_root });
    all.push(...recs);
  }
  return all;
}

describe("Court Piece online", () => {
  it("two humans and two bots finish a match; every hand seals and the journal replays", async () => {
    const settings = { target_points: 2, variant: "double" };
    const { clients, end, journal, reports, started } = await playOnline("CPR001", "courtpiece.tz@1", settings, [0, 2]);
    expect(end.outcome).toBe("completed");
    expect(started).toEqual(["CPR001"]); // FastAPI is told once, so the room stops accepting joins
    expect(end.result.game).toBe("courtpiece");
    for (const c of clients) expect(c.seqs).toEqual(c.seqs.map((_, i) => i + 1));
    // the hidden stock never reaches a client
    for (const c of clients) for (const m of c.msgs) expect(JSON.stringify(m)).not.toMatch(/"stock":\[/);
    const seals = clients[0]!.msgs.filter((m) => m.type === "HandSealed");
    const all = await replayJournal(journal, "CPR001", seals);
    const rules = compile("courtpiece.tz@1", settings);
    if (!rules.ok) throw new Error();
    expect(stateHash(replayModule(courtpiece, rules.rules, all.map((x) => x.action)).state)).toBe(all[all.length - 1].state_hash);
    expect(reports[0]).toMatchObject({ outcome: "completed", bot_seats: [1, 3] });
    expect(reports[0]!.placements).toHaveLength(4);
  });
});

describe("Bhabhi online", () => {
  it("a 6-seat table (one human, five bots) finishes and replays", async () => {
    const settings = { players: 6, rounds: 1 };
    const { clients, end, journal, reports } = await playOnline("BHR001", "bhabhi.tz@1", settings, [0]);
    expect(end.outcome).toBe("completed");
    expect(end.result.placements).toHaveLength(6);
    const snap = clients[0]!.msgs.find((m) => m.type === "TableSnapshot");
    expect(snap.table_meta.seats).toHaveLength(6);
    const seals = clients[0]!.msgs.filter((m) => m.type === "HandSealed");
    const all = await replayJournal(journal, "BHR001", seals);
    const rules = compile("bhabhi.tz@1", settings);
    if (!rules.ok) throw new Error();
    expect(stateHash(replayModule(bhabhi, rules.rules, all.map((x) => x.action)).state)).toBe(all[all.length - 1].state_hash);
    expect(reports[0]!.bot_seats).toEqual([1, 2, 3, 4, 5]);
  });

  it("refuses a handicap room and a seat beyond the table size", async () => {
    const s = await boot();
    const h = new Client(s.port, token("BHR002", 0, { profile_id: "bhabhi.tz@1", settings: { players: 4, handicap: 3 } }));
    await h.connect();
    expect((await h.waitFor((m) => m.type === "Error")).code).toBe("UNAUTHORIZED");
    const ok = new Client(s.port, token("BHR003", 0, { profile_id: "bhabhi.tz@1", settings: { players: 3 } }));
    await ok.connect();
    await ok.waitFor((m) => m.type === "TableSnapshot");
    const far = new Client(s.port, token("BHR003", 5, { profile_id: "bhabhi.tz@1", settings: { players: 3 } }));
    await far.connect();
    expect((await far.waitFor((m) => m.type === "Error")).code).toBe("NOT_SEATED");
  });
});
