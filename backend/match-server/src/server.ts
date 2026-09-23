/**
 * Match server: HTTP (/health, /ready) + WebSocket (/match). Owns live rooms in memory (C-08, C-18).
 * The app is never trusted for legality, order, randomness, seats or rules (03_PLATFORM.md §7.2).
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { compile } from "@tashzone/engine";
import { type ClientMessage, MAX_FRAME_BYTES, type ServerMessage, negotiate, parseClientFrame } from "@tashzone/protocol";
import { type Conn, Room, type RoomDeps } from "@tashzone/match";
import { encryptSeed } from "./crypto.js";
import { type JoinClaims, verifyJoinToken } from "./tokens.js";

export interface ServerOptions extends Omit<RoomDeps, "engineBuildHash" | "randomHex" | "sealSeed"> {
  /** AES-256 key (hex) that seals hand seeds at rest; the Node adapter behind RoomDeps.sealSeed. */
  readonly seedKey: string;
  readonly joinTokenSecret: string;
  readonly engineBuildHash: string;
  /** behaviour digest per profile id; a Hello with a different digest gets UPDATE_REQUIRED (C-23) */
  readonly behaviourDigests: Readonly<Record<string, string>>;
  readonly instanceUrl: string;
  readonly version: { readonly tag: string; readonly commit: string };
  readonly helloTimeoutMs?: number;
}

const WS_CLOSE = { BAD_FRAME: 4400, UNAUTHORIZED: 4401, UPDATE_REQUIRED: 4426, DRAINING: 4503, NOT_OWNER: 4421 } as const;

export class MatchServer {
  readonly rooms = new Map<string, Room>();
  readonly http: Server;
  private readonly wss: WebSocketServer;
  draining = false;

