import { describe, expect, it } from "vitest";
import type { Link, LinkHandlers } from "@tashzone/match";
import { MAX_BUFFERED_SENDS, bufferedLink, formatHostAddress, isDialable, joinFailureCode, lanCompat, makePin, parseHostAddress } from "./lanLogic";

describe("makePin", () => {
  it("makes four digits and skips biased bytes", () => {
    const seq = [255, 251, 0, 9, 10, 249, 123];
    let i = 0;
    const pin = makePin((n) => Uint8Array.from({ length: n }, () => seq[i++ % seq.length]!));
    expect(pin).toMatch(/^\d{4}$/);
    expect(pin).toBe("0909"); // 255 and 251 are skipped; 0, 9, 10 -> 0, 249 -> 9
  });
  it("fails loudly when the source only yields rejected bytes", () => {
    expect(() => makePin((n) => new Uint8Array(n).fill(255))).toThrow();
  });
  it("covers all digits roughly evenly", () => {
    let x = 1;
    const rnd = (n: number) => Uint8Array.from({ length: n }, () => ((x = (x * 1103515245 + 12345) >>> 0), (x >>> 16) & 0xff));
    const counts = new Array<number>(10).fill(0);
    for (let k = 0; k < 2000; k++) for (const d of makePin(rnd)) counts[Number(d)]!++;
    for (const c of counts) expect(c).toBeGreaterThan(600);
  });
});

describe("lanCompat", () => {
  it("is 64 hex, stable, and changes with the build", () => {
    const a = lanCompat(1);
    expect(a.engineBuildHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.behaviourDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(lanCompat(1)).toEqual(a);
    expect(lanCompat(2).engineBuildHash).not.toBe(a.engineBuildHash);
    expect(lanCompat(2).behaviourDigest).toBe(a.behaviourDigest);
  });
});

describe("dial targets", () => {
  it("accepts only private LAN hosts with a real port", () => {
    expect(isDialable("192.168.1.20", 41234)).toBe(true);
    expect(isDialable("10.0.0.5", 1024)).toBe(true);
    expect(isDialable("8.8.8.8", 41234)).toBe(false);
    expect(isDialable("192.168.1.20", 80)).toBe(false);
    expect(isDialable("192.168.01.20", 41234)).toBe(false);
  });
  it("parses the manual address the host screen shows", () => {
    expect(parseHostAddress(" 192.168.1.20:41234 ")).toEqual({ host: "192.168.1.20", port: 41234 });
    expect(parseHostAddress(formatHostAddress("172.16.0.9", 50000))).toEqual({ host: "172.16.0.9", port: 50000 });
    for (const bad of ["", "192.168.1.20", "example.com:5000", "8.8.8.8:5000", "192.168.1.20:99999", "192.168.1.20:22", "tashzone://wifi?h=1", "192.168.1.20:5000/x"]) {
      expect(parseHostAddress(bad)).toBeNull();
    }
  });
});

describe("joinFailureCode", () => {
  it("maps protocol errors to app codes", () => {
    expect(joinFailureCode("UNAUTHORIZED")).toBe("WRONG_PIN");
    expect(joinFailureCode("ROOM_LOCKED")).toBe("TABLE_FULL");
    expect(joinFailureCode("UPDATE_REQUIRED")).toBe("UPDATE_REQUIRED");
    expect(joinFailureCode("BAD_FRAME")).toBe("ERROR");
  });
});

function harness() {
  const sent: string[] = [];
  let closes = 0;
  let onWire: LinkHandlers | null = null;
  const link: Link = { send: (t) => sent.push(t), close: () => { closes++; onWire?.onClose(); } };
  let resolve!: (c: { link: Link; wire: (h: LinkHandlers) => void }) => void;
  let reject!: (e: unknown) => void;
  const connect = () => new Promise<{ link: Link; wire: (h: LinkHandlers) => void }>((res, rej) => { resolve = res; reject = rej; });
  const events: string[] = [];
  const handlers: LinkHandlers = { onText: (t) => events.push(`text:${t}`), onClose: () => events.push("close") };
  return { sent, events, link, connect, handlers, get closes() { return closes; }, resolve: () => resolve({ link, wire: (h) => { onWire = h; } }), reject: (e: unknown) => reject(e), deliver: (t: string) => onWire?.onText(t), get wired() { return onWire; } };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("bufferedLink", () => {
  it("holds sends until the connection opens, then flushes in order", async () => {
    const h = harness();
    const l = bufferedLink(h.connect, 0)(h.handlers);
    l.send("a"); l.send("b");
    expect(h.sent).toEqual([]);
    h.resolve(); await tick();
    expect(h.sent).toEqual(["a", "b"]);
    l.send("c");
    expect(h.sent).toEqual(["a", "b", "c"]);
    h.deliver("hi");
    expect(h.events).toEqual(["text:hi"]);
  });
  it("reports a failed connect as one close", async () => {
    const h = harness();
    const l = bufferedLink(h.connect, 0)(h.handlers);
    l.send("x");
    h.reject(new Error("refused")); await tick();
    expect(h.events).toEqual(["close"]);
    l.send("y"); l.close();
    expect(h.events).toEqual(["close"]);
  });
  it("closes the socket that opens after the caller gave up", async () => {
    const h = harness();
    const l = bufferedLink(h.connect, 0)(h.handlers);
    l.close();
    h.resolve(); await tick();
    expect(h.closes).toBe(1);
    expect(h.events).toEqual(["close"]);
  });
  it("delivers close once when an open link ends, and when the caller closes it", async () => {
    const h = harness();
    const l = bufferedLink(h.connect, 0)(h.handlers);
    h.resolve(); await tick();
    h.wired!.onClose();
    l.close();
    expect(h.events).toEqual(["close"]);
  });
  it("lets a last frame out before destroying the socket on a deliberate close", async () => {
    const h = harness();
    const l = bufferedLink(h.connect, 5)(h.handlers);
    h.resolve(); await tick();
    l.send("Leave");
    l.close();
    expect(h.sent).toEqual(["Leave"]);
    expect(h.closes).toBe(0);
    expect(h.events).toEqual(["close"]);
    await new Promise((r) => setTimeout(r, 15));
    expect(h.closes).toBe(1);
  });
  it("bounds what it buffers", async () => {
    const h = harness();
    const l = bufferedLink(h.connect, 0)(h.handlers);
    for (let i = 0; i <= MAX_BUFFERED_SENDS; i++) l.send(String(i));
    expect(h.events).toEqual(["close"]);
  });
});
