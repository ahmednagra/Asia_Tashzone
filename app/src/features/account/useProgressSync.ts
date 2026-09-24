import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { sessionKind } from "../../services/session";
import type { Profile } from "../../store/profileModel";
import { pushProfile } from "./flows";
import { progressKey } from "./progressSync";

const SETTLE_MS = 3000;

export function useProgressSync(profile: Profile, ready: boolean): void {
  const latest = useRef(profile);
  const synced = useRef<string | null>(null);
  const running = useRef(false);
  latest.current = profile;

  useEffect(() => {
    if (!ready) return;
    const sync = async () => {
      const key = progressKey(latest.current);
      if (running.current || key === synced.current) return;
      if ((await sessionKind()) !== "account") return;
      running.current = true;
      try {
        await pushProfile(latest.current);
        synced.current = key;
      } catch {
        synced.current = null;
      } finally {
        running.current = false;
      }
    };
    const timer = setTimeout(() => { sync().catch(() => {}); }, SETTLE_MS);
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") sync().catch(() => {}); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [ready, progressKey(profile)]); // eslint-disable-line react-hooks/exhaustive-deps
}
