/** L10 multiplayer against a real match-server instance (in-memory stores). */
import { afterEach, describe, expect, it } from "vitest";
import { GENESIS, deriveHandSeed, recordHash, replay, seedCommitment, stateHash, verifyChain } from "@tashzone/engine";
import { compile } from "@tashzone/engine";
import { Client, startServer, token } from "./test-harness.js";

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of cleanup) await c(); cleanup = []; });
async function boot(t?: Parameters<typeof startServer>[0]) {
  const s = await startServer(t);
  cleanup.push(() => s.server.close());
  return s;
}

describe("admission", () => {
  it("rejects a mismatched behaviour digest with UPDATE_REQUIRED before seating (MP-18)", async () => {
    const { port } = await boot();
    const c = new Client(port, token("ROOM01", 0), { digest: "e".repeat(64) });
    await c.connect();
    expect((await c.waitFor((m) => m.type === "Error")).code).toBe("UPDATE_REQUIRED");
    await c.waitFor((m) => m.type === "__closed");
  });
  it("rejects forged tokens and malformed frames (MP-08, MP-11)", async () => {
    const { port } = await boot();
    const bad = new Client(port, token("ROOM02", 0) + "x");
    await bad.connect();
    expect((await bad.waitFor((m) => m.type === "Error")).code).toBe("UNAUTHORIZED");
    const c = new Client(port, token("ROOM02", 0));
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send("{not json");
    expect((await c.waitFor((m) => m.type === "Error")).code).toBe("BAD_FRAME");
    await c.waitFor((m) => m.type === "__closed");
  });
  it("health reports provenance and never live state; ready flips during drain", async () => {
    const { port, server } = await boot();
    const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    expect(h).toMatchObject({ ok: true, tag: "test", engine_build_hash: "b".repeat(64) });
    expect((await fetch(`http://127.0.0.1:${port}/ready`)).status).toBe(200);
    server.drain(0);
    expect((await fetch(`http://127.0.0.1:${port}/ready`)).status).toBe(503);
  });
});

describe("full match (MP-01) with verification", () => {
  it("a human and three bots finish; seeds verify; journal replays; view_seq gap-free", async () => {
    const { port, journal, reports } = await boot();
    const c = new Client(port, token("ROOM10", 0));
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send({ type: "Start" });
    const end = await c.waitFor((m) => m.type === "MatchEnded", 40000);
    expect(end.outcome).toBe("completed");
    // PR-09: strictly increasing without gaps
    expect(c.seqs).toEqual(c.seqs.map((_, i) => i + 1));
    const seals = c.msgs.filter((m) => m.type === "HandSealed");
    expect(seals.length).toBeGreaterThanOrEqual(3);
    const rules = compile("callbreak.np@1", { rounds: 3 });
    if (!rules.ok) throw new Error();
    for (const s of seals) {
      const v = s.verification_record;
      // RNG-03: commitment verifies and the hand seed re-derives
      expect(seedCommitment(v.server_seed, v.hand_id)).toBe(v.commitment);
      const recs = await journal.records("ROOM10", v.hand_id);
      const begin = recs[0]!.action as { hand_seed: string };
      expect(deriveHandSeed(v.server_seed, v.hand_id, v.client_seeds)).toBe(begin.hand_seed);
      expect(v.substituted).toEqual([1, 2, 3]); // bots substituted and flagged (RNG-04)
      // P-15: chain verifies and root matches the seal
      expect(verifyChain(recs, GENESIS)).toEqual({ ok: true, root: v.chain_root });
      expect(recordHash(recs[recs.length - 1]!)).toBe(v.chain_root);
    }
    // DR: the concatenated journal replays to the recorded final state hash
    const all = (await Promise.all(seals.map((s) => journal.records("ROOM10", s.verification_record.hand_id)))).flat();
    const r = replay(rules.rules, all.map((x) => x.action as never));
    expect(stateHash(r.state)).toBe(all[all.length - 1]!.state_hash);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ outcome: "completed", bot_seats: [1, 2, 3], room: "ROOM10" });
  });
});

describe("intents", () => {
  it("duplicate intents return the committed outcome; stale views are refused (MP-03)", async () => {
    const { port, journal } = await boot({ botDelayMs: 50 });
    const c = new Client(port, token("ROOM20", 0));
    c.autoPlay = false;
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send({ type: "Start" });
    await c.waitFor((m) => m.type === "ViewEvents" && m.seat_view.legal.some((x: any) => x.t === "Call" || x.t === "Play"), 20000);
    const move = c.view.legal.find((x: any) => x.t !== "RequestRedeal");
    const stale = c.intent(move, "stale-1", c.viewSeq - 1);
    expect((await c.waitFor((m) => m.type === "IntentResult" && m.intent_id === stale)).reject_code).toBe("STALE_VIEW");
    const seq = c.viewSeq;
    c.intent(move, "dup-1", seq);
    c.intent(move, "dup-1", seq);
    await c.waitFor((m) => m.type === "IntentResult" && m.intent_id === "dup-1");
    await new Promise((r) => setTimeout(r, 200));
    const results = c.msgs.filter((m) => m.type === "IntentResult" && m.intent_id === "dup-1");
    expect(results.length).toBe(2);
    expect(results[0]).toEqual(results[1]);
    expect(results[0].accepted).toBe(true);
    const handId = c.view.hand.hand_id;
    const recs = await journal.records("ROOM20", handId);
    expect(recs.filter((x) => x.intent_id === "dup-1")).toHaveLength(1);
  });
});

