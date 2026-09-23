/**
 * Runtime Shell for one room (02_ENGINE.md §1, §3, §5; 03_PLATFORM.md §6).
 * Invariants:
 *  - one command queue per room; order = server_seq; wall-clock never decides game state
 *  - every accepted action is journaled (epoch-checked) before any derived event is published
 *  - each viewer receives only its projection as a gap-free view_seq; nothing is sent to a viewer
 *    whose projection did not change (so hidden actions cannot be inferred from traffic timing)
 *  - intents are idempotent by (seat, hand_id, intent_id)
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import {
  type Action, type BaseView, type EngineEvent, type GameModule, type InputRecord, type SeatMove, type Viewer,
  GENESIS, deriveHandSeed, gameOfProfile, getModule, hashCanonical, recordHash, seedCommitment, stateHash,
} from "@tashzone/engine";
import { chooseMove } from "@tashzone/engine";
import { type SeatControl, type ServerMessage, type TableMeta, viewHash } from "@tashzone/protocol";
import { guardPayload } from "./guard.js";
import { type IncidentLog, type JournalStore, type RoomDirectory, StaleEpochError } from "./stores.js";

export interface Conn { send(text: string): void; close(code?: number, reason?: string): void }

export interface RoomDeps {
  readonly journal: JournalStore;
  readonly directory: RoomDirectory;
  readonly incidents: IncidentLog;
  readonly results: (report: MatchReport) => Promise<void>;
  /** Tells FastAPI play has begun so the room stops accepting joins (v1 /internal/rooms/{code}/started). */
  readonly started?: (room: string) => Promise<void>;
  /** CSPRNG bytes as lowercase hex (Node crypto on the server, expo-crypto on a phone). Room never calls a global RNG. */
  readonly randomHex: (bytes: number) => string;
  /** Encrypts a hand's server seed at rest until it is sealed (T-18); the aad binds it to the hand id. */
  readonly sealSeed: (seedHex: string, aad: string) => string;
  readonly engineBuildHash: string;
  readonly instanceId: string;
  readonly timing: {
    readonly seedWaitMs: number; readonly botDelayMs: number; readonly interHandMs: number;
    readonly leaseMs: number; readonly renewMs: number; readonly marginMs: number;
    readonly turnMsOverride: number | null; readonly windowMsOverride: number | null;
  };
  readonly now?: () => number;
}

/** Reported once per match through `RoomDeps.results`. */
export interface MatchReport {
  readonly match_id: string; readonly room: string; readonly epoch: number; readonly profile_id: string;
  readonly effective_profile_hash: string; readonly engine_build_hash: string; readonly outcome: "completed" | "interrupted";
  readonly totals: readonly number[]; readonly placements: readonly number[] | null;
  readonly players: readonly (string | null)[]; readonly bot_seats: readonly number[]; readonly sealed_hand_ids: readonly string[];
}

interface Slot {
  kind: "human" | "bot";
  name: string;
  playerId: string | null;
  host: boolean;
  conn: Conn | null;
  control: SeatControl;
  timeouts: number;
  viewSeq: number;
  lastViewHash: string | null;
  outbox: { seq: number; text: string }[];
}

interface HandCtx {
  handId: string;
  serverSeed: string;
  commitment: string;
  clientSeeds: (string | null)[];
  finalized: boolean;
  prevHash: string;
}

const OUTBOX = 512;

export class Room {
  readonly slots: Slot[];
  /** The game this room plays, from its profile (Callbreak / Call Bridge, Court Piece, Bhabhi). */
  readonly module: GameModule;
  readonly seats: number;
   
  state: any;
  status: "lobby" | "playing" | "ended" | "fenced" = "lobby";
  paused = false;
  private serverSeq = 0;
  private handSeq = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly intents = new Map<string, Promise<Extract<ServerMessage, { type: "IntentResult" }>>>();
  private hand: HandCtx | null = null;
  private deadline: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seedTimer: ReturnType<typeof setTimeout> | null = null;
  private leaseTimer: ReturnType<typeof setInterval> | null = null;
  private lastRenewOk: number;
  private stopAtBoundary = false;
  private readonly sealed: string[] = [];
  private readonly now: () => number;
  readonly matchId: string;

