import { describe, expect, it } from "vitest";
import { LOCK_MS, LOCK_STEPS, MAX_FAILS, NO_LOCK, type Digest, type PinLock, checkPin, hashPin, isValidPin, lockRemaining, lockStep, safeEqual, settleLock, storedLock } from "./pin";
import { mergeProfile } from "../../store/profileModel";

// deterministic stand-in for SHA-256: distinct inputs give distinct outputs
const digest: Digest = async (s) => `h(${s})`;
const SALT = "salt-1";
const NOW = 1_000_000;

async function failRound(stored: string, lock: PinLock, mono: number): Promise<PinLock> {
  let current = lock;
  for (let i = 0; i < MAX_FAILS; i++) current = (await checkPin("0000", SALT, stored, current, mono, digest)).lock;
  return current;
}

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

  it("escalates 1, 5, 15, then 60 minutes and stays there", () => {
    expect(LOCK_STEPS).toEqual([60_000, 300_000, 900_000, 3_600_000]);
    expect([0, 1, 2, 3, 4, 9].map(lockStep)).toEqual([60_000, 300_000, 900_000, 3_600_000, 3_600_000, 3_600_000]);
  });
});

describe("checkPin", () => {
  it("accepts the right PIN and clears the counter", async () => {
    const stored = await hashPin("4321", SALT, digest);
    const r = await checkPin("4321", SALT, stored, { fails: 3, level: 2, left: 0 }, NOW, digest);
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
    expect(last.lock).toMatchObject({ fails: 0, level: 1, left: LOCK_MS, mark: NOW });

    const during = await checkPin("4321", SALT, stored, last.lock, NOW + 30_000, digest);
    expect(during).toMatchObject({ kind: "locked", remainingMs: 30_000 });
    expect(lockRemaining(last.lock, NOW + 30_000)).toBe(30_000);
  });

  it("escalates each further round of wrong tries and resets only on the right PIN", async () => {
    const stored = await hashPin("4321", SALT, digest);
    let lock: PinLock = NO_LOCK;
    let mono = NOW;
    for (const step of LOCK_STEPS.concat(LOCK_STEPS[LOCK_STEPS.length - 1]!)) {
      lock = await failRound(stored, lock, mono);
      expect(lockRemaining(lock, mono)).toBe(step);
      mono += step;
    }
    const ok = await checkPin("4321", SALT, stored, lock, mono, digest);
    expect(ok).toEqual({ kind: "ok", lock: NO_LOCK });
    expect(lockRemaining(await failRound(stored, ok.lock, mono), mono)).toBe(LOCK_MS);
  });

  it("allows tries again after the lock ends, with a fresh count", async () => {
    const stored = await hashPin("4321", SALT, digest);
    const expired: PinLock = { fails: 0, level: 1, left: LOCK_MS, mark: NOW };
    const r = await checkPin("0000", SALT, stored, expired, NOW + LOCK_MS, digest);
    expect(r).toMatchObject({ kind: "wrong", triesLeft: MAX_FAILS - 1 });
    expect((await checkPin("4321", SALT, stored, expired, NOW + LOCK_MS, digest)).kind).toBe("ok");
  });

  it("rejects a malformed PIN as a wrong try", async () => {
    const stored = await hashPin("4321", SALT, digest);
    expect((await checkPin("43", SALT, stored, undefined, NOW, digest)).kind).toBe("wrong");
  });
});

describe("lock clock", () => {
  const lock: PinLock = { fails: 0, level: 1, left: LOCK_MS, mark: NOW };

  it("only counts monotonic time, so a clock set backwards never shortens or rewinds it", () => {
    expect(lockRemaining(lock, NOW - 10_000_000)).toBe(LOCK_MS);
    expect(lockRemaining(settleLock(lock, NOW + 20_000), NOW + 20_000)).toBe(LOCK_MS - 20_000);
  });

  it("ignores the wall clock entirely, so a clock set forwards never shortens it", async () => {
    const stored = await hashPin("4321", SALT, digest);
    const r = await checkPin("4321", SALT, stored, lock, NOW + 1_000, digest);
    expect(r).toMatchObject({ kind: "locked", remainingMs: LOCK_MS - 1_000 });
  });

  it("stores the budget still owed, without the process-local mark", () => {
    expect(storedLock(lock, NOW + 15_000)).toEqual({ fails: 0, level: 1, left: LOCK_MS - 15_000 });
  });

  it("after a restart the stored budget is still owed in full, whatever the wall clock says", () => {
    const reloaded = mergeProfile({ parent: { lock: storedLock(lock, NOW + 15_000) } }).parent.lock!;
    expect(reloaded.mark).toBeUndefined();
    expect(lockRemaining(reloaded, 0)).toBe(LOCK_MS - 15_000);
    expect(lockRemaining(reloaded, Number.MAX_SAFE_INTEGER)).toBe(LOCK_MS - 15_000);
    const remarked = { ...reloaded, mark: 5 };
    expect(lockRemaining(remarked, 5 + LOCK_MS)).toBe(0);
  });

  it("settling a spent lock leaves nothing owed", () => {
    expect(settleLock(lock, NOW + LOCK_MS * 2).left).toBe(0);
    expect(lockRemaining(undefined, NOW)).toBe(0);
  });
});
