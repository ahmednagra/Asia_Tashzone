import { useCallback, useEffect, useRef, useState } from "react";
import { monoNow, useProfile } from "../store/profile";
import { checkPin, lockRemaining } from "../features/settings/pin";
import { sha256 } from "../features/settings/pinCrypto";

export interface PinGate {
  /** a PIN has been set on this install */
  hasPin: boolean;
  /** seconds left on the lock-out, 0 when not locked */
  secondsLeft: number;
  /** tries left after the last wrong PIN, undefined before any wrong try */
  triesLeft?: number;
  /** a hash check is running */
  busy: boolean;
  failed?: boolean;
  /** checks a PIN against the stored hash, persisting the failed-try counter; resolves true when it matches */
  verify: (pin: string) => Promise<boolean>;
}

/** Parent-PIN check with persisted, escalating lock-out on a monotonic clock (surviving an app restart and clock changes). */
export function usePinGate(): PinGate {
  const { profile, update } = useProfile();
  const parent = useRef(profile.parent);
  parent.current = profile.parent;
  const [mono, setMono] = useState(monoNow);
  const [triesLeft, setTriesLeft] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const remainingMs = lockRemaining(profile.parent.lock, mono);

  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = setInterval(() => setMono(monoNow()), 500);
    return () => clearInterval(id);
  }, [remainingMs > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = useCallback(async (pin: string) => {
    const { pinHash, salt, lock } = parent.current;
    if (!pinHash || !salt) return true;
    setBusy(true);
    setFailed(false);
    try {
      const t = monoNow();
      const r = await checkPin(pin, salt, pinHash, lock, t, sha256);
      update({ parent: { ...parent.current, lock: r.lock } });
      setMono(t);
      setTriesLeft(r.kind === "wrong" ? r.triesLeft : undefined);
      return r.kind === "ok";
    } catch {
      setFailed(true);
      return false;
    } finally {
      setBusy(false);
    }
  }, [update]);

  return { hasPin: !!profile.parent.pinHash, secondsLeft: Math.ceil(remainingMs / 1000), triesLeft, busy, failed, verify };
}