  constructor(
    readonly code: string,
    readonly epoch: number,
     
    readonly rules: any,
    readonly effectiveProfileHash: string,
    private readonly deps: RoomDeps,
  ) {
    this.now = deps.now ?? (() => Date.now());
    this.module = getModule(gameOfProfile(rules.profile_id));
    this.seats = this.module.seatCount(rules);
    this.state = this.module.initialState(rules);
    this.matchId = `${code}-${epoch}`;
    this.lastRenewOk = this.now();
    this.slots = Array.from({ length: this.seats }, (_, i) => ({
      kind: "bot", name: `Bot ${i + 1}`, playerId: null, host: false, conn: null, control: "bot",
      timeouts: 0, viewSeq: 0, lastViewHash: null, outbox: [],
    }));
    this.startLeaseLoop();
  }

  /* ───────────── connections ───────────── */

  join(seat: number, playerId: string, name: string, host: boolean, conn: Conn, lastViewSeq: number | undefined): void {
    const s = this.slots[seat]!;
    if (s.playerId && s.playerId !== playerId) { conn.close(4009, "seat taken"); return; }
    if (s.conn && s.conn !== conn) s.conn.close(4001, "superseded"); // a second connection supersedes the first
    const wasBot = s.kind === "bot";
    s.conn = conn;
    if (this.status === "lobby" || s.playerId === playerId) {
      s.kind = "human"; s.playerId = playerId; s.name = name; s.host = host;
      if (wasBot && this.status === "lobby") s.control = "human";
    }
    this.deps.incidents.record("connect", { room: this.code, seat, resume: lastViewSeq !== undefined });
    this.send(seat, { type: "Welcome", protocol: 2, server_time: this.now(), session: `${this.matchId}:${seat}` });
    this.resync(seat, lastViewSeq);
    this.broadcast({ type: "PresenceChanged", seat, online: true });
  }

  disconnect(conn: Conn): void {
    const seat = this.slots.findIndex((s) => s.conn === conn);
    if (seat < 0) return;
    this.slots[seat]!.conn = null;
    this.deps.incidents.record("disconnect", { room: this.code, seat });
    this.broadcast({ type: "PresenceChanged", seat, online: false });
  }

  /** Reconnect: missing batches from the outbox, else a snapshot (§6.6). */
  private resync(seat: number, lastViewSeq: number | undefined): void {
    const s = this.slots[seat]!;
    if (lastViewSeq !== undefined && lastViewSeq <= s.viewSeq) {
      const missing = s.outbox.filter((b) => b.seq > lastViewSeq);
      const covered = lastViewSeq === s.viewSeq || (missing.length > 0 && missing[0]!.seq === lastViewSeq + 1);
      if (covered) { for (const b of missing) s.conn?.send(b.text); return; }
    }
    this.deps.incidents.record("resync", { room: this.code, seat, kind: "snapshot" });
    this.sendSnapshot(seat);
  }

  sendSnapshot(seat: number): void {
    const s = this.slots[seat]!;
    const viewer: Viewer = { kind: "seat", seat };
    const view = this.module.project(this.state, viewer);
    const vh = viewHash(view);
    s.lastViewHash = vh;
    const payload = JSON.stringify(view);
    if (!guardPayload(payload, this.module.visibleCardIds(this.state, viewer))) { this.guardViolation(seat); return; }
    this.send(seat, {
      type: "TableSnapshot", view_seq: s.viewSeq, view_hash: vh, seat_view: view, table_meta: this.meta(seat),
      waiting_on: view.waiting, deadline: this.deadline, seat_controls: this.slots.map((x) => x.control),
      commitment: this.hand && !this.hand.finalized ? this.hand.commitment : null,
    });
  }

  private meta(seat: number | null): TableMeta {
    return {
      room: this.code, profile_id: this.rules.profile_id, effective_profile_hash: this.effectiveProfileHash,
      engine_build_hash: this.deps.engineBuildHash,
      seats: this.slots.map((s, i) => ({ seat: i, name: s.name, kind: s.kind })), you: seat,
    };
  }

  /* ───────────── lifecycle ───────────── */

  start(seat: number): boolean {
    if (this.status !== "lobby" || !this.slots[seat]!.host) return false;
    this.status = "playing";
    for (const s of this.slots) if (s.kind === "bot") s.control = "bot";
    for (let i = 0; i < this.seats; i++) this.sendSnapshot(i);
    void this.deps.started?.(this.code).catch(() => undefined); // never blocks the table
    void this.beginHand();
    return true;
  }

