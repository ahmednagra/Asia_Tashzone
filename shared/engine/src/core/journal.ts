/** P-15 hash chain over journal records (02_ENGINE.md §3). Canonical serialisation, no timestamps. */
import { canonicalize, sha256Hex } from "./canonical.js";

export const GENESIS = "0".repeat(64);

export interface InputRecord {
  readonly hand_id: string;
  readonly server_seq: number;
  readonly epoch: number;
  readonly intent_id: string | null;
  readonly actor: number | "system";
  readonly origin: "human" | "bot" | "handover" | "system";
  readonly action: unknown;
  readonly prev_hash: string;
  readonly state_hash: string;
}

export function recordHash(r: InputRecord): string {
  return sha256Hex(canonicalize(r));
}

export function verifyChain(records: readonly InputRecord[], start = GENESIS): { ok: true; root: string } | { ok: false; at: number } {
  let prev = start;
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    if (r.prev_hash !== prev) return { ok: false, at: i };
    prev = recordHash(r);
  }
  return { ok: true, root: prev };
}
