/** Room/matchmaking HTTP. Keeps the API's stable error code (`{error:{code}}`), stores the guest token on the device, and bounds every call with a timeout. */
import { DEVICE_NAME } from "../../lib/device";
import { API_URL } from "../../lib/env";
import { clearToken, forgetPendingLogout, readToken, rememberPendingLogout, sessionKind, takePendingLogout, writeToken } from "../../services/session";
import type { Provider, ProviderCredential } from "../../services/googleAuth";
import type { AppConfig, DeviceSession, LinkView, MeView, ProgressBody, ProgressView, RestoreView, SessionView } from "../../types/api";
import type { JoinTicket, RoomView, TicketView } from "./types";

const TIMEOUT_MS = 10_000;

export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET", signal: ctl.signal,
      headers: { "content-type": "application/json", ...(DEVICE_NAME ? { "x-device-name": DEVICE_NAME } : {}), ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
    if (!res.ok) throw new ApiFailure(res.status, json?.error?.code ?? "ERROR");
    return json as T;
  } catch (e) {
    if (e instanceof ApiFailure) throw e;
    throw new ApiFailure(0, "NETWORK");
  } finally {
    clearTimeout(timer);
  }
}

let guestProtected = true;

export function setGuestProtection(isProtected: boolean): void {
  guestProtected = isProtected;
}

async function registerGuest(displayName: string): Promise<string> {
  const body = { display_name: displayName.trim().slice(0, 40) || "Player", protected: guestProtected };
  const me = await request<{ token: string }>("/api/v1/players", { method: "POST", body });
  await writeToken(me.token, "guest");
  return me.token;
}

let pendingChecked = false;

async function flushPendingLogout(): Promise<void> {
  if (pendingChecked) return;
  pendingChecked = true;
  const stale = await takePendingLogout();
  if (!stale) return;
  try {
    await request<void>("/api/v1/auth/logout", { method: "POST", token: stale });
    await forgetPendingLogout();
  } catch (e) {
    if (e instanceof ApiFailure && e.status === 401) await forgetPendingLogout();
    else pendingChecked = false;
  }
}

async function token(displayName: string, fresh = false): Promise<string> {
  flushPendingLogout().catch(() => {});
  if (!fresh) {
    const saved = await readToken();
    if (saved) return saved;
  }
  return registerGuest(displayName);
}

async function authed<T>(displayName: string, fn: (t: string) => Promise<T>): Promise<T> {
  try {
    return await fn(await token(displayName));
  } catch (e) {
    if (!(e instanceof ApiFailure) || e.status !== 401 || e.code !== "UNAUTHORIZED") throw e;
    if ((await sessionKind()) === "account") {
      await clearToken();
      throw new ApiFailure(401, "SESSION_EXPIRED");
    }
    return fn(await token(displayName, true));
  }
}

export async function hasAccount(): Promise<boolean> {
  return !!(await readToken());
}

export async function adoptToken(next: string): Promise<void> {
  const previous = await readToken();
  await writeToken(next, "account");
  if (previous && previous !== next) request<void>("/api/v1/auth/logout", { method: "POST", token: previous }).catch(() => {});
}

export async function deleteServerProfile(): Promise<void> {
  const current = await readToken();
  if (!current) return;
  try {
    await request<void>("/api/v1/players/me", { method: "DELETE", token: current });
  } catch (e) {
    if (!(e instanceof ApiFailure) || e.status !== 401) throw e;
  }
  await clearToken();
}

export async function freshGuest(displayName: string): Promise<void> {
  await registerGuest(displayName);
}

export async function signOut(): Promise<void> {
  const current = await readToken();
  await clearToken();
  if (!current) return;
  try {
    await request<void>("/api/v1/auth/logout", { method: "POST", token: current });
  } catch (e) {
    if (!(e instanceof ApiFailure) || e.status !== 401) {
      await rememberPendingLogout(current);
      pendingChecked = false;
    }
  }
}

