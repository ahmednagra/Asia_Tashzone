import type { MatchReport } from "./room.js";

/** Results go only through FastAPI internal routes (T-16); accepted once per match id, epoch-checked (C-27). */
export function httpResultsSink(apiUrl: string | null, token: string): (r: MatchReport) => Promise<void> {
  return async (report) => {
    if (!apiUrl) return;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(`${apiUrl}/api/v1/internal/results`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify(report),
        });
        if (res.ok || res.status === 409) return; // 409 = already recorded (idempotent)
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  };
}

/** POST /internal/rooms/{code}/started, retried like results; failures are logged by the caller, never fatal. */
export function httpStartedNotifier(apiUrl: string | null, token: string): (room: string) => Promise<void> {
  return async (room) => {
    if (!apiUrl) return;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await fetch(`${apiUrl}/api/v1/internal/rooms/${room}/started`, {
          method: "POST", headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok || (res.status >= 400 && res.status < 500)) return; // 4xx: unknown or closed room, retrying cannot help
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  };
}
