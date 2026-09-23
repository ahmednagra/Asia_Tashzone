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
}

export interface ClientState {
  status: "connecting" | "open" | "reconnecting" | "closed" | "update_required";
  viewSeq: number;
  view: any;
  deadline: number | null;
  paused: boolean;
}

const FATAL = new Set(["UPDATE_REQUIRED", "UNAUTHORIZED", "KICKED", "OWNERSHIP_LOST", "MATCH_INTERRUPTED"]);

export class MatchClient {
  readonly state: ClientState = { status: "connecting", viewSeq: 0, view: null, deadline: null, paused: false };
  private sock: SocketLike | null = null;
  private attempt = 0;
  private stopped = false;
  private n = 0;
  private readonly pending = new Map<string, unknown>(); // intent_id → frame, resent after reconnect

  constructor(private readonly o: MatchClientOptions) {}

  connect(): void {
    this.stopped = false;
    const s = this.o.socket(this.o.url);
    this.sock = s;
    s.onopen = () => {
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
    s.onmessage = (ev) => this.onFrame(JSON.parse(String(ev.data)));
    s.onclose = () => {
      if (this.stopped || this.state.status === "update_required" || this.state.status === "closed") return;
      this.set({ status: "reconnecting" });
      const wait = (this.o.backoffMs ?? ((a) => Math.min(8000, 250 * 2 ** a)))(this.attempt++);
      setTimeout(() => { if (!this.stopped) this.connect(); }, wait);
    };
  }

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
        if (m.code === "UPDATE_REQUIRED") { this.stopped = true; this.set({ status: "update_required" }); this.sock?.close(); }
        else if (FATAL.has(m.code)) { this.stopped = true; this.set({ status: "closed" }); }
        break;
      case "MatchEnded": this.stopped = true; break;
    }
    this.o.onMessage?.(m);
  }

  /** Send a move for the current view; retried with the same intent id after a reconnect. */
  intent(action: SeatMove): string {
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
  leave(): void { this.stopped = true; this.send({ type: "Leave" }); this.sock?.close(); this.set({ status: "closed" }); }
  /** tests: drop the transport without leaving */
  dropTransport(): void { this.sock?.close(); }

  private set(p: Partial<ClientState>): void { Object.assign(this.state, p); this.o.onState?.(this.state); }
}
