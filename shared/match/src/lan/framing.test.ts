import { describe, expect, it } from "vitest";
import { FrameDecoder, encodeFrame } from "./framing.js";

describe("frames", () => {
  it("round-trips several messages split across arbitrary chunk boundaries", () => {
    const texts = ["{\"a\":1}", "x".repeat(5000), "héllo ♠"];
    const bytes = texts.flatMap((t) => [...encodeFrame(t)]);
    const d = new FrameDecoder();
    const out: string[] = [];
    for (let i = 0; i < bytes.length; i += 7) out.push(...d.push(new Uint8Array(bytes.slice(i, i + 7))));
    expect(out).toEqual(texts);
  });
  it("rejects an oversized frame", () => {
    expect(() => new FrameDecoder().push(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toThrow();
    expect(() => encodeFrame("x".repeat(70_000))).toThrow();
  });
});
