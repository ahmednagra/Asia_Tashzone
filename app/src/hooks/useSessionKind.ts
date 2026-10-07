import { useEffect, useState } from "react";
import { type SessionKind, sessionKind, subscribeSessionKind } from "../services/session";

/** "guest" or "account" for this phone, null until read; follows sign-in and sign-out as they happen. */
export function useSessionKind(): SessionKind | null {
  const [kind, setKind] = useState<SessionKind | null>(null);
  useEffect(() => {
    let live = true;
    sessionKind().then((k) => { if (live) setKind(k); }).catch(() => { if (live) setKind("guest"); });
    const off = subscribeSessionKind((k) => { if (live) setKind(k); });
    return () => { live = false; off(); };
  }, []);
  return kind;
}
