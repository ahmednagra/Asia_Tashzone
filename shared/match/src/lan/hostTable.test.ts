import { afterEach, describe, expect, it } from "vitest";
import { GENESIS, compile, deriveHandSeed, recordHash, replay, seedCommitment, sha256Hex, stateHash, verifyChain } from "@tashzone/engine";
import { MatchClient } from "../matchClient.js";
import type { MatchReport } from "../room/index.js";
import { hostSeat } from "./hostSeat.js";
import { HostTable, type HostTableOptions, MAX_WRONG_PINS } from "./hostTable.js";
import { lanGuest, lanJoinToken, memoryLink } from "./linkSocket.js";
import { isPrivateLanIpv4, parseTableQr, tableQrPayload } from "./qr.js";

const BUILD = "b".repeat(64);
const DIGEST = "d".repeat(64);
const PIN = "4821";
const compiled = (() => { const c = compile("callbreak.np@1", { rounds: 3 }); if (!c.ok) throw new Error("compile"); return c; })();

let counter = 0;
const randomHex = (bytes: number) => sha256Hex(`lan-test/${counter++}`).slice(0, bytes * 2); // deterministic stand-in for a CSPRNG
const tick = (ms = 2) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 30000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) { if (Date.now() > end) throw new Error("timeout"); await tick(); }
}

const cleanup: (() => void)[] = [];
afterEach(() => { for (const c of cleanup.splice(0)) c(); });

function makeTable(over: Partial<HostTableOptions> = {}) {
  const reports: MatchReport[] = [];
  const table = new HostTable({
    rules: compiled.rules, effectiveProfileHash: compiled.effective_profile_hash, engineBuildHash: BUILD, behaviourDigest: DIGEST,
    pin: PIN, randomHex, roomCode: "LAN001", hostName: "Host",
    timing: { seedWaitMs: 40, botDelayMs: 0, interHandMs: 5, turnMsOverride: 2000, windowMsOverride: 20 },
    results: async (r) => { reports.push(r); },
    ...over,
  });
  cleanup.push(() => table.close());
  return { table, reports };
}

/** A real MatchClient, playing the first legal move it is offered. */
function player(conn: { url: string; joinToken: string; socket: (url: string) => any }, autoPlay = true) {
  const msgs: any[] = [];
  const state = { ended: null as any, viewSeqs: [] as number[] };
  const client: MatchClient = new MatchClient({
    ...conn, engineBuildHash: BUILD, behaviourDigest: DIGEST, versionCode: 1, randomSeed: () => randomHex(32), backoffMs: () => 5,
    onMessage: (m) => {
      msgs.push(m);
      if (m.type === "ViewEvents") state.viewSeqs.push(m.from_seq);
      if (m.type === "MatchEnded") state.ended = m;
      const v = client.state.view;
      if (autoPlay && (m.type === "ViewEvents" || m.type === "TableSnapshot") && v?.legal?.length) {
        const mv = v.legal.find((x: { t: string }) => x.t !== "RequestRedeal" && x.t !== "Take");
        if (mv) client.intent(mv);
      }
    },
  });
  cleanup.push(() => client.leave());
  client.connect();
  return { client, msgs, state, you: () => msgs.filter((m) => m.type === "TableSnapshot").at(-1)?.table_meta?.you as number | undefined };
}

const guestConn = (table: HostTable, name = "Ali", pin = PIN) => lanGuest(memoryLink((l) => table.accept(l)), { pin, name });

/** A bare link that speaks raw frames, to look at exactly what the host sends back. */
function raw(table: HostTable, joinToken: string, hello: Record<string, unknown> = {}) {
  const msgs: any[] = [];
  let closed = false;
  const link = memoryLink((l) => table.accept(l))({ onText: (t) => msgs.push(JSON.parse(t)), onClose: () => { closed = true; } });
  link.send(JSON.stringify({
    type: "Hello", protocol_min: 2, protocol_max: 2, version_code: 1, engine_build_hash: BUILD, behaviour_digest: DIGEST,
    correlation_id: "c1", join_token: joinToken, ...hello,
  }));
  return { msgs, isClosed: () => closed, send: (m: unknown) => link.send(JSON.stringify(m)), link };
}
const seatedFrame = (r: { msgs: any[] }) => r.msgs.find((m) => m.type === "LanSeated");

