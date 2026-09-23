/** PostgreSQL adapters as role tz_match against the Alembic schema. Runs when TZ_TEST_PG_URL is set. */
import { afterAll, describe, expect, it } from "vitest";
import { GENESIS, recordHash, type InputRecord } from "@tashzone/engine";
import { PgDirectory, PgJournal, makePool } from "./pg.js";
import { StaleEpochError } from "./stores.js";

const url = process.env.TZ_TEST_PG_URL;
const d = url ? describe : describe.skip;

d("PostgreSQL journal and directory (C-20, §3)", () => {
  const pool = makePool(url ?? "postgres://invalid");
  const dir = new PgDirectory(pool);
  const journal = new PgJournal(pool);
  const room = "PG" + String(Date.now() % 10000).padStart(4, "0");
  afterAll(async () => { await pool.end(); });

  it("claims with increasing epochs, refuses a live foreign claim, renews and releases", async () => {
    const e1 = await dir.claim(room, "a", "http://a", 5000);
    expect(e1).toBeGreaterThan(0);
    expect(await dir.claim(room, "b", "http://b", 5000)).toBeNull();
    expect(await dir.renew(room, e1!, 5000)).toBe(true);
    expect(await dir.renew(room, e1! + 999, 5000)).toBe(false);
    const e2 = await dir.claim(room, "a", "http://a", 5000); // same instance re-claim bumps epoch
    expect(e2!).toBeGreaterThan(e1!);
  });

  it("journals seed-first, appends epoch-checked records, fences stale owners, seals", async () => {
    const epoch = (await dir.currentEpoch(room))!;
    const hand = `${room}-h1`;
    await journal.persistHandStart(room, epoch, hand, "c".repeat(64), "encrypted");
    const r1: InputRecord = { hand_id: hand, server_seq: 1, epoch, intent_id: null, actor: "system", origin: "system", action: { t: "BeginHand" }, prev_hash: GENESIS, state_hash: "a".repeat(64) };
    const r2: InputRecord = { hand_id: hand, server_seq: 2, epoch, intent_id: "i1", actor: 0, origin: "human", action: { t: "Call", n: 3 }, prev_hash: recordHash(r1), state_hash: "b".repeat(64) };
    await journal.append(room, epoch, r1);
    await journal.append(room, epoch, r2);
    await expect(journal.append(room, epoch, { ...r2, server_seq: 3 })).rejects.toThrow(); // duplicate intent (unique)
    await expect(journal.append(room, epoch - 1, { ...r2, server_seq: 4, intent_id: "i2" })).rejects.toBeInstanceOf(StaleEpochError);
    const recs = await journal.records(room, hand);
    expect(recs.map((r) => r.server_seq)).toEqual([1, 2]);
    expect(recs[1]).toEqual(r2);
    await journal.seal(room, epoch, { hand_id: hand, server_seed: "d".repeat(64), client_seeds: [], substituted: [0], commitment: "c".repeat(64), chain_root: recordHash(r2), result: {}, match_state_digest: "e".repeat(64) });
    await dir.release(room, epoch);
    expect(await dir.currentEpoch(room)).toBeNull();
  });
});
