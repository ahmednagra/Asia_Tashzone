/**
 * Fast seeded generator for bot search only (determinisation and playouts). Never used for deals or
 * any game-relevant draw: those come only from tz-rng-v1 (core/rng.ts). xoshiro128** with SHA-256
 * seeding, ported from TashZone v1 so a bot's choice is deterministic for a given seed.
 */
import { sha256 } from "@noble/hashes/sha256";
import { utf8 } from "./bytes.js";

export interface BotRandom {
  next(): number;
  int(maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
  pick<T>(items: readonly T[]): T;
  hex32(): string;
}

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

export class BotRng implements BotRandom {
  private readonly s: [number, number, number, number];
  constructor(seed: string) {
    const h = sha256(utf8(`tashzone-bot-rng:${seed}`));
    const w = (i: number) => ((h[i]! << 24) | (h[i + 1]! << 16) | (h[i + 2]! << 8) | h[i + 3]!) >>> 0;
    this.s = [w(0), w(4), w(8), w(12)];
    if (this.s.every((x) => x === 0)) this.s[0] = 1;
  }
  next(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 11) >>> 0;
    s[2] = (s[2] ^ s[0]) >>> 0;
    s[3] = (s[3] ^ s[1]) >>> 0;
    s[1] = (s[1] ^ s[2]) >>> 0;
    s[0] = (s[0] ^ s[3]) >>> 0;
    s[2] = (s[2] ^ t) >>> 0;
    s[3] = rotl(s[3], 11);
    return result / 4294967296;
  }
  int(maxExclusive: number): number { return Math.floor(this.next() * maxExclusive); }
  shuffle<T>(items: readonly T[]): T[] {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = a[i] as T; a[i] = a[j] as T; a[j] = t;
    }
    return a;
  }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("pick on empty list");
    return items[this.int(items.length)] as T;
  }
  hex32(): string {
    let out = "";
    for (let i = 0; i < 8; i++) out += (Math.floor(this.next() * 4294967296) >>> 0).toString(16).padStart(8, "0");
    return out;
  }
}

/**
 * Deals unseen cards to seats (and optional hidden piles) consistent with known voids.
 * Falls back to an unconstrained deal if the constraints cannot be met after a few attempts.
 */
export function sampleHiddenHands(rng: BotRandom, unseen: readonly string[], counts: readonly number[], voids: readonly (readonly string[])[]): string[][] {
  const needTotal = counts.reduce((a, b) => a + b, 0);
  if (needTotal !== unseen.length) throw new Error(`sampleHiddenHands: ${unseen.length} cards for ${needTotal} slots`);
  const order = counts.map((_, i) => i).sort((a, b) => (voids[b]?.length ?? 0) - (voids[a]?.length ?? 0) || a - b);
  for (let attempt = 0; attempt < 30; attempt++) {
    let pool = rng.shuffle(unseen);
    const hands: string[][] = counts.map(() => []);
    let valid = true;
    for (const seat of order) {
      const banned = voids[seat] ?? [];
      const allowed = pool.filter((c) => !banned.includes(c[1]!)).slice(0, counts[seat] ?? 0);
      if (allowed.length < (counts[seat] ?? 0)) { valid = false; break; }
      hands[seat] = allowed;
      const drop = allowed.slice();
      pool = pool.filter((c) => { const i = drop.indexOf(c); if (i >= 0) { drop.splice(i, 1); return false; } return true; });
    }
    if (valid) return hands;
  }
  let pool = rng.shuffle(unseen);
  return counts.map((n) => { const part = pool.slice(0, n); pool = pool.slice(n); return part; });
}
