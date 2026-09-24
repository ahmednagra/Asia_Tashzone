import { ApiFailure } from "../multiplayer/http";
import { A } from "./copy";

const BY_CODE: Record<string, () => string> = {
  NETWORK: () => A.errOffline,
  INVALID_CODE: () => A.errInvalidCode,
  INVALID_CREDENTIALS: () => A.errCredentials,
  EMAIL_TAKEN: () => A.errTaken,
  ACCOUNT_EXISTS: () => A.errExists,
  PROTECTED_NO_EMAIL: () => A.errProtected,
  RATE_LIMITED: () => A.errRate,
  EMAIL_NOT_CONFIGURED: () => A.errUnavailable,
  FEATURE_DISABLED: () => A.errUnavailable,
  ONLINE_DISABLED: () => A.errUnavailable,
  ACCOUNT_BANNED: () => A.errBanned,
  SESSION_EXPIRED: () => A.errExpired,
  WEAK_PASSWORD: () => A.errPassword,
};

export function authMessage(e: unknown, changingPassword = false): string {
  if (!(e instanceof ApiFailure)) return A.errFailed;
  if (changingPassword && e.code === "INVALID_CREDENTIALS") return A.errCurrent;
  return (BY_CODE[e.code] ?? (() => A.errFailed))();
}
