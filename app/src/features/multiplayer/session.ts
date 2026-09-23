/**
 * The one online session of this app (room, Quick Match or table). A module-level store so the room, wait,
 * table and match routes all see the same MatchClient. React reads it with `useOnlineSession`.
 * Bounded work: one socket, one 3 s lobby poll or one 2 s queue poll at a time, 10 s HTTP timeout.
 */
import { MatchClient, type ClientState, type MatchClientOptions, type SocketLike } from "@tashzone/match";
import type { SeatMove } from "@tashzone/engine";
import { VERSION_CODE } from "../../lib/env";
import { randomSeedHex } from "../../utils/random";
import type { AppConfig } from "../../types/api";
import { ApiFailure, online } from "./http";
import type { JoinTicket, WifiState } from "./types";
import type { MatchResult } from "./standings";

export type Phase = "idle" | "connecting" | "queued" | "lobby" | "playing" | "ended";
type Control = "human" | "handover" | "bot";

export interface SessionState {
  /** `online` = internet rooms and Quick Match, `wifi` = a same-network table (see wifiSession.ts). The screens are shared. */
  transport: "online" | "wifi";
  /** same-Wi-Fi only: PIN, QR, address and roster of the table this phone hosts or joined */
  wifi: WifiState | null;
  phase: Phase;
  profileId: string | null;
  roomCode: string | null;
  seat: number | null;
  isHost: boolean;
  seatCount: number;
  /** who is in the room right now (lobby poll); index = seat */
  members: (string | null)[];
  /** seat names as the table shows them */
  names: string[];
  conn: ClientState["status"] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: any;
  controls: readonly Control[] | undefined;
  deadline: number | null;
  paused: boolean;
  queue: { position: number | null; backfillIn: number } | null;
  ended: { outcome: "completed" | "interrupted"; result: MatchResult } | null;
  /** stable API/server error code of the last failure, shown by the screen that started the action */
  error: string | null;
  updateRequired: boolean;
}

const IDLE: SessionState = {
  transport: "online", wifi: null, phase: "idle", profileId: null, roomCode: null, seat: null, isHost: false, seatCount: 0, members: [], names: [], conn: null,
  view: null, controls: undefined, deadline: null, paused: false, queue: null, ended: null, error: null, updateRequired: false,
};

const LOBBY_POLL_MS = 3000;
const QUEUE_POLL_MS = 2000;
const FATAL = new Set(["UNAUTHORIZED", "KICKED", "OWNERSHIP_LOST"]);

let state: SessionState = IDLE;
const listeners = new Set<() => void>();
let client: MatchClient | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let run = 0;
let who = "Player";
let config: AppConfig | null = null;
/** Set by wifiSession: closes the table server, advertising, scanning and sockets of a same-Wi-Fi run. */
let extraTeardown: (() => void) | null = null;

