import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { MatchServer } from "./server.js";
import { MemoryDirectory, MemoryIncidentLog, MemoryJournal } from "./stores.js";
import { signJoinToken, type JoinClaims } from "./tokens.js";
import type { MatchReport } from "./room.js";

export const SECRET = "j".repeat(40);
export const BUILD = "b".repeat(64);
export const DIGEST = "d".repeat(64);

export async function startServer(timing: Partial<ReturnType<typeof defaultTiming>> = {}) {
  const directory = new MemoryDirectory();
  const journal = new MemoryJournal((room) => directory.claims.get(room)?.epoch ?? null);
  const incidents = new MemoryIncidentLog();
  const reports: MatchReport[] = [];
  const started: string[] = [];
  const server = new MatchServer({
    journal, directory, incidents, results: async (r) => { reports.push(r); }, started: async (room) => { started.push(room); },
    seedKey: "ab".repeat(32), engineBuildHash: BUILD, behaviourDigests: { "callbreak.np@1": DIGEST, "callbridge.bd@1": DIGEST, "courtpiece.tz@1": DIGEST, "bhabhi.tz@1": DIGEST },
    joinTokenSecret: SECRET, instanceId: "t1", instanceUrl: "", version: { tag: "test", commit: "0" },
    timing: { ...defaultTiming(), ...timing },
  });
  const port = await server.listen(0);
  return { server, port, directory, journal, incidents, reports, started };
}
export function defaultTiming() {
  return { seedWaitMs: 40, botDelayMs: 0, interHandMs: 5, leaseMs: 5000, renewMs: 200, marginMs: 500, turnMsOverride: 2000 as number | null, windowMsOverride: 20 as number | null };
}

export function token(room: string, seat: number, over: Partial<JoinClaims> = {}): string {
  return signJoinToken(SECRET, {
    room, player_id: `p${seat}`, seat, name: `Player ${seat}`, host: seat === 0, free_text: false,
    exp: Math.floor(Date.now() / 1000) + 600, profile_id: "callbreak.np@1", preset: "standard", settings: { rounds: 3 }, ...over,
  });
}

export class Client {
  ws!: WebSocket;
  msgs: any[] = [];
  view: any = null;
  viewSeq = 0;
  seqs: number[] = [];
  closed: { code: number } | null = null;
  autoPlay = true;
  private waiters: { pred: (m: any) => boolean; res: (m: any) => void }[] = [];
  private n = 0;
  constructor(readonly port: number, readonly tok: string, readonly opts: { digest?: string } = {}) {}

  connect(lastViewSeq?: number): Promise<void> {
    this.ws = new WebSocket(`ws://127.0.0.1:${this.port}/match`);
    this.closed = null;
    this.ws.on("message", (d) => this.onMsg(JSON.parse(d.toString())));
    this.ws.on("close", (code) => { this.closed = { code }; this.onMsg({ type: "__closed", code }); });
    return new Promise((res) => this.ws.on("open", () => {
      const hello: any = { type: "Hello", protocol_min: 2, protocol_max: 2, version_code: 1, engine_build_hash: BUILD,
        behaviour_digest: this.opts.digest ?? DIGEST, correlation_id: "c1", join_token: this.tok };
      if (lastViewSeq !== undefined) hello.last_view_seq = lastViewSeq;
      this.ws.send(JSON.stringify(hello));
      res();
    }));
  }
  send(m: unknown) { this.ws.send(typeof m === "string" ? m : JSON.stringify(m)); }
  private onMsg(m: any) {
    this.msgs.push(m);
    if (m.type === "TableSnapshot") { this.view = m.seat_view; this.viewSeq = m.view_seq; }
    if (m.type === "ViewEvents") { this.seqs.push(m.from_seq); this.view = m.seat_view; this.viewSeq = m.to_seq; }
    if (m.type === "SeedRequest") this.send({ type: "Ready", hand_id: m.hand_id, client_seed: randomBytes(32).toString("hex") });
    for (const w of this.waiters.slice()) if (w.pred(m)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.res(m); }
    if (this.autoPlay && (m.type === "ViewEvents" || m.type === "TableSnapshot")) this.maybePlay();
  }
  maybePlay() {
    const v = this.view;
    if (!v || !v.hand || v.legal.length === 0) return;
    const move = v.legal.find((x: any) => x.t !== "Take") ?? null; // never take a hand blindly
    if (!move || move.t === "RequestRedeal") return;
    this.intent(move);
  }
  intent(action: unknown, intentId = `i${++this.n}`, expected = this.viewSeq) {
    this.send({ type: "Intent", intent_id: intentId, hand_id: this.view.hand.hand_id, expected_view_seq: expected, action });
    return intentId;
  }
  /** Resolves on the first message matching `pred` at index ≥ `from` (default: search the whole history). */
  waitFor(pred: (m: any) => boolean, ms = 20000, from = 0): Promise<any> {
    const hit = this.msgs.slice(from).find(pred);
    if (hit) return Promise.resolve(hit);
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout waiting; last: " + JSON.stringify(this.msgs.slice(-3)).slice(0, 400))), ms);
      this.waiters.push({ pred, res: (m) => { clearTimeout(t); res(m); } });
    });
  }
  close() { this.ws.close(); }
}
