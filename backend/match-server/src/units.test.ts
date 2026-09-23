import { describe, expect, it } from "vitest";
import { checkSecrets } from "./config.js";
import { decryptSeed, encryptSeed } from "./crypto.js";
import { guardPayload } from "./guard.js";
import { signJoinToken, verifyJoinToken } from "./tokens.js";

describe("units", () => {
  it("projection guard blocks any card outside the visible set (L-14)", () => {
    expect(guardPayload(JSON.stringify({ my_hand: ["AS", "2C"] }), new Set(["AS", "2C"]))).toBe(true);
    expect(guardPayload(JSON.stringify({ my_hand: ["AS", "KD"] }), new Set(["AS"]))).toBe(false);
  });
  it("secrets must be ≥ 32 chars and distinct (C-17)", () => {
    expect(() => checkSecrets({ joinTokenSecret: "a".repeat(40), internalApiToken: "a".repeat(40), seedEncryptionKey: "ab".repeat(32) })).toThrow();
    expect(() => checkSecrets({ joinTokenSecret: "a".repeat(10), internalApiToken: "b".repeat(40), seedEncryptionKey: "ab".repeat(32) })).toThrow();
    expect(() => checkSecrets({ joinTokenSecret: "a".repeat(40), internalApiToken: "b".repeat(40), seedEncryptionKey: "ab".repeat(32) })).not.toThrow();
  });
  it("seed encryption round-trips and binds the hand id (T-18)", () => {
    const key = "cd".repeat(32); const seed = "ef".repeat(32);
    const blob = encryptSeed(key, seed, "h1");
    expect(decryptSeed(key, blob, "h1")).toBe(seed);
    expect(() => decryptSeed(key, blob, "h2")).toThrow();
  });
  it("join tokens verify, expire and reject tampering", () => {
    const claims = { room: "ABC123", player_id: "p", seat: 1, name: "n", host: false, free_text: false, exp: 2000, profile_id: "callbreak.np@1", preset: "standard", settings: {} };
    const t = signJoinToken("s".repeat(40), claims);
    expect(verifyJoinToken("s".repeat(40), t, 1000)?.seat).toBe(1);
    expect(verifyJoinToken("s".repeat(40), t, 3000)).toBeNull();
    expect(verifyJoinToken("x".repeat(40), t, 1000)).toBeNull();
  });
});