const identity = (c: ProviderCredential) => ({ provider: c.provider, id_token: c.idToken, ...(c.nonce ? { nonce: c.nonce } : {}) });

export const account = {
  me: (name: string) => authed(name, (t) => request<MeView>("/api/v1/players/me", { token: t })),
  updateMe: (name: string, body: { display_name?: string; avatar_id?: number }) =>
    authed(name, (t) => request<MeView>("/api/v1/players/me", { method: "PATCH", token: t, body })),
  link: (name: string, c: ProviderCredential) => authed(name, (t) => request<LinkView>("/api/v1/players/me/link", { method: "POST", token: t, body: identity(c) })),
  unlink: (name: string, provider: Provider) => authed(name, (t) => request<void>(`/api/v1/players/me/link/${provider}`, { method: "DELETE", token: t })),
  restore: (c: ProviderCredential) => request<RestoreView>("/api/v1/players/restore", { method: "POST", body: identity(c) }),
  progress: (name: string) => authed(name, (t) => request<ProgressView>("/api/v1/players/me/progress", { token: t })),
  requestCode: (email: string, purpose: "signup" | "login" | "reset", lang: string) =>
    request<{ sent: boolean }>("/api/v1/auth/email/code", { method: "POST", body: { email, purpose, lang } }),
  signup: (name: string, email: string, code: string, password: string) =>
    authed(name, (t) => request<SessionView>("/api/v1/auth/signup", { method: "POST", token: t, body: { email, code, password } })),
  login: (email: string, password: string) => request<SessionView>("/api/v1/auth/login", { method: "POST", body: { email, password } }),
  loginCode: (email: string, code: string) => request<SessionView>("/api/v1/auth/login/code", { method: "POST", body: { email, code } }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<SessionView>("/api/v1/auth/password/reset", { method: "POST", body: { email, code, new_password: newPassword } }),
  changePassword: (name: string, current: string, next: string) =>
    authed(name, (t) => request<SessionView>("/api/v1/auth/password", { method: "PUT", token: t, body: { current_password: current, new_password: next } })),
  sessions: (name: string) => authed(name, (t) => request<{ sessions: DeviceSession[] }>("/api/v1/auth/sessions", { token: t })),
  endSession: (name: string, id: string) => authed(name, (t) => request<void>(`/api/v1/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE", token: t })),
  signOutEverywhere: (name: string) => authed(name, (t) => request<SessionView>("/api/v1/auth/sign-out-everywhere", { method: "POST", token: t })),
  putProgress: (name: string, body: ProgressBody) => authed(name, (t) => request<ProgressView>("/api/v1/players/me/progress", { method: "PUT", token: t, body })),
};

export const online = {
  appConfig: () => request<AppConfig>("/api/v1/app-config"),
  createRoom: (name: string, profileId: string, preset: string, settings: Record<string, unknown>) =>
    authed(name, (t) => request<JoinTicket>("/api/v1/rooms", { method: "POST", token: t, body: { profile_id: profileId, preset, settings } })),
  joinRoom: (name: string, code: string) => authed(name, (t) => request<JoinTicket>(`/api/v1/rooms/${code}/join`, { method: "POST", token: t })),
  getRoom: (name: string, code: string) => authed(name, (t) => request<RoomView>(`/api/v1/rooms/${code}`, { token: t })),
  leaveRoom: (name: string, code: string) => authed(name, (t) => request<void>(`/api/v1/rooms/${code}/leave`, { method: "POST", token: t })),
  queue: (name: string, profileId: string, seats: number) =>
    authed(name, (t) => request<TicketView>("/api/v1/matchmaking/queue", { method: "POST", token: t, body: { profile_id: profileId, seats } })),
  ticket: (name: string) => authed(name, (t) => request<TicketView>("/api/v1/matchmaking/ticket", { token: t })),
  leaveQueue: (name: string) => authed(name, (t) => request<void>("/api/v1/matchmaking/queue", { method: "DELETE", token: t })),
};
