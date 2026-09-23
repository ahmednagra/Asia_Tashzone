import { describe, expect, it } from "vitest";
import { LOCK_MS, MAX_FAILS, NO_LOCK, type Digest, type PinLock, checkPin, hashPin, isValidPin, lockRemaining, safeEqual } from "./pin";

// deterministic stand-in for SHA-256: distinct inputs give distinct outputs
const digest: Digest = async (s) => `h(${s})`;
const SALT = "salt-1";
const NOW = 1_000_000;

describe("pin helpers", () => {
  it("accepts exactly four digits", () => {
    expect(isValidPin("1234")).toBe(true);
    for (const bad of ["", "123", "12345", "12a4", "١٢٣٤", " 123"]) expect(isValidPin(bad)).toBe(false);
  });

  it("salts the hash", async () => {
    expect(await hashPin("1234", "a", digest)).not.toBe(await hashPin("1234", "b", digest));
  });

  it("compares strings fully", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("checkPin", () => {
  it("accepts the right PIN and clears the counter", async () => {
    const stored = await hashPin("4321", SALT, digest);
    const r = await checkPin("4321", SALT, stored, { fails: 3, until: 0 }, NOW, digest);
    expect(r).toEqual({ kind: "ok", lock: NO_LOCK });
  });

  it("counts wrong tries and reports what is left", async () => {
    const stored = await hashPin("4321", SALT, digest);
    let lock: PinLock = NO_LOCK;
    for (let i = 1; i < MAX_FAILS; i++) {
      const r = await checkPin("0000", SALT, stored, lock, NOW, digest);
      expect(r.kind).toBe("wrong");
      if (r.kind === "wrong") expect(r.triesLeft).toBe(MAX_FAILS - i);
      lock = r.lock;
    }
  });

  it("locks for 60 s on the fifth wrong try, even for the right PIN while locked", async () => {
    const stored = await hashPin("4321", SALT, digest);
    let lock: PinLock = NO_LOCK;
    let last = await checkPin("0000", SALT, stored, lock, NOW, digest);
    for (let i = 1; i < MAX_FAILS; i++) { lock = last.lock; last = await checkPin("0000", SALT, stored, lock, NOW, digest); }
    expect(last).toMatchObject({ kind: "locked", remainingMs: LOCK_MS });
    expect(last.lock.until).toBe(NOW + LOCK_MS);

    const during = await checkPin("4321", SALT, stored, last.lock, NOW + 30_000, digest);
    expect(during).toMatchObject({ kind: "locked", remainingMs: 30_000 });
    expect(lockRemaining(last.lock, NOW + 30_000)).toBe(30_000);
  });

  it("allows tries again after the lock ends, with a fresh count", async () => {
    const stored = await hashPin("4321", SALT, digest);
    const expired: PinLock = { fails: 0, until: NOW };
    const r = await checkPin("0000", SALT, stored, expired, NOW + 1, digest);
    expect(r).toMatchObject({ kind: "wrong", triesLeft: MAX_FAILS - 1 });
    expect((await checkPin("4321", SALT, stored, expired, NOW + 1, digest)).kind).toBe("ok");
  });

  it("rejects a malformed PIN as a wrong try", async () => {
    const stored = await hashPin("4321", SALT, digest);
    expect((await checkPin("43", SALT, stored, undefined, NOW, digest)).kind).toBe("wrong");
  });
});
