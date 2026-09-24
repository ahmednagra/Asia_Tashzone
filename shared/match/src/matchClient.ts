/**
 * Online match client (03_PLATFORM.md §6). Transport-agnostic: pass a WebSocket factory
 * (React Native global WebSocket on device, `ws` in tests). Handles Hello, seed Ready,
 * gap-free view_seq, reconnect with last_view_seq, idempotent intent retries and resync.
 */
import type { SeatMove } from "@tashzone/engine";
import { viewHash } from "@tashzone/protocol";

export interface SocketLike {
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
}

export interface MatchClientOptions {
  readonly url: string;
  readonly joinToken: string;
  readonly engineBuildHash: string;
  readonly behaviourDigest: string;
  readonly versionCode: number;
  readonly socket: (url: string) => SocketLike;
  readonly randomSeed: () => string;
  readonly onState?: (s: ClientState) => void;
  readonly onMessage?: (m: any) => void;
  readonly backoffMs?: (attempt: number) => number;
  readonly maxRetries?: number;
  readonly random?: () => number;
}

export interface ClientState {
  status: "connecting" | "open" | "reconnecting" | "closed" | "update_required" | "offline";
  viewSeq: number;
  view: any;
  deadline: number | null;
  paused: boolean;
}

const FATAL = new Set(["UPDATE_REQUIRED", "UNAUTHORIZED", "KICKED", "OWNERSHIP_LOST", "MATCH_INTERRUPTED"]);
export const MAX_RECONNECTS = 10;

export function jitteredBackoff(attempt: number, random: () => number = Math.random): number {
  const cap = Math.min(8000, 250 * 2 ** attempt);
  return Math.round(cap / 2 + (cap / 2) * random());
}

export function parseServerFrame(data: unknown): { type: string; [k: string]: any } | null {
  let m: unknown;
  try { m = JSON.parse(String(data)); } catch { return null; }
  if (!m || typeof m !== "object" || Array.isArray(m) || typeof (m as { type?: unknown }).type !== "string") return null;
  const f = m as { type: string; [k: string]: any };
  switch (f.type) {
    case "TableSnapshot": return Number.isInteger(f.view_seq) && f.seat_view && typeof f.seat_view === "object" ? f : null;
    case "ViewEvents": return Number.isInteger(f.from_seq) && Number.isInteger(f.to_seq) && f.seat_view && typeof f.seat_view === "object" ? f : null;
    case "Error": return typeof f.code === "string" ? f : null;
    default: return f;
  }
}

export class MatchClient {
  readonly state: ClientState = { status: "connecting", viewSeq: 0, view: null, deadline: null, paused: false };
  private sock: SocketLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private stopped = false;
  private n = 0;
  private readonly pending = new Map<string, unknown>(); // intent_id → frame, resent after reconnect

  constructor(private readonly o: MatchClientOptions) {}

  connect(): void {
    if (this.state.status === "update_required") return;
    this.attempt = 0;
    if (this.state.status === "offline" || this.state.status === "closed") this.set({ status: this.state.viewSeq > 0 ? "reconnecting" : "connecting" });
    this.open();
  }

  private open(): void {
    this.clearTimer();
    this.detach();
    this.stopped = false;
    const s = this.o.socket(this.o.url);
    this.sock = s;
    s.onopen = () => {
      if (this.sock !== s) return;
      this.attempt = 0;
      const hello: Record<string, unknown> = {
        type: "Hello", protocol_min: 2, protocol_max: 2, version_code: this.o.versionCode,
        engine_build_hash: this.o.engineBuildHash, behaviour_digest: this.o.behaviourDigest,
        correlation_id: `c${Date.now().toString(36)}`, join_token: this.o.joinToken,
      };
      if (this.state.viewSeq > 0) hello.last_view_seq = this.state.viewSeq;
      s.send(JSON.stringify(hello));
      this.set({ status: "open" });
    };
    s.onmessage = (ev) => {
      if (this.sock !== s) return;
      const m = parseServerFrame(ev.data);
      if (m) this.onFrame(m);
    };
    s.onclose = () => {
      if (this.sock !== s) return;
      this.sock = null;
      if (this.stopped || this.state.status === "update_required" || this.state.status === "closed") return;
      if (this.attempt >= (this.o.maxRetries ?? MAX_RECONNECTS)) { this.set({ status: "offline" }); return; }
      this.set({ status: "reconnecting" });
      const wait = (this.o.backoffMs ?? ((a: number) => jitteredBackoff(a, this.o.random)))(this.attempt++);
      this.timer = setTimeout(() => { this.timer = null; if (!this.stopped) this.open(); }, wait);
    };
  }

  private detach(): void {
    const old = this.sock;
    this.sock = null;
    if (!old) return;
    old.onopen = null; old.onmessage = null; old.onclose = null;
    try { old.close(); } catch { return; }
  }

  private clearTimer(): void { if (this.timer) clearTimeout(this.timer); this.timer = null; }

  private onFrame(m: any): void {
    switch (m.type) {
      case "TableSnapshot":
        this.set({ view: m.seat_view, viewSeq: m.view_seq, deadline: m.deadline });
        this.flushPending();
        break;
      case "ViewEvents":
        if (m.from_seq !== this.state.viewSeq + 1) { this.send({ type: "RequestSnapshot", reason: "gap" }); return; }
        if (viewHash(m.seat_view) !== m.view_hash) { this.send({ type: "RequestSnapshot", reason: "hash_mismatch" }); return; }
        this.set({ view: m.seat_view, viewSeq: m.to_seq, deadline: m.deadline });
        break;
      case "IntentResult": this.pending.delete(m.intent_id); break;
      case "SeedRequest": this.send({ type: "Ready", hand_id: m.hand_id, client_seed: this.o.randomSeed() }); break;
      case "TablePaused": this.set({ paused: true }); break;
      case "TableResumed": this.set({ paused: false, deadline: m.deadline }); break;
      case "Error":
        if (m.code === "UPDATE_REQUIRED") { this.stopped = true; this.clearTimer(); this.set({ status: "update_required" }); this.sock?.close(); }
        else if (FATAL.has(m.code)) { this.stopped = true; this.clearTimer(); this.set({ status: "closed" }); }
        break;
      case "MatchEnded": this.stopped = true; this.clearTimer(); break;
    }
    this.o.onMessage?.(m);
  }

  /** Send a move for the current view; retried with the same intent id after a reconnect. */
  intent(action: SeatMove): string {
    if (!this.state.view?.hand) return "";
    const intent_id = `i${++this.n}-${Date.now().toString(36)}`;
    const frame = { type: "Intent", intent_id, hand_id: this.state.view.hand.hand_id, expected_view_seq: this.state.viewSeq, action };
    this.pending.set(intent_id, frame);
    this.send(frame);
    return intent_id;
  }

  private flushPending(): void {
    // after resync the view may have moved on; the server answers duplicates idempotently or STALE_VIEW
    for (const f of this.pending.values()) this.send(f);
  }

  send(m: unknown): void { try { this.sock?.send(JSON.stringify(m)); } catch { /* reconnect will resend */ } }
  start(): void { this.send({ type: "Start" }); }
  resumeControl(): void { this.send({ type: "ResumeControl" }); }
  leave(): void { this.stopped = true; this.clearTimer(); this.send({ type: "Leave" }); this.detach(); this.set({ status: "closed" }); }
  /** tests: drop the transport without leaving */
  dropTransport(): void { this.sock?.close(); }

  private set(p: Partial<ClientState>): void { Object.assign(this.state, p); this.o.onState?.(this.state); }
}
