/** L8 RNG: primitive vectors, pinned tz-rng-v1 known answers (RNG-01), uniformity (RNG-02 short). */
import { describe, expect, it } from "vitest";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { chacha20 } from "@noble/ciphers/chacha";
import { DrawStream, deriveHandSeed, fromHex, seedCommitment, std52, toHex } from "../src/index.js";

describe("primitive vectors", () => {
  it("HMAC-SHA-256 RFC 4231 test case 2", () => {
    const out = hmac(sha256, new TextEncoder().encode("Jefe"), new TextEncoder().encode("what do ya want for nothing?"));
    expect(toHex(out)).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });
  it("ChaCha20 RFC 8439 §2.4.2 keystream block 1", () => {
    const key = fromHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    const nonce = fromHex("000000000000004a00000000");
    const ks = chacha20(key, nonce, new Uint8Array(64), undefined, 1);
    expect(toHex(ks.slice(0, 16))).toBe("224f51f3401bd9e12fde276fb8631ded");
  });
});

const SERVER = "11".repeat(32);
const CLIENTS = ["22".repeat(32), "33".repeat(32), "44".repeat(32), "55".repeat(32)];

describe("tz-rng-v1 known answers (pinned; any change is a randomness_version bump)", () => {
  it("commitment, hand seed and first shuffle are stable", () => {
    const commit = seedCommitment(SERVER, "h1");
    const seed = deriveHandSeed(SERVER, "h1", CLIENTS);
    const deck = new DrawStream(seed, "R-CB-1/shuffle").shuffle(std52());
    expect({ commit, seed, first8: deck.slice(0, 8) }).toMatchSnapshot();
  });
  it("client seed order matters; hand id binds the seed", () => {
    expect(deriveHandSeed(SERVER, "h1", CLIENTS)).not.toBe(deriveHandSeed(SERVER, "h1", [...CLIENTS].reverse()));
    expect(deriveHandSeed(SERVER, "h1", CLIENTS)).not.toBe(deriveHandSeed(SERVER, "h2", CLIENTS));
  });
  it("purpose labels give independent substreams", () => {
    const seed = deriveHandSeed(SERVER, "h1", CLIENTS);
    const a = new DrawStream(seed, "a"); const b = new DrawStream(seed, "b");
    expect([a.below(1000000), a.below(1000000)]).not.toEqual([b.below(1000000), b.below(1000000)]);
  });
  it("draws are logged with label and bound", () => {
    const log: { label: string; bound: number; value: number }[] = [];
    new DrawStream(SERVER, "x", log).shuffle([1, 2, 3]);
    expect(log.map((d) => d.bound)).toEqual([3, 2]);
  });
});

describe("uniformity (short; long run is nightly)", () => {
  it("below(n) passes chi-square for n = 52", () => {
    const s = new DrawStream("ab".repeat(32), "chi");
    const N = 52 * 4000; const counts = new Array(52).fill(0);
    for (let i = 0; i < N; i++) counts[s.below(52)]++;
    const e = N / 52; const chi = counts.reduce((a, c) => a + (c - e) ** 2 / e, 0);
    expect(chi).toBeLessThan(90); // df = 51, p ≈ 0.0007 critical ≈ 90
  });
  it("shuffle first position is uniform over 52 cards", () => {
    const counts = new Map<string, number>();
    const N = 20800;
    for (let i = 0; i < N; i++) {
      const c = new DrawStream(deriveHandSeed(SERVER, `u${i}`, []), "s").shuffle(std52())[0]!;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const e = N / 52; let chi = 0; for (const v of counts.values()) chi += (v - e) ** 2 / e;
    expect(counts.size).toBe(52);
    expect(chi).toBeLessThan(90);
  });
});