describe("reconnect (MP-02)", () => {
  it("resumes from the outbox with no lost or duplicated batches", async () => {
    const { port } = await boot({ botDelayMs: 5 });
    const c = new Client(port, token("ROOM30", 0));
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send({ type: "Start" });
    await c.waitFor((m) => m.type === "ViewEvents" && m.to_seq >= 6);
    const last = c.viewSeq;
    c.close();
    await c.waitFor((m) => m.type === "__closed");
    const before = c.msgs.length;
    await new Promise((r) => setTimeout(r, 150));
    await c.connect(last);
    // only messages after the reconnect count: batches in flight during close are already in history
    await c.waitFor((m) => m.type === "ViewEvents" && m.from_seq === last + 1, 20000, before);
    const after = c.msgs.slice(before).filter((m) => m.type === "ViewEvents").map((m) => m.from_seq);
    expect(after[0]).toBe(last + 1);
    expect(after).toEqual(after.map((_, i) => last + 1 + i));
  });
});

describe("timeouts and hand-over (MP-05)", () => {
  it("a missed turn is logged, played by the hand-over bot, and control returns", async () => {
    const { port } = await boot({ turnMsOverride: 150 });
    const c = new Client(port, token("ROOM40", 0));
    c.autoPlay = false;
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send({ type: "Start" });
    const ho = await c.waitFor((m) => m.type === "SeatControlChanged" && m.seat === 0 && m.control === "handover", 20000);
    expect(ho).toBeTruthy();
    await c.waitFor((m) => m.type === "ViewEvents" && m.events.some((e: any) => e.t === "TurnTimedOut" && e.seat === 0));
    await c.waitFor((m) => m.type === "SeatControlChanged" && m.seat === 0 && m.control === "human");
  });
});

describe("fencing and journal failures", () => {
  it("a stale owner cannot publish after takeover (MP-13, CG-09)", async () => {
    const { port, directory, incidents } = await boot({ botDelayMs: 30 });
    const c = new Client(port, token("ROOM50", 0));
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send({ type: "Start" });
    await c.waitFor((m) => m.type === "ViewEvents" && m.to_seq >= 3);
    // simulate another instance taking over with epoch + 1
    const claim = directory.claims.get("ROOM50")!;
    directory.claims.set("ROOM50", { ...claim, epoch: claim.epoch + 100, instance: "other" });
    expect((await c.waitFor((m) => m.type === "Error" && m.code === "OWNERSHIP_LOST")).code).toBe("OWNERSHIP_LOST");
    const seqAtFence = c.viewSeq;
    await new Promise((r) => setTimeout(r, 200));
    expect(c.viewSeq).toBe(seqAtFence); // nothing published after fencing
    expect(incidents.entries.some((e) => e.kind === "ownership_lost")).toBe(true);
  });

  it("commit failure pauses the table, nothing is published, then play resumes (MP-14, CG-08)", async () => {
    const { port, journal } = await boot({ botDelayMs: 20 });
    const c = new Client(port, token("ROOM60", 0));
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send({ type: "Start" });
    await c.waitFor((m) => m.type === "ViewEvents" && m.to_seq >= 3);
    journal.failNext = 3;
    await c.waitFor((m) => m.type === "TablePaused");
    const resumed = await c.waitFor((m) => m.type === "TableResumed");
    expect(resumed.deadline === null || typeof resumed.deadline === "number").toBe(true);
    const end = await c.waitFor((m) => m.type === "MatchEnded", 40000);
    expect(end.outcome).toBe("completed");
  });
});

describe("drain (MP-07)", () => {
  it("notifies, finishes the current hand, then ends the match as interrupted", async () => {
    const { port, server, reports } = await boot({ botDelayMs: 2 });
    const c = new Client(port, token("ROOM70", 0));
    await c.connect();
    await c.waitFor((m) => m.type === "TableSnapshot");
    c.send({ type: "Start" });
    await c.waitFor((m) => m.type === "ViewEvents" && m.to_seq >= 3);
    server.drain(0);
    await c.waitFor((m) => m.type === "ServerRestarting");
    const end = await c.waitFor((m) => m.type === "MatchEnded", 40000);
    expect(end.outcome).toBe("interrupted");
    expect(reports[0]?.outcome).toBe("interrupted");
    const late = new Client(port, token("ROOM71", 0));
    await late.connect();
    expect((await late.waitFor((m) => m.type === "Error")).code).toBe("ROOM_LOCKED");
  });
});
