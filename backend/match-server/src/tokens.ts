/**
 * Join tokens (C-17): issued by FastAPI, verified locally without an API call.
 * Format: base64url(JSON payload) "." base64url(HMAC-SHA-256(secret, "tz/join/v1." + payload_b64)).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface JoinClaims {
  readonly room: string;       // 6-character room code
  readonly player_id: string;
  readonly seat: number;       // assigned by FastAPI
  readonly name: string;
  readonly host: boolean;
  readonly free_text: boolean; // Parent Settings at issue time (C-29 NOTIFY refresh is Planned)
  readonly exp: number;        // unix seconds
  readonly profile_id: string; // validated room settings (C-22); re-validated by the match server
  readonly preset: string;
  readonly settings: Readonly<Record<string, boolean | number | string>>; // enum toggles are strings (variant, thulla)
}

const b64u = (b: Buffer) => b.toString("base64url");

export function signJoinToken(secret: string, claims: JoinClaims): string {
  const payload = b64u(Buffer.from(JSON.stringify(claims)));
  const sig = createHmac("sha256", secret).update("tz/join/v1." + payload).digest();
  return `${payload}.${b64u(sig)}`;
}

export function verifyJoinToken(secret: string, token: string, nowSec: number): JoinClaims | null {
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  const expect = createHmac("sha256", secret).update("tz/join/v1." + payload).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JoinClaims;
    if (typeof c.room !== "string" || !/^[A-Z0-9]{6}$/.test(c.room)) return null;
    if (!Number.isInteger(c.seat) || c.seat < 0 || c.seat > 7) return null; // Bhabhi seats up to 8; the room checks its own count
    if (typeof c.exp !== "number" || c.exp < nowSec) return null;
    return c;
  } catch {
    return null;
  }
}
