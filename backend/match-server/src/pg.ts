/**
 * PostgreSQL adapters (role tz_match). Every write is epoch-checked in the same transaction (C-20):
 * the room directory row is locked FOR SHARE and its epoch compared before the insert commits.
 * Schema: backend/api/alembic (FastAPI owns all migrations, C-26).
 */
import pg from "pg";
import type { InputRecord } from "@tashzone/engine";
import { type HandSealRecord, type JournalStore, type RoomDirectory, StaleEpochError } from "./stores.js";

export function makePool(url: string): pg.Pool { return new pg.Pool({ connectionString: url, max: 5 }); }

async function tx<T>(pool: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query("BEGIN"); const r = await fn(c); await c.query("COMMIT"); return r; }
  catch (e) { await c.query("ROLLBACK").catch(() => undefined); throw e; }
  finally { c.release(); }
}

async function checkEpoch(c: pg.PoolClient, room: string, epoch: number): Promise<void> {
  const r = await c.query("SELECT epoch FROM room_directory WHERE room_code = $1 AND lease_until > now() FOR SHARE", [room]);
  if (r.rowCount !== 1 || Number(r.rows[0].epoch) !== epoch) throw new StaleEpochError();
}

export class PgJournal implements JournalStore {
  constructor(private readonly pool: pg.Pool) {}
  persistHandStart(room: string, epoch: number, handId: string, commitment: string, encryptedSeed: string) {
    return tx(this.pool, async (c) => {
      await checkEpoch(c, room, epoch);
      await c.query(
        "INSERT INTO hands (hand_id, room_code, epoch, commitment, encrypted_seed, randomness_version) VALUES ($1,$2,$3,$4,$5,'tz-rng-v1')",
        [handId, room, epoch, commitment, encryptedSeed]);
    });
  }
  append(room: string, epoch: number, r: InputRecord) {
    return tx(this.pool, async (c) => {
      await checkEpoch(c, room, epoch);
      await c.query(
        `INSERT INTO input_records (hand_id, server_seq, epoch, intent_id, actor, origin, action, prev_hash, state_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [r.hand_id, r.server_seq, r.epoch, r.intent_id, String(r.actor), r.origin, JSON.stringify(r.action), r.prev_hash, r.state_hash]);
    });
  }
  seal(room: string, epoch: number, s: HandSealRecord) {
    return tx(this.pool, async (c) => {
      await checkEpoch(c, room, epoch);
      await c.query(
        `UPDATE hands SET encrypted_seed = NULL, server_seed = $2, client_seeds = $3, substituted = $4, chain_root = $5,
           result = $6, match_state_digest = $7, sealed_at = now() WHERE hand_id = $1`,
        [s.hand_id, s.server_seed, JSON.stringify(s.client_seeds), JSON.stringify(s.substituted), s.chain_root, JSON.stringify(s.result), s.match_state_digest]);
    });
  }
  async records(_room: string, handId: string): Promise<InputRecord[]> {
    const r = await this.pool.query("SELECT * FROM input_records WHERE hand_id = $1 ORDER BY server_seq", [handId]);
    return r.rows.map((x) => ({
      hand_id: x.hand_id, server_seq: Number(x.server_seq), epoch: Number(x.epoch), intent_id: x.intent_id,
      actor: x.actor === "system" ? "system" : Number(x.actor), origin: x.origin, action: x.action, prev_hash: x.prev_hash, state_hash: x.state_hash,
    }));
  }
}

export class PgDirectory implements RoomDirectory {
  constructor(private readonly pool: pg.Pool) {}
  async claim(room: string, instanceId: string, instanceUrl: string, leaseMs: number): Promise<number | null> {
    return tx(this.pool, async (c) => {
      const r = await c.query(
        `INSERT INTO room_directory (room_code, instance_id, instance_url, epoch, lease_until, heartbeat_at)
         VALUES ($1, $2, $3, nextval('room_epoch_seq'), now() + ($4 || ' milliseconds')::interval, now())
         ON CONFLICT (room_code) DO UPDATE SET instance_id = EXCLUDED.instance_id, instance_url = EXCLUDED.instance_url,
           epoch = nextval('room_epoch_seq'), lease_until = EXCLUDED.lease_until, heartbeat_at = now()
         WHERE room_directory.lease_until <= now() OR room_directory.instance_id = EXCLUDED.instance_id
         RETURNING epoch`, [room, instanceId, instanceUrl, String(leaseMs)]);
      return r.rowCount === 1 ? Number(r.rows[0].epoch) : null;
    });
  }
  async renew(room: string, epoch: number, leaseMs: number): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE room_directory SET lease_until = now() + ($3 || ' milliseconds')::interval, heartbeat_at = now()
       WHERE room_code = $1 AND epoch = $2 AND lease_until > now()`, [room, epoch, String(leaseMs)]);
    return r.rowCount === 1;
  }
  async release(room: string, epoch: number): Promise<void> {
    await this.pool.query("DELETE FROM room_directory WHERE room_code = $1 AND epoch = $2", [room, epoch]);
  }
  async currentEpoch(room: string): Promise<number | null> {
    const r = await this.pool.query("SELECT epoch FROM room_directory WHERE room_code = $1", [room]);
    return r.rowCount === 1 ? Number(r.rows[0].epoch) : null;
  }
}
