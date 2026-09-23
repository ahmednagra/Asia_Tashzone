import { useCallback, useEffect, useRef, useState } from "react";
import { useProfile } from "../store/profile";
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
  /** checks a PIN against the stored hash, persisting the failed-try counter; resolves true when it matches */
  verify: (pin: string) => Promise<boolean>;
}

/** Parent-PIN check with persisted lock-out (5 wrong tries lock it for 60 s, surviving an app restart). */
export function usePinGate(): PinGate {
  const { profile, update } = useProfile();
  const parent = useRef(profile.parent);
  parent.current = profile.parent;
  const [now, setNow] = useState(() => Date.now());
  const [triesLeft, setTriesLeft] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const remainingMs = lockRemaining(profile.parent.lock, now);

  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [remainingMs > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = useCallback(async (pin: string) => {
    const { pinHash, salt, lock } = parent.current;
    if (!pinHash || !salt) return true;
    setBusy(true);
    try {
      const t = Date.now();
      const r = await checkPin(pin, salt, pinHash, lock, t, sha256);
      update({ parent: { ...parent.current, lock: r.lock } });
      setNow(t);
      setTriesLeft(r.kind === "wrong" ? r.triesLeft : undefined);
      return r.kind === "ok";
    } finally {
      setBusy(false);
    }
  }, [update]);

  return { hasPin: !!profile.parent.pinHash, secondsLeft: Math.ceil(remainingMs / 1000), triesLeft, busy, verify };
}