function set(patch: Partial<SessionState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getSession = (): SessionState => state;
export function subscribeSession(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }

function stopTimer(): void { if (timer) clearInterval(timer); timer = null; }
const rnSocket = (url: string): SocketLike => new WebSocket(url) as unknown as SocketLike;
const codeOf = (e: unknown): string => (e instanceof ApiFailure ? e.code : "ERROR");

/** Tears everything down and starts a run; late answers from an older run are ignored via the returned check. */
function begin(name: string, transport: SessionState["transport"] = "online", onTeardown: (() => void) | null = null): () => boolean {
  teardown();
  who = name;
  const mine = ++run;
  extraTeardown = onTeardown;
  set({ ...IDLE, transport, phase: "connecting" });
  return () => mine === run;
}

function teardown(): void {
  run++;
  stopTimer();
  client?.leave();
  client = null;
  const extra = extraTeardown;
  extraTeardown = null;
  extra?.();
}

/** Same-Wi-Fi entry points (wifiSession.ts): start a run of the given transport, patch the store, stop it. */
export const beginRun = begin;
export const patchSession = set;
export const stopSession = teardown;
/** Ends a same-Wi-Fi run with a stable error code the screen shows; the transport stays `wifi` so the wifi screens own the message. */
export function failWifi(current: () => boolean, code: string): void {
  if (!current()) return;
  teardown();
  set({ ...IDLE, transport: "wifi", error: code });
}

function fail(current: () => boolean, e: unknown): void {
  if (!current()) return;
  stopTimer();
  set({ ...IDLE, error: codeOf(e) });
}

export async function createRoom(o: { name: string; profileId: string; preset: string; settings: Record<string, unknown> }): Promise<boolean> {
  const current = begin(o.name);
  try {
    const ticket = await online.createRoom(o.name, o.profileId, o.preset, o.settings);
    if (!current()) return false;
    await attach(ticket, o.profileId, current);
    return true;
  } catch (e) { fail(current, e); return false; }
}

export async function joinRoom(o: { name: string; code: string }): Promise<boolean> {
  const current = begin(o.name);
  try {
    const ticket = await online.joinRoom(o.name, o.code);
    if (!current()) return false;
    await attach(ticket, ticket.room.profile_id, current);
    return true;
  } catch (e) { fail(current, e); return false; }
}

export async function quickMatch(o: { name: string; profileId: string; seats: number }): Promise<boolean> {
  const current = begin(o.name);
  try {
    const first = await online.queue(o.name, o.profileId, o.seats);
    if (!current()) return false;
    set({ phase: "queued", profileId: o.profileId, seatCount: o.seats });
    const handle = async (t: typeof first): Promise<void> => {
      if (!current()) return;
      if (t.status === "matched" && "join" in t) { stopTimer(); await attach(t.join, o.profileId, current); }
      else if (t.status === "waiting" && "position" in t) set({ queue: { position: t.position, backfillIn: t.bot_backfill_in_seconds } });
      else { stopTimer(); set({ ...IDLE, error: "TICKET_EXPIRED" }); }
    };
    await handle(first);
    if (current() && state.phase === "queued") {
      let busy = false;
      timer = setInterval(() => {
        if (busy) return;
        busy = true;
        online.ticket(o.name).then(handle).catch((e) => { if (e instanceof ApiFailure && e.status !== 0) fail(current, e); }).finally(() => { busy = false; });
      }, QUEUE_POLL_MS);
    }
    return true;
  } catch (e) { fail(current, e); return false; }
}

async function attach(t: JoinTicket, profileId: string, current: () => boolean): Promise<void> {
  config ??= await online.appConfig();
  if (!current()) return;
  const cfg = config;
  const members = Array.from({ length: t.room.seats }, (_, seat) => t.room.members.find((m) => m.seat === seat)?.display_name ?? null);
  set({ phase: "lobby", profileId, roomCode: t.room_code, seat: t.seat, isHost: t.room.host_seat === t.seat, seatCount: t.room.seats, members, queue: null });
  startClient(current, {
    url: t.match_url, joinToken: t.join_token, engineBuildHash: cfg.engine_build_hash ?? "",
    behaviourDigest: cfg.behaviour_digests[profileId] ?? "", socket: rnSocket,
  });
  pollLobby(t.room_code, current);
}

type ClientBase = Pick<MatchClientOptions, "url" | "joinToken" | "engineBuildHash" | "behaviourDigest" | "socket">;

/**
 * Creates the run's MatchClient, feeds the store from it and connects. Shared by online rooms and same-Wi-Fi tables
 * so the wait, table and summary screens read one shape. `extra` sees every state/message first-hand (same-Wi-Fi
 * uses it for join outcomes and the host-gone timer); it runs only while this run is current.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function startClient(current: () => boolean, base: ClientBase, extra?: { onState?: (s: ClientState) => void; onMessage?: (m: any) => void }): MatchClient {
  const m: MatchClient = new MatchClient({
    ...base, versionCode: VERSION_CODE, randomSeed: randomSeedHex,
    onState: (st) => {
      if (!current() || client !== m) return;
      set({ conn: st.status, view: st.view, deadline: st.deadline, paused: st.paused, updateRequired: st.status === "update_required",
        phase: state.ended ? "ended" : st.view?.hand ? "playing" : state.phase === "playing" ? "playing" : state.phase === "connecting" && state.transport === "wifi" ? "connecting" : "lobby" });
      extra?.onState?.(st);
    },
    onMessage: (msg) => {
      if (!current() || client !== m) return;
      switch (msg.type) {
        case "TableSnapshot":
          set({ names: msg.table_meta.seats.map((x: { name: string }) => x.name), controls: msg.seat_controls });
          // A same-Wi-Fi guest learns the table from its first snapshot: game, own seat and who is seated.
          if (state.transport === "wifi") {
            set({ profileId: msg.table_meta.profile_id, seat: msg.table_meta.you, seatCount: msg.table_meta.seats.length,
              members: msg.table_meta.seats.map((x: { name: string; kind: string }) => (x.kind === "human" ? x.name : null)) });
          }
          break;
        case "SeatControlChanged": set({ controls: (state.controls ?? []).map((c, i) => (i === msg.seat ? msg.control : c)) }); break;
        case "HostChanged": set({ isHost: msg.seat === state.seat }); break;
        case "MatchEnded": stopTimer(); set({ phase: "ended", ended: { outcome: msg.outcome, result: msg.result as MatchResult } }); break;
        case "Error":
          if (state.transport === "online" && FATAL.has(msg.code)) { stopTimer(); set({ phase: "idle", error: msg.code }); }
          else if (msg.code === "MATCH_INTERRUPTED") set({ phase: "ended", ended: { outcome: "interrupted", result: {} } });
          break;
      }
      extra?.onMessage?.(msg);
    },
  });
  client = m;
  m.connect();
  return m;
}

/** Lobby roster: the match server only sends snapshots on connect, so names of late joiners come from the room endpoint. */
function pollLobby(code: string, current: () => boolean): void {
  let busy = false;
  stopTimer();
  timer = setInterval(() => {
    if (busy || !current() || state.phase !== "lobby") { if (state.phase !== "lobby") stopTimer(); return; }
    busy = true;
    online.getRoom(who, code).then((r) => {
      if (!current()) return;
      set({ seatCount: r.seats, isHost: r.host_seat === state.seat, members: Array.from({ length: r.seats }, (_, seat) => r.members.find((x) => x.seat === seat)?.display_name ?? null) });
    }).catch(() => { /* transient: the next tick retries; reconnect state shows on the client */ }).finally(() => { busy = false; });
  }, LOBBY_POLL_MS);
}

export function startTable(): void { client?.start(); }
export function sendMove(move: SeatMove): void { client?.intent(move); }
export function retryConnection(): void { client?.connect(); }
export function clearError(): void { if (state.error) set({ error: null }); }

/** Leave whatever is running. In a lobby the seat is released on the server; at a live table a bot takes over (MatchClient.leave). */
export function leaveSession(): void {
  const { phase, roomCode, queue, transport } = state;
  const name = who;
  if (transport === "online") {
    if (phase === "lobby" && roomCode) online.leaveRoom(name, roomCode).catch(() => {});
    if (phase === "queued" || queue) online.leaveQueue(name).catch(() => {});
  }
  teardown();
  set({ ...IDLE });
}
