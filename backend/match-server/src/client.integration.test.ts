/** The app's MatchClient against a real server: reconnect after a dropped transport keeps view_seq gap-free. */
import { afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { MatchClient, type SocketLike } from "@tashzone/match";
import { BUILD, DIGEST, startServer, token } from "./test-harness.js";

let stop: (() => Promise<void>) | null = null;
afterEach(async () => { await stop?.(); stop = null; });

const adapter = (url: string): SocketLike => {
  const ws = new WebSocket(url);
  const s: SocketLike = { send: (d) => ws.send(d), close: (c) => ws.close(c), onopen: null, onmessage: null, onclose: null };
  ws.on("open", () => s.onopen?.());
  ws.on("message", (d) => s.onmessage?.({ data: d.toString() }));
  ws.on("close", (code) => s.onclose?.({ code }));
  return s;
};

describe("MatchClient (app) ↔ match server", () => {
  it("finishes a match across a dropped connection with no gaps or duplicates", async () => {
    const { server, port } = await startServer({ botDelayMs: 3 });
    stop = () => server.close();
    const seqs: number[] = [];
    let dropped = false;
    let ended: any = null;
    const client: MatchClient = new MatchClient({
      url: `ws://127.0.0.1:${port}/match`, joinToken: token("CLNT01", 0), engineBuildHash: BUILD, behaviourDigest: DIGEST,
      versionCode: 1, socket: adapter, randomSeed: () => randomBytes(32).toString("hex"), backoffMs: () => 20,
      onMessage: (m) => {
        if (m.type === "TableSnapshot" && !m.seat_view.hand && m.view_seq === 0) client.start();
        if (m.type === "ViewEvents") {
          seqs.push(m.from_seq);
          if (!dropped && m.to_seq === 10) { dropped = true; client.dropTransport(); return; }
        }
        if (m.type === "MatchEnded") ended = m;
        const v = client.state.view;
        if ((m.type === "ViewEvents" || m.type === "TableSnapshot") && v?.legal?.length && v.legal[0].t !== "RequestRedeal") client.intent(v.legal[0]);
      },
    });
    client.connect();
    for (let i = 0; i < 400 && !ended; i++) await new Promise((r) => setTimeout(r, 50));
    expect(dropped).toBe(true);
    expect(ended?.outcome).toBe("completed");
    const uniq = [...new Set(seqs)];
    expect(uniq).toEqual(uniq.map((_, i) => i + 1)); // gap-free
    expect(seqs.length).toBe(uniq.length);           // no duplicate application
  });
});