  constructor(private readonly opts: ServerOptions) {
    this.http = createServer((req, res) => this.handleHttp(req, res));
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
    this.http.on("upgrade", (req, socket, head) => {
      if ((req.url ?? "").split("?")[0] !== "/match") { socket.destroy(); return; }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws));
    });
  }

  listen(port: number): Promise<number> {
    return new Promise((resolve) => this.http.listen(port, () => {
      const a = this.http.address();
      resolve(typeof a === "object" && a ? a.port : port);
    }));
  }

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    const url = (req.url ?? "").split("?")[0];
    const json = (code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (url === "/health") {
      // C-30 provenance; no live state, seeds or views are ever returned (L-16)
      return json(200, { ok: true, rooms: this.rooms.size, tag: this.opts.version.tag, commit: this.opts.version.commit, engine_build_hash: this.opts.engineBuildHash });
    }
    if (url === "/ready") return json(this.draining ? 503 : 200, { ready: !this.draining });
    json(404, { error: "not_found" });
  }

  private onConnection(ws: WebSocket): void {
    let room: Room | null = null;
    let seat = -1;
    let claims: JoinClaims | null = null;
    let tokens = 40; let last = Date.now(); // token bucket: 20/s, burst 40
    let admitting: Promise<void> | null = null;
    const buffered: ClientMessage[] = [];
    const conn: Conn = { send: (t) => { if (ws.readyState === ws.OPEN) ws.send(t); }, close: (c, r) => ws.close(c, r) };
    const send = (m: ServerMessage) => conn.send(JSON.stringify(m));
    const helloTimer = setTimeout(() => ws.close(WS_CLOSE.UNAUTHORIZED, "hello timeout"), this.opts.helloTimeoutMs ?? 10_000);
    let alive = true;
    const hb = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; ws.ping(); }, 12_500);
    ws.on("pong", () => { alive = true; });

    ws.on("message", (data, isBinary) => {
      alive = true;
      const now = Date.now(); tokens = Math.min(40, tokens + ((now - last) / 1000) * 20); last = now;
      if (tokens < 1) { send({ type: "Error", code: "RATE_LIMITED" }); return; }
      tokens -= 1;
      if (isBinary) { ws.close(WS_CLOSE.BAD_FRAME, "binary"); return; }
      const parsed = parseClientFrame(data.toString());
      if (!parsed.ok) { send({ type: "Error", code: "BAD_FRAME" }); ws.close(WS_CLOSE.BAD_FRAME, "bad frame"); return; }
      const msg = parsed.msg;
      if (room) { void this.dispatch(room, seat, claims!, msg, send); return; }
      if (admitting) { buffered.push(msg); return; }
      if (msg.type !== "Hello") { ws.close(WS_CLOSE.UNAUTHORIZED, "hello first"); return; }
      clearTimeout(helloTimer);
      admitting = this.admit(msg, conn).then((r) => {
        admitting = null;
        if (!r) return;
        ({ room, seat, claims } = r);
        for (const m of buffered.splice(0)) void this.dispatch(r.room, r.seat, r.claims, m, send);
      });
    });
    ws.on("close", () => { clearTimeout(helloTimer); clearInterval(hb); room?.disconnect(conn); });
    ws.on("error", () => undefined);
  }

  private async admit(msg: Extract<ClientMessage, { type: "Hello" }>, conn: Conn): Promise<{ room: Room; seat: number; claims: JoinClaims } | null> {
    const fail = (code: ServerMessage & { type: "Error" }, close: number) => { conn.send(JSON.stringify(code)); conn.close(close, code.code); return null; };
    if (negotiate(msg.protocol_min, msg.protocol_max) === null) return fail({ type: "Error", code: "UPDATE_REQUIRED" }, WS_CLOSE.UPDATE_REQUIRED);
    const claims = verifyJoinToken(this.opts.joinTokenSecret, msg.join_token, Math.floor(Date.now() / 1000));
    if (!claims) return fail({ type: "Error", code: "UNAUTHORIZED" }, WS_CLOSE.UNAUTHORIZED);
    const digest = this.opts.behaviourDigests[claims.profile_id];
    if (msg.engine_build_hash !== this.opts.engineBuildHash || !digest || msg.behaviour_digest !== digest) {
      return fail({ type: "Error", code: "UPDATE_REQUIRED" }, WS_CLOSE.UPDATE_REQUIRED); // C-23, MP-18
    }
    let room = this.rooms.get(claims.room) ?? null;
    if (!room) {
      if (this.draining) return fail({ type: "Error", code: "ROOM_LOCKED" }, WS_CLOSE.DRAINING);
      const c = compile(claims.profile_id, claims.settings, claims.preset); // re-validate (C-22)
      if (!c.ok) return fail({ type: "Error", code: "UNAUTHORIZED" }, WS_CLOSE.UNAUTHORIZED);
      // L39: a Bhabhi handicap deal is for tables against bots only, never an online room.
      if ((c.rules as { handicap?: number }).handicap) return fail({ type: "Error", code: "UNAUTHORIZED" }, WS_CLOSE.UNAUTHORIZED);
      room = await this.claimRoom(claims.room, c.rules, c.effective_profile_hash);
      if (!room) {
        // owned by another instance: relay (C-18) is required before a second instance (RG-4)
        this.opts.incidents.record("relay", { room: claims.room, result: "not_owner" });
        return fail({ type: "Error", code: "OWNERSHIP_LOST" }, WS_CLOSE.NOT_OWNER);
      }
    }
    if (claims.seat >= room.seats) return fail({ type: "Error", code: "NOT_SEATED" }, WS_CLOSE.UNAUTHORIZED);
    if (room.status === "ended" || room.status === "fenced") return fail({ type: "Error", code: "MATCH_INTERRUPTED" }, WS_CLOSE.DRAINING);
    room.join(claims.seat, claims.player_id, claims.name, claims.host, conn, msg.last_view_seq);
    return { room, seat: claims.seat, claims };
  }

  /** The transport-agnostic Room gets its randomness and seed sealing from Node crypto (RoomDeps). */
  private get roomDeps(): RoomDeps {
    return {
      ...this.opts,
      randomHex: (bytes) => randomBytes(bytes).toString("hex"),
      sealSeed: (seedHex, aad) => encryptSeed(this.opts.seedKey, seedHex, aad),
    };
  }

  /** One claim per room code even when several Hellos race. */
  private readonly claiming = new Map<string, Promise<Room | null>>();
  private claimRoom(code: string, rules: Room["rules"], eph: string): Promise<Room | null> {
    let p = this.claiming.get(code);
    if (!p) {
      p = (async () => {
        const epoch = await this.opts.directory.claim(code, this.opts.instanceId, this.opts.instanceUrl, this.opts.timing.leaseMs);
        if (epoch === null) return null;
        const room = new Room(code, epoch, rules, eph, this.roomDeps);
        this.rooms.set(code, room);
        return room;
      })().finally(() => this.claiming.delete(code));
      this.claiming.set(code, p);
    }
    return p;
  }

  private async dispatch(room: Room, seat: number, claims: JoinClaims, msg: ClientMessage, send: (m: ServerMessage) => void): Promise<void> {
    switch (msg.type) {
      case "Ping": send({ type: "Pong", n: msg.n, server_time: Date.now() }); return;
      case "Start": if (!room.start(seat)) send({ type: "Error", code: "NOT_SEATED" }); return;
      case "Ready": room.ready(seat, msg.hand_id, msg.client_seed); return;
      case "Intent": await room.intent(seat, msg.intent_id, msg.hand_id, msg.expected_view_seq, msg.action); return;
      case "ResumeControl": room.resumeControl(seat); return;
      case "RequestSnapshot": room.sendSnapshot(seat); return;
      case "Leave": room.leave(seat); return;
      case "Chat": {
        // free text only when the sender's Parent Settings allow it; quick-chat always (§6.7). Never stored or logged.
        if (msg.text !== undefined && !claims.free_text) return;
        const payload: { quick_chat_id?: string; text?: string } = {};
        if (msg.quick_chat_id) payload.quick_chat_id = msg.quick_chat_id;
        if (msg.text) payload.text = filterText(msg.text);
        room.chat(seat, payload);
        return;
      }
      case "Hello": return; // repeated Hello on an established connection is ignored
    }
  }

  /** C-14 drain: refuse new rooms, /ready 503, notify, stop matches at hand boundaries after the deadline. */
  drain(deadlineMs: number): void {
    if (this.draining) return;
    this.draining = true;
    this.opts.incidents.record("drain", { rooms: this.rooms.size });
    const at = Date.now() + deadlineMs;
    for (const r of this.rooms.values()) r.drain(at);
  }

  async close(): Promise<void> {
    for (const r of this.rooms.values()) r.dispose();
    for (const c of this.wss.clients) c.terminate();
    await new Promise<void>((res) => this.wss.close(() => res()));
    await new Promise<void>((res) => this.http.close(() => res()));
  }
}

/** Minimal word filter; the versioned list lives in shared/moderation (C-29, Planned). */
const BLOCKED = ["badword"];
export function filterText(t: string): string {
  let out = t;
  for (const w of BLOCKED) out = out.replace(new RegExp(w, "gi"), "*".repeat(w.length));
  return out;
}
