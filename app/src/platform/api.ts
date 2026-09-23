import { API_URL } from "./env";

export interface AppConfig {
  min_version_code: number;
  protocol: { min: number; max: number };
  engine_build_hash: string | null;
  behaviour_digests: Record<string, string>;
  match_url: string;
}
export interface JoinResponse { room_code: string; seat: number; match_url: string; join_token: string }

async function call<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  appConfig: () => call<AppConfig>("/api/v1/app-config"),
  register: (display_name: string) => call<{ player_id: string; token: string }>("/api/v1/players", { method: "POST", body: JSON.stringify({ display_name }) }),
  createRoom: (token: string, profile_id: string, settings: Record<string, unknown>, preset = "standard") =>
    call<JoinResponse>("/api/v1/rooms", { method: "POST", body: JSON.stringify({ profile_id, preset, settings }) }, token),
  joinRoom: (token: string, code: string) => call<JoinResponse>(`/api/v1/rooms/${code}/join`, { method: "POST" }, token),
};
