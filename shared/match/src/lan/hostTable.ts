/**
 * Same-Wi-Fi host: the phone runs an authoritative `Room` (the very class the match server runs) with in-memory
 * stores, and up to seats-1 guests join over `Link`s speaking the online protocol. No server, no network beyond the
 * LAN. Admission (PIN gate, seat tokens, lockout) is the only LAN-specific part; see README.md.
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { type ClientMessage, type ServerMessage, negotiate, parseClientFrame } from "@tashzone/protocol";
import {
  type Conn, type IncidentLog, type MatchReport, type RoomDeps, type RoomDirectory,
  MemoryIncidentLog, MemoryJournal, Room,
} from "../room/index.js";
import type { Link, LinkHandlers } from "./link.js";
import { LAN_JOIN_PREFIX, type LanSeatedFrame, lanName } from "./linkSocket.js";
import { isValidTablePin, tableQrPayload } from "./qr.js";

/** After this many wrong PINs (across all connections) the table refuses every new join; the host opens a new table. */
export const MAX_WRONG_PINS = 10;

type ErrorCode = (ServerMessage & { type: "Error" })["code"];

export interface HostTableOptions {
  /** Compiled rules (`compile(...).rules`) and their hash, as the match server would validate them. */
  readonly rules: any;
  readonly effectiveProfileHash: string;
  /** Guests must present the same engine build and behaviour digest (UPDATE_REQUIRED otherwise), like the server. */
  readonly engineBuildHash: string;
  readonly behaviourDigest: string;
  /** 4-digit table PIN, shared by QR code or read aloud. */
  readonly pin: string;
  /** CSPRNG bytes as hex on request (expo-crypto on the phone). Seeds, player ids and the token secret come from it. */
  readonly randomHex: (bytes: number) => string;
  readonly hostName?: string;
  /** Six characters [A-Z0-9]; default derived from randomHex. */
  readonly roomCode?: string;
  readonly timing?: Partial<RoomDeps["timing"]>;
  readonly results?: (report: MatchReport) => Promise<void>;
  readonly incidents?: IncidentLog;
  readonly maxWrongPins?: number;
  readonly helloTimeoutMs?: number;
  readonly now?: () => number;
  /** Fires when a guest joins, leaves, drops or reconnects (refresh the lobby). */
  readonly onSeatsChanged?: () => void;
}

export interface SeatInfo { readonly seat: number; readonly name: string; readonly kind: "human" | "bot"; readonly host: boolean; readonly online: boolean }

/** A table has one owner for its whole life: epoch 1, never contested, lease effectively unbounded. */
class SoloDirectory implements RoomDirectory {
  async claim() { return 1; }
  async renew() { return true; }
  async release() { /* nothing to release */ }
  async currentEpoch() { return 1; }
}

const DEFAULT_TIMING: RoomDeps["timing"] = {
  seedWaitMs: 3000, botDelayMs: 700, interHandMs: 1500,
  leaseMs: 24 * 3_600_000, renewMs: 60_000, marginMs: 60_000, turnMsOverride: null, windowMsOverride: null,
};

