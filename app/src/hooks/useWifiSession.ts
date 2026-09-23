import { useCallback, useEffect, useState } from "react";
import { scanForTables, type NearbyTable } from "../lib/lan";
import { isDialable } from "../features/multiplayer/lanLogic";
import type { SessionState } from "../features/multiplayer/session";
import { useOnlineSession } from "./useOnlineSession";

/**
 * Live view of a same-Wi-Fi table. The shape is the online session's (`SessionState`), so the wait room, the table and
 * the match summary read it unchanged; `wifi` (PIN, QR, address, roster) is only set while this phone hosts or joined
 * a same-Wi-Fi table, and `active` says whether the current session is one.
 */
export function useWifiSession(): SessionState & { active: boolean } {
  const session = useOnlineSession();
  return { ...session, active: session.transport === "wifi" };
}

/**
 * Tables advertising on this network while `enabled` (the join screen is showing). Scanning stops on unmount or when
 * disabled. Only private-LAN addresses are listed. `error` is `DISCOVERY_FAILED` when the system could not browse.
 */
export function useNearbyTables(enabled = true): { tables: NearbyTable[]; error: string | null; rescan: () => void } {
  const [tables, setTables] = useState<NearbyTable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    setError(null);
    return scanForTables(
      (all) => setTables(all.filter((t) => isDialable(t.host, t.port))),
      () => setError("DISCOVERY_FAILED"),
    );
  }, [enabled, round]);

  const rescan = useCallback(() => { setTables([]); setRound((r) => r + 1); }, []);
  return { tables, error, rescan };
}