  /** Seed first (§3 rule 1): persist encrypted seed + commitment, then request client seeds. */
  private async beginHand(): Promise<void> {
    if (this.status !== "playing") return;
    if (this.stopAtBoundary) { await this.endMatch("interrupted"); return; }
    this.handSeq += 1;
    const handId = `${this.matchId}-h${this.handSeq}`;
    const serverSeed = this.deps.randomHex(32);
    const commitment = seedCommitment(serverSeed, handId);
    try {
      await this.deps.journal.persistHandStart(this.code, this.epoch, handId, commitment, this.deps.sealSeed(serverSeed, handId));
    } catch (e) {
      if (e instanceof StaleEpochError) { this.fence(); return; }
      this.pause("commit_failure");
      setTimeout(() => { this.handSeq -= 1; void this.beginHand(); }, 1000);
      return;
    }
    this.hand = { handId, serverSeed, commitment, clientSeeds: Array.from({ length: this.seats }, () => null), finalized: false, prevHash: GENESIS };
    for (let i = 0; i < this.seats; i++) if (this.slots[i]!.kind === "human") this.send(i, { type: "SeedRequest", hand_id: handId, commitment });
    this.seedTimer = setTimeout(() => void this.finalizeSeeds(), this.deps.timing.seedWaitMs);
    if (this.slots.every((s) => s.kind === "bot" || !s.conn)) { clearTimeout(this.seedTimer); void this.finalizeSeeds(); }
  }

  ready(seat: number, handId: string, clientSeed: string): void {
    const h = this.hand;
    if (!h || h.finalized || h.handId !== handId || h.clientSeeds[seat] !== null) return;
    h.clientSeeds[seat] = clientSeed;
    const waiting = this.slots.some((s, i) => s.kind === "human" && s.conn && h.clientSeeds[i] === null);
    if (!waiting) { if (this.seedTimer) clearTimeout(this.seedTimer); void this.finalizeSeeds(); }
  }

  private async finalizeSeeds(): Promise<void> {
    const h = this.hand;
    if (!h || h.finalized) return;
    h.finalized = true;
    const substituted: number[] = [];
    const seeds = h.clientSeeds.map((c, i) => {
      if (c) return c;
      substituted.push(i); // bots and missing replies are substituted and flagged (RNG-04)
      return bytesToHex(hmac(sha256, hexToBytes(h.serverSeed), utf8ToBytes(`tz/substitute/v1/${h.handId}/${i}`)));
    });
    h.clientSeeds = seeds;
    (h as HandCtx & { substituted?: number[] }).substituted = substituted;
    const handSeed = deriveHandSeed(h.serverSeed, h.handId, seeds);
    await this.commit({ t: "BeginHand", actor: "system", hand_id: h.handId, hand_seed: handSeed }, "system", null);
  }

  /* ───────────── intents ───────────── */

  async intent(seat: number, intentId: string, handId: string, expectedViewSeq: number, move: SeatMove): Promise<void> {
    const key = `${seat}|${handId}|${intentId}`;
    // duplicates (including ones arriving while the first is still committing) get the committed outcome (§3 rule 6)
    let p = this.intents.get(key);
    if (!p) {
      p = this.decide(seat, intentId, handId, expectedViewSeq, move);
      this.intents.set(key, p);
      if (this.intents.size > 4096) this.intents.delete(this.intents.keys().next().value!);
    }
    const m = await p;
    if (!m.accepted && (m.reject_code === "STALE_VIEW" || m.reject_code === "TABLE_PAUSED" || m.reject_code === "NOT_NOW")) {
      this.intents.delete(key); // transient refusals may be retried with the same intent id
    }
    this.send(seat, m);
  }

  private async decide(seat: number, intentId: string, handId: string, expectedViewSeq: number, move: SeatMove): Promise<Extract<ServerMessage, { type: "IntentResult" }>> {
    const s = this.slots[seat]!;
    const no = (code: string) => ({ type: "IntentResult" as const, intent_id: intentId, accepted: false, reject_code: code });
    if (this.status !== "playing" || this.paused) return no(this.paused ? "TABLE_PAUSED" : "NOT_NOW");
    if (s.control !== "human") return no("NOT_NOW");
    if (expectedViewSeq !== s.viewSeq) return no("STALE_VIEW");
    if (this.module.handInfo(this.state)?.hand_id !== handId) return no("WRONG_HAND");
    const r = await this.commit(this.module.toAction(move, seat, handId), "human", intentId);
    if (r.ok) { s.timeouts = 0; return { type: "IntentResult", intent_id: intentId, accepted: true, server_seq: r.seq }; }
    this.deps.incidents.record("reject", { room: this.code, seat, code: r.code });
    return no(r.code);
  }

