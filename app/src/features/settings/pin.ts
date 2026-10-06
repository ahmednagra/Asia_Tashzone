/** Parent PIN logic (pure: hashing is injected so this runs without React Native). Salted SHA-256, 5 wrong tries lock it for 1, 5, 15, then 60 min. */

export const PIN_LENGTH = 4;
export const MAX_FAILS = 5;
export const LOCK_STEPS: readonly number[] = [60_000, 300_000, 900_000, 3_600_000];
export const LOCK_MS = LOCK_STEPS[0]!;

export interface PinLock { fails: number; level: number; left: number; mark?: number }
export const NO_LOCK: PinLock = { fails: 0, level: 0, left: 0 };
export type Digest = (input: string) => Promise<string>;

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

export const lockStep = (level: number) => LOCK_STEPS[Math.min(Math.max(0, level), LOCK_STEPS.length - 1)]!;

/** Hash of `salt:pin`. The salt is random per install, so equal PINs on two phones hash differently. */
export function hashPin(pin: string, salt: string, digest: Digest): Promise<string> {
  return digest(`${salt}:${pin}`);
}

/** Equality without an early exit, so timing does not reveal how many characters matched. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Milliseconds left on the lock-out, 0 when not locked. */
export function lockRemaining(lock: PinLock | undefined, mono: number): number {
  if (!lock || lock.left <= 0) return 0;
  const spent = lock.mark === undefined ? 0 : Math.max(0, mono - lock.mark);
  return Math.max(0, lock.left - spent);
}

export function settleLock(lock: PinLock, mono: number): PinLock {
  return { ...lock, left: lockRemaining(lock, mono), mark: mono };
}

export function storedLock(lock: PinLock, mono: number): PinLock {
  return { fails: lock.fails, level: lock.level, left: lockRemaining(lock, mono) };
}

export type PinResult =
  | { kind: "ok"; lock: PinLock }
  | { kind: "wrong"; lock: PinLock; triesLeft: number }
  | { kind: "locked"; lock: PinLock; remainingMs: number };

/** Checks an entered PIN. A locked state rejects without hashing; the 5th wrong try starts the lock and clears the counter. */
export async function checkPin(pin: string, salt: string, storedHash: string, lock: PinLock | undefined, mono: number, digest: Digest): Promise<PinResult> {
  const current = lock ?? NO_LOCK;
  const remaining = lockRemaining(current, mono);
  if (remaining > 0) return { kind: "locked", lock: settleLock(current, mono), remainingMs: remaining };
  if (isValidPin(pin) && safeEqual(await hashPin(pin, salt, digest), storedHash)) return { kind: "ok", lock: NO_LOCK };
  const nextFails = current.fails + 1;
  if (nextFails >= MAX_FAILS) {
    const ms = lockStep(current.level);
    return { kind: "locked", lock: { fails: 0, level: current.level + 1, left: ms, mark: mono }, remainingMs: ms };
  }
  return { kind: "wrong", lock: { fails: nextFails, level: current.level, left: 0 }, triesLeft: MAX_FAILS - nextFails };
}
