/** Parent PIN logic (pure: hashing is injected so this runs without React Native). Salted SHA-256, 5 wrong tries lock it for 60 s. */

export const PIN_LENGTH = 4;
export const MAX_FAILS = 5;
export const LOCK_MS = 60_000;

export interface PinLock { fails: number; until: number }
export const NO_LOCK: PinLock = { fails: 0, until: 0 };
export type Digest = (input: string) => Promise<string>;

export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

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
export function lockRemaining(lock: PinLock | undefined, now: number): number {
  return lock && lock.until > now ? lock.until - now : 0;
}

export type PinResult =
  | { kind: "ok"; lock: PinLock }
  | { kind: "wrong"; lock: PinLock; triesLeft: number }
  | { kind: "locked"; lock: PinLock; remainingMs: number };

/** Checks an entered PIN. A locked state rejects without hashing; the 5th wrong try starts the lock and clears the counter. */
export async function checkPin(pin: string, salt: string, storedHash: string, lock: PinLock | undefined, now: number, digest: Digest): Promise<PinResult> {
  const current = lock ?? NO_LOCK;
  const remaining = lockRemaining(current, now);
  if (remaining > 0) return { kind: "locked", lock: current, remainingMs: remaining };
  // a lock that has run out starts a fresh count
  const fails = current.until > 0 ? 0 : current.fails;
  if (isValidPin(pin) && safeEqual(await hashPin(pin, salt, digest), storedHash)) return { kind: "ok", lock: NO_LOCK };
  const nextFails = fails + 1;
  if (nextFails >= MAX_FAILS) {
    const next = { fails: 0, until: now + LOCK_MS };
    return { kind: "locked", lock: next, remainingMs: LOCK_MS };
  }
  return { kind: "wrong", lock: { fails: nextFails, until: 0 }, triesLeft: MAX_FAILS - nextFails };
}
