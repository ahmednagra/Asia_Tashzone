/**
 * Pure logic for same-Wi-Fi tables (no React Native imports, so vitest covers it): the table PIN, engine
 * compatibility values, dial-target validation, the buffering TCP link factory and failure-code mapping.
 */
import type { Link, LinkFactory, LinkHandlers } from "@tashzone/match";
import { isPrivateLanIpv4, isValidTablePort } from "@tashzone/match";
import { PROFILES, hashCanonical, profileHash } from "@tashzone/engine";

/* ───────────── PIN ───────────── */

/** 4-digit PIN from CSPRNG bytes. Rejection sampling (bytes >= 250 are skipped) keeps every digit equally likely. */
export function makePin(randomBytes: (n: number) => Uint8Array): string {
  let pin = "";
  for (let rounds = 0; pin.length < 4 && rounds < 64; rounds++) {
    for (const b of randomBytes(8)) if (b < 250 && pin.length < 4) pin += String(b % 10);
  }
  if (pin.length < 4) throw new Error("no randomness available for the table PIN");
  return pin;
}

/* ───────────── compatibility ───────────── */

/**
 * Hello carries an engine build hash and a behaviour digest, and the guest sends them before it knows which game
 * the host picked, so both are app-wide: the build (VERSION_CODE) and a hash of every profile definition. Two builds
 * that ship different rules therefore refuse each other (UPDATE_REQUIRED) without simulating matches on the phone.
 * Weaker than the server's simulated digest: two builds with equal VERSION_CODE and equal profiles but different
 * engine code would still pair. Bump VERSION_CODE on every release.
 */
export function lanCompat(versionCode: number): { engineBuildHash: string; behaviourDigest: string } {
  const profiles = Object.keys(PROFILES).sort().map((id) => [id, profileHash(PROFILES[id]!)]);
  return {
    engineBuildHash: hashCanonical(["tz/lan/engine/v1", versionCode]),
    behaviourDigest: hashCanonical(["tz/lan/rules/v1", profiles]),
  };
}

/* ───────────── dial targets ───────────── */

/** True only for a private-LAN IPv4 and a usable port: the only thing this app ever dials. */
export function isDialable(host: string, port: number): boolean {
  return isPrivateLanIpv4(host) && isValidTablePort(port);
}

/** Manual entry: `192.168.1.20:41234` (the host screen shows exactly this). Null for anything else. */
export function parseHostAddress(text: string): { host: string; port: number } | null {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.exec(text.trim());
  if (!m) return null;
  const host = m[1]!;
  const port = Number(m[2]);
  return isDialable(host, port) ? { host, port } : null;
}

/** What the host shows for manual joining. */
export const formatHostAddress = (host: string, port: number): string => `${host}:${port}`;

/* ───────────── failures ───────────── */

/** Server error frame -> the app's own stable code (copy.errors). */
export function joinFailureCode(protocolCode: string): string {
  switch (protocolCode) {
    case "UNAUTHORIZED": return "WRONG_PIN";
    case "ROOM_LOCKED": return "TABLE_FULL";
    case "UPDATE_REQUIRED": return "UPDATE_REQUIRED";
    case "KICKED": return "KICKED";
    default: return "ERROR";
  }
}

/** Error frames after which the guest must stop retrying (MatchClient itself only stops for some of them). */
export const GUEST_FATAL = new Set(["UNAUTHORIZED", "ROOM_LOCKED", "BAD_FRAME", "UPDATE_REQUIRED", "KICKED"]);

/* ───────────── buffering link ───────────── */

export interface Connected { readonly link: Link; readonly wire: (handlers: LinkHandlers) => void }
export const MAX_BUFFERED_SENDS = 16;
/** A deliberate close waits this long before destroying the socket so a final `Leave` frame can reach the host. */
export const CLOSE_GRACE_MS = 150;

/**
 * LinkFactory over an asynchronous connect. `linkSocket` reports "open" as soon as the factory returns, so the
 * Hello arrives while TCP is still connecting: sends are held (bounded) until it opens, then flushed in order.
 * `onClose` is delivered at most once, for a failed connect as well as an ended one.
 */
export function bufferedLink(connect: () => Promise<Connected>, graceMs = CLOSE_GRACE_MS): LinkFactory {
  return (handlers) => {
    const queue: string[] = [];
    let live: Link | null = null;
    let closed = false;
    const finish = () => { if (closed) return; closed = true; handlers.onClose(); };
    connect().then((c) => {
      if (closed) { c.link.close(); return; }
      live = c.link;
      c.wire({ onText: (t) => { if (!closed) handlers.onText(t); }, onClose: finish });
      for (const t of queue.splice(0)) c.link.send(t);
    }, finish);
    return {
      send: (t) => {
        if (closed) return;
        if (live) live.send(t);
        else if (queue.length < MAX_BUFFERED_SENDS) queue.push(t);
        else finish(); // a host that never opens must not make us hold an unbounded backlog
      },
      close: () => {
        const was = closed;
        closed = true;
        queue.length = 0;
        const l = live;
        if (l) setTimeout(() => l.close(), graceMs);
        if (!was) handlers.onClose();
      },
    };
  };
}