describe("LAN table: a full match", () => {
  it("host + 1 guest + 2 bots play to the end; commitments verify and the journal replays", async () => {
    const { table, reports } = makeTable();
    const guest = player(guestConn(table));
    await until(() => guest.msgs.some((m) => m.type === "TableSnapshot"));
    const host = player(hostSeat(table));
    await until(() => host.msgs.some((m) => m.type === "TableSnapshot"));
    expect(guest.you()).toBe(1);
    expect(host.you()).toBe(0);
    host.client.start();
    await until(() => host.state.ended !== null && guest.state.ended !== null, 90000);
    expect(host.state.ended.outcome).toBe("completed");
    expect(guest.state.ended.outcome).toBe("completed");
    for (const p of [host, guest]) expect(p.state.viewSeqs).toEqual(p.state.viewSeqs.map((_, i) => i + 1)); // gap-free

    const seals = host.msgs.filter((m) => m.type === "HandSealed");
    expect(seals.length).toBeGreaterThanOrEqual(3);
    for (const s of seals) {
      const v = s.verification_record;
      expect(seedCommitment(v.server_seed, v.hand_id)).toBe(v.commitment);
      const recs = await table.journal.records(table.code, v.hand_id);
      const begin = recs[0]!.action as { hand_seed: string };
      expect(deriveHandSeed(v.server_seed, v.hand_id, v.client_seeds)).toBe(begin.hand_seed);
      expect(v.substituted).toEqual([2, 3]); // the two bots' client seeds are substituted and flagged
      expect(verifyChain(recs, GENESIS)).toEqual({ ok: true, root: v.chain_root });
    }
    const all = (await Promise.all(seals.map((s) => table.journal.records(table.code, s.verification_record.hand_id)))).flat();
    const r = replay(compiled.rules, all.map((x) => x.action as never));
    expect(stateHash(r.state)).toBe(all[all.length - 1]!.state_hash);
    expect(recordHash(all[all.length - 1]!)).toBe(seals.at(-1)!.verification_record.chain_root);

    await until(() => reports.length === 1);
    expect(reports[0]).toMatchObject({ outcome: "completed", bot_seats: [2, 3], room: "LAN001" });
    expect(reports[0]!.players[0]).toBe("host");
    expect(reports[0]!.players[1]).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("LAN table: admission", () => {
  it("a wrong PIN is refused with a bare UNAUTHORIZED, identical whether the table is empty or full", async () => {
    const empty = makeTable().table;
    const a = raw(empty, lanJoinToken("0000", null, "Mallory"));
    await until(() => a.isClosed());
    expect(a.msgs).toEqual([{ type: "Error", code: "UNAUTHORIZED" }]);

    const { table: full } = makeTable();
    for (const n of ["A", "B", "C"]) { const g = raw(full, lanJoinToken(PIN, null, n)); await until(() => g.msgs.some((m) => m.type === "TableSnapshot")); }
    const b = raw(full, lanJoinToken("0000", null, "Mallory"));
    await until(() => b.isClosed());
    expect(b.msgs).toEqual(a.msgs); // no seat, roster, room code or full-table hint leaks
    // garbage join tokens get the same answer
    const c = raw(full, "not-a-lan-token-at-all");
    await until(() => c.isClosed());
    expect(c.msgs).toEqual(a.msgs);
  });

  it("locks the table after MAX_WRONG_PINS wrong PINs, even for the right PIN, but not a seated guest", async () => {
    const { table } = makeTable();
    const guest = player(guestConn(table));
    await until(() => guest.msgs.some((m) => m.type === "TableSnapshot"));
    for (let i = 0; i < MAX_WRONG_PINS; i++) {
      const w = raw(table, lanJoinToken("1111", null, "x"));
      await until(() => w.isClosed());
      expect(w.msgs[0]).toEqual({ type: "Error", code: "UNAUTHORIZED" });
    }
    expect(table.wrongPinCount).toBe(MAX_WRONG_PINS);
    const right = raw(table, lanJoinToken(PIN, null, "Late"));
    await until(() => right.isClosed());
    expect(right.msgs).toEqual([{ type: "Error", code: "UNAUTHORIZED" }]);
    expect(table.roster().filter((s) => s.kind === "human" && !s.host)).toHaveLength(1);
    // the seated guest reconnects by token regardless
    const before = guest.msgs.length;
    guest.client.dropTransport();
    await until(() => guest.msgs.slice(before).some((m) => m.type === "TableSnapshot"));
    expect(guest.you()).toBe(1);
  });

  it("a dropped guest reclaims the same seat with its token; a forged token does not", async () => {
    const { table } = makeTable();
    const other = raw(table, lanJoinToken(PIN, null, "Zed"));
    await until(() => seatedFrame(other));
    expect(seatedFrame(other).seat).toBe(1);
    const guest = player(guestConn(table, "Bea"));
    await until(() => guest.msgs.some((m) => m.type === "TableSnapshot"));
    expect(guest.you()).toBe(2);
    expect(table.roster()[2]!.name).toBe("Bea");

    const before = guest.msgs.length;
    guest.client.dropTransport();
    await until(() => table.roster()[2]!.online === false);
    await until(() => guest.msgs.slice(before).some((m) => m.type === "TableSnapshot"));
    expect(guest.you()).toBe(2);
    expect(table.roster()[2]!).toMatchObject({ name: "Bea", online: true });

    // seat 1's token cannot be used to sit at seat 1 from another phone without the secret half
    const token = seatedFrame(other).resume_token as string;
    const forged = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    const f = raw(table, lanJoinToken("0000", forged, "Eve"));
    await until(() => f.isClosed());
    expect(f.msgs).toEqual([{ type: "Error", code: "UNAUTHORIZED" }]);
    expect(table.wrongPinCount).toBe(1);
    // the genuine token resumes seat 1 (the earlier link is superseded)
    const back = raw(table, lanJoinToken("0000", token, "Zed"));
    await until(() => back.msgs.some((m) => m.type === "TableSnapshot"));
    expect(back.msgs.find((m) => m.type === "TableSnapshot").table_meta.you).toBe(1);
  });

  it("a guest that leaves gives up the seat and its token stops working", async () => {
    const { table } = makeTable();
    const g = raw(table, lanJoinToken(PIN, null, "Kim"));
    await until(() => seatedFrame(g));
    const token = seatedFrame(g).resume_token as string;
    g.send({ type: "Leave" });
    await until(() => g.isClosed());
    expect(table.roster()[1]!).toMatchObject({ kind: "bot", online: false });
    const again = raw(table, lanJoinToken("0000", token, "Kim"));
    await until(() => again.isClosed());
    expect(again.msgs).toEqual([{ type: "Error", code: "UNAUTHORIZED" }]);
  });

  it("only the host can start", async () => {
    const { table } = makeTable();
    const g = raw(table, lanJoinToken(PIN, null, "Guest"));
    await until(() => g.msgs.some((m) => m.type === "TableSnapshot"));
    g.send({ type: "Start" });
    await until(() => g.msgs.some((m) => m.type === "Error"));
    expect(g.msgs.find((m) => m.type === "Error")).toEqual({ type: "Error", code: "NOT_SEATED" });
    expect(table.started).toBe(false);
    const host = player(hostSeat(table), false);
    await until(() => host.msgs.some((m) => m.type === "TableSnapshot"));
    host.client.start();
    await until(() => table.started);
    expect(table.room.status).toBe("playing");
  });

  it("rejects a fourth guest at a 4-seat table and any newcomer once play has begun", async () => {
    const { table } = makeTable();
    const seats: number[] = [];
    for (const n of ["A", "B", "C"]) {
      const g = raw(table, lanJoinToken(PIN, null, n));
      await until(() => seatedFrame(g));
      seats.push(seatedFrame(g).seat);
    }
    expect(seats).toEqual([1, 2, 3]);
    const fourth = raw(table, lanJoinToken(PIN, null, "D"));
    await until(() => fourth.isClosed());
    expect(fourth.msgs).toEqual([{ type: "Error", code: "ROOM_LOCKED" }]);

    const { table: t2 } = makeTable();
    const host = player(hostSeat(t2), false);
    await until(() => host.msgs.some((m) => m.type === "TableSnapshot"));
    host.client.start();
    await until(() => t2.started);
    const late = raw(t2, lanJoinToken(PIN, null, "Late"));
    await until(() => late.isClosed());
    expect(late.msgs).toEqual([{ type: "Error", code: "ROOM_LOCKED" }]);
  });

  it("refuses a guest on another engine build or behaviour digest without seating it", async () => {
    const { table } = makeTable();
    const a = raw(table, lanJoinToken(PIN, null, "Old"), { behaviour_digest: "e".repeat(64) });
    await until(() => a.isClosed());
    expect(a.msgs).toEqual([{ type: "Error", code: "UPDATE_REQUIRED" }]);
    expect(table.roster().every((s) => s.kind === "bot" || s.host)).toBe(true);
  });

  it("refuses a first message that is not Hello and malformed frames", async () => {
    const { table } = makeTable();
    const a = raw(table, lanJoinToken(PIN, null, "x"));
    await until(() => a.msgs.some((m) => m.type === "TableSnapshot"));
    a.link.send("{not json");
    await until(() => a.isClosed());
    expect(a.msgs.at(-1)).toEqual({ type: "Error", code: "BAD_FRAME" });
    let closed = false;
    const b = memoryLink((l) => table.accept(l))({ onText: () => undefined, onClose: () => { closed = true; } });
    b.send(JSON.stringify({ type: "Start" }));
    await until(() => closed);
  });

  it("drops a connection that never says hello", async () => {
    const { table } = makeTable({ helloTimeoutMs: 20 });
    let closed = false;
    memoryLink((l) => table.accept(l))({ onText: () => undefined, onClose: () => { closed = true; } });
    await until(() => closed);
  });

  it("the host can kick a guest and close the table", async () => {
    const { table } = makeTable();
    const g = raw(table, lanJoinToken(PIN, null, "Kim"));
    await until(() => seatedFrame(g));
    table.kick(1);
    await until(() => g.isClosed());
    expect(table.roster()[1]!.kind).toBe("bot");
    const h = player(hostSeat(table), false);
    await until(() => h.msgs.some((m) => m.type === "TableSnapshot"));
    table.close();
    await until(() => h.client.state.status === "reconnecting" || h.client.state.status === "closed");
    const late = raw(table, lanJoinToken(PIN, null, "x"));
    await until(() => late.isClosed());
  });
});

describe("table QR", () => {
  it("round-trips host, port and pin", () => {
    const q = tableQrPayload("192.168.1.23", 41234, "0042");
    expect(q).toBe("tashzone://wifi?h=192.168.1.23&p=41234&k=0042");
    expect(parseTableQr(q)).toEqual({ host: "192.168.1.23", port: 41234, pin: "0042" });
    expect(parseTableQr(`  ${q}\n`)).not.toBeNull();
    for (const h of ["10.0.0.5", "172.16.0.1", "172.31.255.254", "169.254.10.20", "192.168.0.1"]) expect(parseTableQr(tableQrPayload(h, 5000, "1234"))?.host).toBe(h);
  });
  it("refuses public, malformed and ambiguous hosts, bad ports and bad PINs", () => {
    const bad = [
      "tashzone://wifi?h=8.8.8.8&p=5000&k=1234", "tashzone://wifi?h=172.32.0.1&p=5000&k=1234", "tashzone://wifi?h=172.15.0.1&p=5000&k=1234",
      "tashzone://wifi?h=100.64.0.1&p=5000&k=1234", "tashzone://wifi?h=192.169.0.1&p=5000&k=1234", "tashzone://wifi?h=169.253.0.1&p=5000&k=1234",
      "tashzone://wifi?h=192.168.1.256&p=5000&k=1234", "tashzone://wifi?h=192.168.001.5&p=5000&k=1234", "tashzone://wifi?h=192.168.1&p=5000&k=1234",
      "tashzone://wifi?h=example.com&p=5000&k=1234", "tashzone://wifi?h=%31%39%32.168.1.1&p=5000&k=1234", "tashzone://wifi?h=192.168.1.1&p=80&k=1234",
      "tashzone://wifi?h=192.168.1.1&p=70000&k=1234", "tashzone://wifi?h=192.168.1.1&p=5000&k=123", "tashzone://wifi?h=192.168.1.1&p=5000&k=12345",
      "http://wifi?h=192.168.1.1&p=5000&k=1234", "tashzone://wifi?h=192.168.1.1&p=5000&k=1234&x=1", "",
    ];
    for (const q of bad) expect(parseTableQr(q), q).toBeNull();
    expect(isPrivateLanIpv4("::1")).toBe(false);
    expect(() => tableQrPayload("8.8.8.8", 5000, "1234")).toThrow();
    expect(() => tableQrPayload("10.0.0.1", 80, "1234")).toThrow();
    expect(() => tableQrPayload("10.0.0.1", 5000, "12")).toThrow();
  });
  it("the host table builds a code its guests accept", () => {
    const { table } = makeTable();
    expect(parseTableQr(table.qrPayload("192.168.43.1", 38001))).toEqual({ host: "192.168.43.1", port: 38001, pin: PIN });
  });
});
