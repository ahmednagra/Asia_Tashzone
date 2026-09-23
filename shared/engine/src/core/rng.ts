/**
 * P-09 randomness, version tz-rng-v1 (03_PLATFORM.md §6.5):
 *  commitment = SHA-256(frame("tz/commit/v1", server_seed, hand_id))
 *  hand_seed  = HMAC-SHA-256(server_seed, frame("tz/hand/v1", hand_id, client_seed_0..n in seat order))
 *  substream  = ChaCha20(key = HMAC-SHA-256(hand_seed, frame("tz/draw/v1", label)), nonce = 0^12)
 *  below(n)   = 31-bit rejection sampling; shuffle = Fisher–Yates from the top.
 * The only randomness in the engine. No host entropy, no clocks.
 */
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { chacha20 } from "@noble/ciphers/chacha";
import { frame, fromHex, toHex, utf8 } from "./bytes.js";

export const RANDOMNESS_VERSION = "tz-rng-v1";

export function seedCommitment(serverSeedHex: string, handId: string): string {
  return toHex(sha256(frame([utf8("tz/commit/v1"), fromHex(serverSeedHex), utf8(handId)])));
}

export function deriveHandSeed(serverSeedHex: string, handId: string, clientSeedsHex: readonly string[]): string {
  const parts = [utf8("tz/hand/v1"), utf8(handId), ...clientSeedsHex.map(fromHex)];
  return toHex(hmac(sha256, fromHex(serverSeedHex), frame(parts)));
}

export interface DrawRecord { readonly label: string; readonly bound: number; readonly value: number }

const BLOCK = 256; // keystream bytes per refill (4 ChaCha20 blocks)
const TWO31 = 2147483648;

export class DrawStream {
  private readonly key: Uint8Array;
  private buf: Uint8Array = new Uint8Array(0);
  private pos = 0;
  private counter = 0;
  constructor(handSeedHex: string, readonly label: string, private readonly log?: DrawRecord[]) {
    this.key = hmac(sha256, fromHex(handSeedHex), frame([utf8("tz/draw/v1"), utf8(label)]));
  }
  private refill(): void {
    this.buf = chacha20(this.key, new Uint8Array(12), new Uint8Array(BLOCK), undefined, this.counter);
    this.counter += BLOCK / 64;
    this.pos = 0;
  }
  private u31(): number {
    if (this.pos + 4 > this.buf.length) this.refill();
    const b = this.buf;
    const p = this.pos;
    this.pos += 4;
    return (((b[p]! & 0x7f) << 24) | (b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!) >>> 0;
  }
  /** Uniform integer in [0, n). */
  below(n: number): number {
    if (!Number.isSafeInteger(n) || n < 1 || n > TWO31) throw new Error("below: bad bound");
    const limit = TWO31 - (TWO31 % n);
    for (;;) {
      const x = this.u31();
      if (x < limit) {
        const v = x % n;
        this.log?.push({ label: this.label, bound: n, value: v });
        return v;
      }
    }
  }
  shuffle<T>(pool: readonly T[]): T[] {
    const a = pool.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.below(i + 1);
      const t = a[i] as T; a[i] = a[j] as T; a[j] = t;
    }
    return a;
  }
}

/** Uniform draws from one tz-rng-v1 substream, shaped for game code. */
export interface HandRandom {
  int(n: number): number;
  shuffle<T>(pool: readonly T[]): T[];
  pick<T>(items: readonly T[]): T;
}

export function handRandom(handSeedHex: string, label: string, log?: DrawRecord[]): HandRandom {
  const s = new DrawStream(handSeedHex, label, log);
  return {
    int: (n) => s.below(n),
    shuffle: (pool) => s.shuffle(pool),
    pick: (items) => { if (items.length === 0) throw new Error("pick on empty list"); return items[s.below(items.length)]!; },
  };
}