  resumeControl(seat: number): void {
    const s = this.slots[seat]!;
    if (s.kind !== "human" || s.control === "human") return;
    s.control = "human"; s.timeouts = 0; // control returns at the next decision
    this.broadcast({ type: "SeatControlChanged", seat, control: "human" });
  }

  leave(seat: number): void {
    const s = this.slots[seat]!;
    s.conn?.close(1000, "left");
    s.conn = null;
    if (this.status === "lobby") { Object.assign(s, { kind: "bot", playerId: null, name: `Bot ${seat + 1}`, control: "bot" }); return; }
    s.kind = "bot"; s.control = "bot"; // replaced by a bot for the rest of the match
    this.broadcast({ type: "SeatControlChanged", seat, control: "bot" });
    this.reschedule();
  }

  /* ───────────── commit → publish ───────────── */

  /** Serialised through the room queue. Journal first, then swap, then publish. */
  commit(action: Action, origin: InputRecord["origin"], intentId: string | null): Promise<{ ok: true; seq: number } | { ok: false; code: string }> {
    const run = async (): Promise<{ ok: true; seq: number } | { ok: false; code: string }> => {
      if (this.status === "fenced" || this.status === "ended") return { ok: false, code: "NOT_NOW" };
      const r = this.module.step(this.state, action);
      if (!r.ok) return { ok: false, code: r.code };
      const h = this.hand!;
      const record: InputRecord = {
        hand_id: action.hand_id, server_seq: this.serverSeq + 1, epoch: this.epoch, intent_id: intentId,
        actor: action.actor, origin, action, prev_hash: h.prevHash, state_hash: stateHash(r.state),
      };
      for (let attempt = 0; ; attempt++) {
        try { await this.deps.journal.append(this.code, this.epoch, record); break; }
        catch (e) {
          if (e instanceof StaleEpochError) { this.fence(); return { ok: false, code: "OWNERSHIP_LOST" }; }
          if (!this.paused) this.pause("commit_failure");
          await new Promise((res) => setTimeout(res, Math.min(2000, 50 * 2 ** attempt)));
        }
      }
      if (this.paused) this.resume();
      this.serverSeq += 1;
      h.prevHash = recordHash(record);
      this.state = r.state;
      this.publish(r.events);
      if (origin === "handover" && typeof action.actor === "number") {
        const s = this.slots[action.actor]!;
        if (s.kind === "human" && s.timeouts < 2) { s.control = "human"; this.broadcast({ type: "SeatControlChanged", seat: action.actor, control: "human" }); }
      }
      await this.afterStep(r.events);
      return { ok: true, seq: this.serverSeq };
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  private publish(events: readonly EngineEvent[]): void {
    const w = this.module.waitingOn(this.state);
    // a deadline is set when a turn or window begins and is otherwise stable (a sealed request never moves it)
    const begins = events.some((e) => e.t === "WindowOpened" || e.t === "CallTurn" || e.t === "PlayTurn");
    if (w.mode === "TURN" || w.mode === "WINDOW") { if (begins || this.deadline === null) this.deadline = this.computeDeadline(w.mode); }
    else this.deadline = null;
    for (let seat = 0; seat < this.seats; seat++) {
      const s = this.slots[seat]!;
      const viewer: Viewer = { kind: s.control === "handover" ? "handover_bot" : "seat", seat } as Viewer;
      const seatViewer: Viewer = { kind: "seat", seat };
      const view = this.module.project(this.state, seatViewer);
      const vh = viewHash(view);
      const pe = this.module.projectEvents(events, viewer);
      if (pe.length === 0 && vh === s.lastViewHash) continue;
      const payload = JSON.stringify({ pe, view });
      if (!guardPayload(payload, this.module.visibleCardIds(this.state, seatViewer))) { this.guardViolation(seat); return; }
      s.viewSeq += 1;
      s.lastViewHash = vh;
      const msg: ServerMessage & { seat_view: unknown } = {
        type: "ViewEvents", from_seq: s.viewSeq, to_seq: s.viewSeq, events: pe, view_hash: vh,
        waiting_on: view.waiting, deadline: this.deadline, seat_view: view,
      };
      const text = JSON.stringify(msg);
      s.outbox.push({ seq: s.viewSeq, text });
      if (s.outbox.length > OUTBOX) s.outbox.shift();
      s.conn?.send(text);
    }
  }

  private computeDeadline(mode: "TURN" | "WINDOW"): number {
    const t = this.deps.timing;
    const ms = mode === "WINDOW" ? t.windowMsOverride ?? this.rules.window_ms : t.turnMsOverride ?? this.rules.turn_ms;
    return this.now() + ms;
  }

  /* ───────────── scheduling: deadlines, bots, windows ───────────── */

  private clearTimer(): void { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  private async afterStep(events: readonly EngineEvent[]): Promise<void> {
    const w = this.module.waitingOn(this.state);
    if (w.mode === "WINDOW") {
      // P-16 hidden eligibility: the close timer is set once at open and never cleared early
      if (!events.some((e) => e.t === "WindowOpened")) return;
      this.clearTimer();
      const handId = this.module.handInfo(this.state)!.hand_id;
      const ms = Math.max(0, (this.deadline ?? this.now()) - this.now());
      this.timer = setTimeout(() => void this.commit({ t: "CloseWindow", actor: "system", hand_id: handId }, "system", null), ms);
      for (let seat = 0; seat < this.seats; seat++) {
        if (this.slots[seat]!.control === "human") continue;
        const m = this.botMove({ kind: "seat", seat });
        if (m && m.t === "RequestRedeal") void this.commit(this.module.toAction(m, seat, handId), "bot", null);
      }
      return;
    }
    this.clearTimer();
    if (w.mode === "AUTO" || w.mode === "NONE") {
      await this.sealHand();
      if (this.module.summary(this.state).over) { await this.endMatch("completed"); return; }
      this.timer = setTimeout(() => void this.beginHand(), this.deps.timing.interHandMs);
      return;
    }
    this.reschedule();
  }

  /** Schedule the next TURN: bots/hand-over act after pacing; humans get a deadline. */
  private reschedule(): void {
    if (this.status !== "playing" || this.paused) return;
    const w = this.module.waitingOn(this.state);
    if (w.mode !== "TURN") return;
    this.clearTimer();
    const seat = w.seats[0]!;
    const s = this.slots[seat]!;
    const handId = this.module.handInfo(this.state)!.hand_id;
    if (s.control !== "human") {
      const origin = s.kind === "bot" ? "bot" : "handover";
      this.timer = setTimeout(() => {
        const viewer: Viewer = origin === "bot" ? { kind: "seat", seat } : { kind: "handover_bot", seat };
        const m = this.botMove(viewer);
        if (m) void this.commit(this.module.toAction(m, seat, handId), origin, null);
      }, this.deps.timing.botDelayMs);
      return;
    }
    const ms = Math.max(0, (this.deadline ?? this.computeDeadline("TURN")) - this.now());
    this.timer = setTimeout(() => void this.turnTimeout(seat, handId), ms);
  }

  /** Bots and hand-over bots play Medium (v1 replacement level) from the seat's own view; deterministic seed. */
  private botMove(viewer: Viewer): SeatMove | null {
    const view = this.module.project(this.state, viewer) as BaseView;
    const seat = "seat" in viewer ? viewer.seat : 0;
    return chooseMove(this.module, view, "medium", `${this.matchId}/${this.serverSeq}/${seat}`);
  }

  /** TURN deadline → logged Timeout → hand-over bot on the seat's SeatView (§5). */
  private async turnTimeout(seat: number, handId: string): Promise<void> {
    const s = this.slots[seat]!;
    s.timeouts += 1;
    s.control = "handover";
    this.broadcast({ type: "SeatControlChanged", seat, control: "handover" });
    const r = await this.commit({ t: "Timeout", actor: "system", hand_id: handId, seat }, "system", null);
    if (!r.ok) { s.control = "human"; }
  }

  /* ───────────── seal, end, pause, fence, drain ───────────── */

  private async sealHand(): Promise<void> {
    const h = this.hand;
    const st = this.module.handInfo(this.state);
    if (!h || !st || !st.done || this.sealed.includes(h.handId)) return;
    const done = (this.state.match.history ?? this.state.match.results ?? []) as { hand_id: string }[];
    const summary = done.find((x) => x.hand_id === h.handId) ?? null;
    const record = {
      hand_id: h.handId, server_seed: h.serverSeed, client_seeds: h.clientSeeds as string[],
      substituted: (h as HandCtx & { substituted?: number[] }).substituted ?? [], commitment: h.commitment,
      chain_root: h.prevHash, result: { annulled: st.annulled, summary }, match_state_digest: hashCanonical(this.state.match),
    };
    try { await this.deps.journal.seal(this.code, this.epoch, record); }
    catch (e) { if (e instanceof StaleEpochError) { this.fence(); return; } throw e; }
    this.sealed.push(h.handId);
    this.broadcast({ type: "HandSealed", hand_id: h.handId, verification_record: record });
  }

  private async endMatch(outcome: "completed" | "interrupted"): Promise<void> {
    if (this.status === "ended") return;
    this.status = "ended";
    this.clearTimer();
    const m = this.module.summary(this.state);
    const result = { game: this.module.id, totals: m.totals, placements: m.placements };
    this.broadcast({ type: "MatchEnded", result, outcome });
    const report: MatchReport = {
      match_id: this.matchId, room: this.code, epoch: this.epoch, profile_id: this.rules.profile_id,
      effective_profile_hash: this.effectiveProfileHash, engine_build_hash: this.deps.engineBuildHash, outcome,
      totals: m.totals, placements: outcome === "completed" ? m.placements : null,
      players: this.slots.map((s) => s.playerId), bot_seats: this.slots.flatMap((s, i) => (s.kind === "bot" ? [i] : [])),
      sealed_hand_ids: this.sealed.slice(),
    };
    try { await this.deps.results(report); } catch { /* retried by the sink; never blocks the table */ }
    this.stopLease();
    await this.deps.directory.release(this.code, this.epoch).catch(() => undefined);
  }

  private pause(reason: string): void {
    this.paused = true;
    this.clearTimer();
    this.deps.incidents.record("pause", { room: this.code, reason });
    this.broadcast({ type: "TablePaused", reason });
  }

  private resume(): void {
    this.paused = false;
    // deadlines restart in full after a pause (§3 rule 9)
    const w = this.module.waitingOn(this.state);
    this.deadline = w.mode === "TURN" || w.mode === "WINDOW" ? this.computeDeadline(w.mode) : null;
    this.deps.incidents.record("resume", { room: this.code });
    this.broadcast({ type: "TableResumed", deadline: this.deadline });
  }

  private guardViolation(seat: number): void {
    // L-14: block, pause, alarm; logged without card data. Hand annulment on violation: see IMPLEMENTATION_STATUS.
    this.deps.incidents.record("guard_violation", { room: this.code, seat });
    this.pause("projection_guard");
  }

  fence(): void {
    if (this.status === "fenced") return;
    this.status = "fenced";
    this.clearTimer();
    this.stopLease();
    this.deps.incidents.record("ownership_lost", { room: this.code, epoch: this.epoch });
    for (let i = 0; i < this.seats; i++) { this.send(i, { type: "Error", code: "OWNERSHIP_LOST" }); this.slots[i]!.conn?.close(4010, "ownership lost"); }
  }

  /** C-14 drain: notify, keep playing until the deadline, then stop at the next hand boundary. */
  drain(deadlineAt: number): void {
    this.broadcast({ type: "ServerRestarting", plan: "interrupt", deadline: deadlineAt });
    const ms = Math.max(0, deadlineAt - this.now());
    setTimeout(() => {
      this.stopAtBoundary = true;
      const w = this.module.waitingOn(this.state);
      if (this.status === "lobby") this.status = "ended";
      else if (w.mode === "AUTO" && this.status === "playing") { this.clearTimer(); void this.endMatch("interrupted"); }
    }, ms);
  }

  private startLeaseLoop(): void {
    const t = this.deps.timing;
    this.leaseTimer = setInterval(async () => {
      if (this.now() - this.lastRenewOk > t.leaseMs - t.marginMs) { this.fence(); return; } // self-fence (C-20)
      const ok = await this.deps.directory.renew(this.code, this.epoch, t.leaseMs).catch(() => false);
      if (ok) this.lastRenewOk = this.now();
      else this.fence();
    }, t.renewMs);
    (this.leaseTimer as { unref?: () => void }).unref?.(); // Node only; a no-op on Hermes
  }

  private stopLease(): void { if (this.leaseTimer) { clearInterval(this.leaseTimer); this.leaseTimer = null; } }

  /* ───────────── send helpers ───────────── */

  send(seat: number, msg: ServerMessage): void { this.slots[seat]?.conn?.send(JSON.stringify(msg)); }
  broadcast(msg: ServerMessage): void { const t = JSON.stringify(msg); for (const s of this.slots) s.conn?.send(t); }
  chat(seat: number, msg: { quick_chat_id?: string; text?: string }): void {
    this.broadcast({ type: "Chat", seat, ...msg });
  }
  hostSeat(): number { return this.slots.findIndex((s) => s.host); }
  dispose(): void { this.clearTimer(); this.stopLease(); if (this.seedTimer) clearTimeout(this.seedTimer); }
}
