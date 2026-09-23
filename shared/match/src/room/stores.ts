/**
 * Ports for durable state (02_ENGINE.md §3, C-18, C-20, C-25). In-memory implementations are
 * used in tests, single-instance dev and the same-Wi-Fi host table; PostgreSQL implementations live in
 * backend/match-server/src/pg.ts. No Node-only import here: this file runs on the phone.
 */
import type { InputRecord } from "@tashzone/engine";

export class StaleEpochError extends Error {
  constructor() { super("stale epoch"); this.name = "StaleEpochError"; }
}

export interface HandSealRecord {
  readonly hand_id: string;
  readonly server_seed: string;
  readonly client_seeds: readonly string[];
  readonly substituted: readonly number[];
  readonly commitment: string;
  readonly chain_root: string;
  readonly result: unknown;
  readonly match_state_digest: string;
}

export interface JournalStore {
  /** Seed first: persisted before the commitment is broadcast (§3 rule 1). */
  persistHandStart(room: string, epoch: number, handId: string, commitment: string, encryptedSeed: string): Promise<void>;
  /** One record per accepted intent; epoch-checked in the same transaction (§3 rules 2, 4). */
  append(room: string, epoch: number, record: InputRecord): Promise<void>;
  /** Final record and seal commit together (§3 rule 7). */
  seal(room: string, epoch: number, seal: HandSealRecord): Promise<void>;
  records(room: string, handId: string): Promise<InputRecord[]>;
}

export interface RoomDirectory {
  /** Claim a room code; returns the new ownership epoch or null if another live owner holds it. */
  claim(room: string, instanceId: string, instanceUrl: string, leaseMs: number): Promise<number | null>;
  renew(room: string, epoch: number, leaseMs: number): Promise<boolean>;
  release(room: string, epoch: number): Promise<void>;
  currentEpoch(room: string): Promise<number | null>;
}

export type IncidentKind =
  | "connect" | "disconnect" | "reject" | "resync" | "pause" | "resume" | "ownership_lost"
  | "drain" | "guard_violation" | "commit_failure" | "relay";

/** Metadata-only incident log (C-25): never cards, text, IPs or tokens. */
export interface IncidentLog {
  record(kind: IncidentKind, meta: Readonly<Record<string, string | number | boolean>>): void;
}

export class MemoryJournal implements JournalStore {
  readonly hands = new Map<string, { epoch: number; commitment: string; encryptedSeed: string }>();
  readonly recs = new Map<string, InputRecord[]>();
  readonly seals = new Map<string, HandSealRecord>();
  failNext = 0; // tests: simulate commit failures
  constructor(private readonly epochOf: (room: string) => number | null) {}
  private check(room: string, epoch: number): void {
    if (this.epochOf(room) !== epoch) throw new StaleEpochError();
  }
  async persistHandStart(room: string, epoch: number, handId: string, commitment: string, encryptedSeed: string) {
    this.check(room, epoch);
    this.hands.set(`${room}/${handId}`, { epoch, commitment, encryptedSeed });
  }
  async append(room: string, epoch: number, record: InputRecord) {
    if (this.failNext > 0) { this.failNext--; throw new Error("simulated commit failure"); }
    this.check(room, epoch);
    const k = `${room}/${record.hand_id}`;
    const list = this.recs.get(k) ?? [];
    if (record.intent_id && list.some((r) => r.intent_id === record.intent_id && r.actor === record.actor)) {
      throw new Error("duplicate intent"); // uniqueness enforced by the journal (§3 rule 6)
    }
    list.push(record);
    this.recs.set(k, list);
  }
  async seal(room: string, epoch: number, seal: HandSealRecord) {
    this.check(room, epoch);
    this.seals.set(`${room}/${seal.hand_id}`, seal);
  }
  async records(room: string, handId: string) { return (this.recs.get(`${room}/${handId}`) ?? []).slice(); }
}

export class MemoryDirectory implements RoomDirectory {
  private seq = 0;
  readonly claims = new Map<string, { epoch: number; instance: string; until: number }>();
  constructor(private readonly now: () => number = () => Date.now()) {}
  async claim(room: string, instanceId: string, _url: string, leaseMs: number) {
    const c = this.claims.get(room);
    if (c && c.until > this.now() && c.instance !== instanceId) return null;
    const epoch = ++this.seq;
    this.claims.set(room, { epoch, instance: instanceId, until: this.now() + leaseMs });
    return epoch;
  }
  async renew(room: string, epoch: number, leaseMs: number) {
    const c = this.claims.get(room);
    if (!c || c.epoch !== epoch) return false;
    c.until = this.now() + leaseMs;
    return true;
  }
  async release(room: string, epoch: number) {
    const c = this.claims.get(room);
    if (c && c.epoch === epoch) this.claims.delete(room);
  }
  async currentEpoch(room: string) { return this.claims.get(room)?.epoch ?? null; }
}

export class MemoryIncidentLog implements IncidentLog {
  readonly entries: { kind: IncidentKind; meta: Record<string, string | number | boolean> }[] = [];
  record(kind: IncidentKind, meta: Readonly<Record<string, string | number | boolean>>) { this.entries.push({ kind, meta: { ...meta } }); }
}
