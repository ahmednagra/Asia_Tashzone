import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchClient, jitteredBackoff, parseServerFrame, type ClientState, type SocketLike } from "./matchClient.js";

interface FakeSocket extends SocketLike { closed: boolean; sent: string[] }

function harness(extra: { maxRetries?: number; backoffMs?: (a: number) => number } = {}) {
  const sockets: FakeSocket[] = [];
  const states: ClientState["status"][] = [];
  const messages: unknown[] = [];
  const client = new MatchClient({
    url: "ws://test", joinToken: "token-123456", engineBuildHash: "b", behaviourDigest: "d", versionCode: 1,
    randomSeed: () => "00", backoffMs: extra.backoffMs ?? (() => 100), maxRetries: extra.maxRetries,
    onState: (s) => states.push(s.status), onMessage: (m) => messages.push(m),
    socket: () => {
      const s: FakeSocket = {
        closed: false, sent: [], onopen: null, onmessage: null, onclose: null,
        send(d) { this.sent.push(d); },
        close() { if (this.closed) return; this.closed = true; this.onclose?.({ code: 1000 }); },
      };
      sockets.push(s);
      return s;
    },
  });
  const live = () => sockets.filter((s) => !s.closed);
  const drop = (s: FakeSocket) => { s.closed = true; s.onclose?.({ code: 1006 }); };
  return { client, sockets, states, messages, live, drop };
}

describe("MatchClient reconnect", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("a manual connect during a pending reconnect keeps exactly one socket", () => {
    const h = harness();
    h.client.connect();
    h.sockets[0]!.onopen?.();
    h.drop(h.sockets[0]!);
    expect(h.client.state.status).toBe("reconnecting");
    h.client.connect();
    expect(h.sockets).toHaveLength(2);
    vi.advanceTimersByTime(10_000);
    expect(h.sockets).toHaveLength(2);
    expect(h.live()).toHaveLength(1);
  });

  it("connecting twice closes the first socket and ignores its late events", () => {
    const h = harness();
    h.client.connect();
    const first = h.sockets[0]!;
    h.client.connect();
    expect(first.closed).toBe(true);
    expect(h.live()).toHaveLength(1);
    first.onmessage?.({ data: JSON.stringify({ type: "TablePaused" }) });
    expect(h.client.state.paused).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(h.sockets).toHaveLength(2);
  });

  it("stops after the retry cap and reports offline", () => {
    const h = harness({ maxRetries: 3 });
    h.client.connect();
    for (let i = 0; i < 4; i++) { h.drop(h.sockets[i]!); vi.advanceTimersByTime(1000); }
    expect(h.sockets).toHaveLength(4);
    expect(h.client.state.status).toBe("offline");
    vi.advanceTimersByTime(60_000);
    expect(h.sockets).toHaveLength(4);
    h.client.connect();
    expect(h.sockets).toHaveLength(5);
    expect(h.client.state.status).toBe("connecting");
  });

  it("leave cancels a pending reconnect", () => {
    const h = harness();
    h.client.connect();
    h.drop(h.sockets[0]!);
    h.client.leave();
    vi.advanceTimersByTime(10_000);
    expect(h.sockets).toHaveLength(1);
    expect(h.client.state.status).toBe("closed");
  });

  it("default backoff is jittered and capped", () => {
    expect(jitteredBackoff(0, () => 0)).toBe(125);
    expect(jitteredBackoff(0, () => 1)).toBe(250);
    expect(jitteredBackoff(20, () => 1)).toBe(8000);
    expect(jitteredBackoff(20, () => 0)).toBe(4000);
  });
});

describe("MatchClient frames", () => {
  it("malformed frames are ignored without throwing", () => {
    const h = harness();
    h.client.connect();
    const s = h.sockets[0]!;
    for (const data of ["not json", "null", "[]", "42", '{"no":"type"}', '{"type":"TableSnapshot"}', '{"type":"ViewEvents","from_seq":"x"}', '{"type":"Error"}', undefined]) {
      expect(() => s.onmessage?.({ data })).not.toThrow();
    }
    expect(h.messages).toHaveLength(0);
    expect(h.client.state.view).toBeNull();
    s.onmessage?.({ data: JSON.stringify({ type: "TableSnapshot", view_seq: 3, seat_view: { hand: null }, deadline: null }) });
    expect(h.client.state.viewSeq).toBe(3);
    expect(h.messages).toHaveLength(1);
  });

  it("parseServerFrame accepts only object frames with a type", () => {
    expect(parseServerFrame("{")).toBeNull();
    expect(parseServerFrame('{"type":1}')).toBeNull();
    expect(parseServerFrame('{"type":"Pong"}')).toEqual({ type: "Pong" });
  });
});
