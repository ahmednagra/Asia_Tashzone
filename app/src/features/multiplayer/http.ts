/** Room/matchmaking HTTP. Keeps the API's stable error code (`{error:{code}}`), stores the guest token on the device, and bounds every call with a timeout. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../lib/env";
import type { AppConfig } from "../../types/api";
import type { JoinTicket, RoomView, TicketView } from "./types";

const ACCOUNT_KEY = "tashzone.online.account.v1";
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
      headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
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

let cached: string | null = null;

async function token(displayName: string, fresh = false): Promise<string> {
  if (!fresh) {
    if (cached) return cached;
    const saved = await AsyncStorage.getItem(ACCOUNT_KEY).catch(() => null);
    if (saved) return (cached = saved);
  }
  const me = await request<{ token: string }>("/api/v1/players", { method: "POST", body: { display_name: displayName.trim().slice(0, 40) || "Player" } });
  cached = me.token;
  AsyncStorage.setItem(ACCOUNT_KEY, me.token).catch(() => {});
  return me.token;
}

/** Runs an authenticated call; a rejected token (401) is replaced once with a fresh guest registration. */
async function authed<T>(displayName: string, fn: (t: string) => Promise<T>): Promise<T> {
  try {
    return await fn(await token(displayName));
  } catch (e) {
    if (!(e instanceof ApiFailure) || e.status !== 401) throw e;
    return fn(await token(displayName, true));
  }
}

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