/** Constant-time comparison so a PIN or token cannot be probed character by character. */
function safeEqual(a: string, b: string): boolean {
  let d = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

export class HostTable {
  readonly room: Room;
  readonly journal: MemoryJournal;
  readonly code: string;
  private readonly secret: string;
  private readonly seated = new Map<number, string>(); // guest seat -> player id (a token is valid only while this holds)
  private readonly conns = new Set<Conn>();
  private readonly links = new Set<Link>();
  private wrongPins = 0;
  private closed = false;
  private readonly now: () => number;

  constructor(private readonly o: HostTableOptions) {
    if (!isValidTablePin(o.pin)) throw new Error("table PIN must be 4 digits");
    this.now = o.now ?? (() => Date.now());
    this.code = o.roomCode ?? o.randomHex(3).toUpperCase();
    this.secret = o.randomHex(32);
    this.journal = new MemoryJournal(() => 1);
    const deps: RoomDeps = {
      journal: this.journal, directory: new SoloDirectory(), incidents: o.incidents ?? new MemoryIncidentLog(),
      results: o.results ?? (async () => undefined),
      randomHex: o.randomHex,
      // The journal lives only in this phone's memory; there is no at-rest copy to protect, so the seed is kept as is.
      sealSeed: (seedHex) => seedHex,
      engineBuildHash: o.engineBuildHash, instanceId: "lan-host", now: this.now,
      timing: { ...DEFAULT_TIMING, ...o.timing },
    };
    this.room = new Room(this.code, 1, o.rules, o.effectiveProfileHash, deps);
  }

  get seats(): number { return this.room.seats; }
  get started(): boolean { return this.room.status !== "lobby"; }
  /** Wrong PINs seen so far; at `maxWrongPins` the table is locked to newcomers. */
  get wrongPinCount(): number { return this.wrongPins; }

  /** Lobby roster for the host's screen. */
  roster(): SeatInfo[] {
    return this.room.slots.map((s, seat) => ({ seat, name: s.name, kind: s.kind, host: s.host, online: s.conn !== null }));
  }

  /** The QR the host shows: its own LAN address and listening port plus this table's PIN. */
  qrPayload(host: string, port: number): string { return tableQrPayload(host, port, this.o.pin); }

  /** A guest connection from the network. Returns the handlers the transport must call. */
  accept(link: Link): LinkHandlers { return this.attach(link, false); }

  /** The phone's own player, connected in-process (see `hostSeat`). Never reachable from the network. */
  acceptHost(link: Link): LinkHandlers { return this.attach(link, true); }

  /** Host-only: frees a guest's seat (a bot takes it) and invalidates that guest's token. */
  kick(seat: number): void {
    if (this.closed || seat <= 0 || !this.seated.has(seat)) return;
    this.seated.delete(seat);
    this.room.leave(seat);
    this.refreshLobby();
    this.o.onSeatsChanged?.();
  }

  /** Host-only: ends the table. Connections close, timers stop, and the room can no longer commit. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const c of this.conns) this.room.disconnect(c);
    this.room.fence();
    this.room.dispose();
    for (const l of [...this.links]) l.close();
    this.conns.clear(); this.links.clear(); this.seated.clear();
  }

  /* ───────────── admission ───────────── */

  private attach(link: Link, isHost: boolean): LinkHandlers {
    let seat = -1;
    let dead = false;
    let bucket = 40; let last = this.now(); // 20 frames/s, burst 40, like the server
    this.links.add(link);
    const conn: Conn = { send: (t) => { if (!dead) link.send(t); }, close: () => link.close() };
    const reject = (code: ErrorCode) => {
      conn.send(JSON.stringify({ type: "Error", code } satisfies ServerMessage));
      dead = true; clearTimeout(timer); link.close(); this.links.delete(link);
    };
    const timer = setTimeout(() => { if (seat < 0 && !dead) reject("UNAUTHORIZED"); }, this.o.helloTimeoutMs ?? 5000);
    if (this.closed) reject("ROOM_LOCKED");

    return {
      onText: (text) => {
        if (dead || this.closed) return;
        const t = this.now();
        bucket = Math.min(40, bucket + ((t - last) / 1000) * 20); last = t;
        if (bucket < 1) { conn.send(JSON.stringify({ type: "Error", code: "RATE_LIMITED" } satisfies ServerMessage)); return; }
        bucket -= 1;
        const parsed = parseClientFrame(text);
        if (!parsed.ok) { reject("BAD_FRAME"); return; }
        const msg = parsed.msg;
        if (seat >= 0) { this.dispatch(seat, isHost, msg, conn); return; }
        if (msg.type !== "Hello") { reject("UNAUTHORIZED"); return; }
        clearTimeout(timer);
        seat = this.admit(msg, isHost, conn, reject);
      },
      onClose: () => {
        dead = true;
        clearTimeout(timer);
        this.links.delete(link);
        if (seat < 0) return;
        this.conns.delete(conn);
        this.room.disconnect(conn);
        this.o.onSeatsChanged?.();
      },
    };
  }

  /** Returns the seat, or -1 after rejecting. Authentication (token or PIN) comes first so a stranger learns nothing else. */
  private admit(msg: Extract<ClientMessage, { type: "Hello" }>, isHost: boolean, conn: Conn, reject: (code: ErrorCode) => void): number {
    if (negotiate(msg.protocol_min, msg.protocol_max) === null) { reject("UPDATE_REQUIRED"); return -1; }
    let seat: number; let playerId: string; let name: string;
    if (isHost) {
      seat = 0; playerId = "host"; name = this.o.hostName ?? "Host";
    } else {
      const auth = this.authenticate(msg.join_token);
      if (auth?.kind === "resume") { seat = auth.seat; playerId = auth.playerId; name = this.room.slots[seat]!.name; }
      else {
        // a locked table answers exactly like a wrong PIN
        if (!auth || this.wrongPins >= (this.o.maxWrongPins ?? MAX_WRONG_PINS) || !safeEqual(auth.pin, this.o.pin)) {
          this.wrongPins++; reject("UNAUTHORIZED"); return -1;
        }
        const free = this.room.status === "lobby" ? this.freeSeat() : -1; // nobody takes over a running game's bot seat
        if (free < 0) { reject("ROOM_LOCKED"); return -1; }
        seat = free; playerId = this.o.randomHex(8);
        name = auth.name || `Guest ${seat}`;
      }
    }
    if (msg.engine_build_hash !== this.o.engineBuildHash || msg.behaviour_digest !== this.o.behaviourDigest) {
      reject("UPDATE_REQUIRED"); return -1;
    }
    if (!isHost) {
      this.seated.set(seat, playerId);
      const f: LanSeatedFrame = { type: "LanSeated", seat, resume_token: this.tokenFor(seat, playerId) };
      conn.send(JSON.stringify(f)); // precedes Welcome; linkSocket keeps the token for reconnects
    }
    this.conns.add(conn);
    this.room.join(seat, playerId, name, isHost, conn, msg.last_view_seq);
    this.refreshLobby(seat);
    this.o.onSeatsChanged?.();
    return seat;
  }

  private authenticate(joinToken: string):
    | { kind: "resume"; seat: number; playerId: string }
    | { kind: "pin"; pin: string; name: string }
    | null {
    const p = joinToken.split(":");
    if (p.length !== 4 || p[0] !== LAN_JOIN_PREFIX) return null;
    const [, pin, resume, rawName] = p as [string, string, string, string];
    // Resume first: the token proves this phone held the seat, so a lockout caused by strangers never evicts a seated friend.
    if (resume !== "-") {
      const m = /^([0-9a-f]{16})-(\d{1,2})-([0-9a-f]{64})$/.exec(resume);
      if (m) {
        const seat = Number(m[2]);
        const playerId = m[1]!;
        if (this.seated.get(seat) === playerId && safeEqual(m[3]!, this.sig(seat, playerId))) return { kind: "resume", seat, playerId };
      }
    }
    return { kind: "pin", pin, name: lanName(rawName) };
  }

  private sig(seat: number, playerId: string): string {
    return bytesToHex(hmac(sha256, utf8ToBytes(this.secret), utf8ToBytes(`tz/lan/resume/v1/${this.code}/${seat}/${playerId}`)));
  }
  private tokenFor(seat: number, playerId: string): string { return `${playerId}-${seat}-${this.sig(seat, playerId)}`; }

  private freeSeat(): number {
    for (let i = 1; i < this.room.seats; i++) if (!this.seated.has(i)) return i;
    return -1;
  }

  /** Lobby only: everyone connected gets a fresh snapshot so rosters stay current. */
  private refreshLobby(except = -1): void {
    if (this.room.status !== "lobby") return;
    for (let i = 0; i < this.room.seats; i++) if (i !== except && this.room.slots[i]!.conn) this.room.sendSnapshot(i);
  }

  /* ───────────── after admission: the same dispatch as the match server ───────────── */

  private dispatch(seat: number, isHost: boolean, msg: ClientMessage, conn: Conn): void {
    const send = (m: ServerMessage) => conn.send(JSON.stringify(m));
    switch (msg.type) {
      case "Ping": send({ type: "Pong", n: msg.n, server_time: this.now() }); return;
      case "Start": if (!this.room.start(seat)) send({ type: "Error", code: "NOT_SEATED" }); return; // only the host's seat has the host flag
      case "Ready": this.room.ready(seat, msg.hand_id, msg.client_seed); return;
      case "Intent": void this.room.intent(seat, msg.intent_id, msg.hand_id, msg.expected_view_seq, msg.action).catch(() => undefined); return;
      case "ResumeControl": this.room.resumeControl(seat); return;
      case "RequestSnapshot": this.room.sendSnapshot(seat); return;
      case "Leave":
        if (isHost) return; // the host ends the table with close(), never by leaving its own seat
        this.seated.delete(seat);
        this.room.leave(seat);
        this.refreshLobby();
        this.o.onSeatsChanged?.();
        return;
      case "Chat":
        if (msg.text !== undefined || !msg.quick_chat_id) return; // quick-chat only; no free text on a LAN table
        this.room.chat(seat, { quick_chat_id: msg.quick_chat_id });
        return;
      case "Hello": return;
    }
  }
}
