import { describe, expect, it } from "vitest";
import { GENESIS, type InputRecord, canonicalize, recordHash, utf8, verifyChain } from "../src/index.js";

describe("canonical serialisation", () => {
  it("sorts keys, omits undefined, rejects floats", () => {
    expect(canonicalize({ b: 1, a: [true, null, "x"], c: undefined })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(() => canonicalize({ x: 0.5 })).toThrow();
    expect(() => canonicalize({ x: Number.NaN })).toThrow();
  });
  it("manual utf8 matches TextEncoder", () => {
    for (const s of ["", "abc", "तास", "تاش", "🂡 ok"]) expect(Array.from(utf8(s))).toEqual(Array.from(new TextEncoder().encode(s)));
  });
});

describe("journal hash chain (P-15)", () => {
  const rec = (seq: number, prev: string): InputRecord => ({
    hand_id: "h1", server_seq: seq, epoch: 1, intent_id: `i${seq}`, actor: 0, origin: "human",
    action: { t: "Call", n: 3 }, prev_hash: prev, state_hash: "ab".repeat(32),
  });
  it("verifies a good chain and pinpoints tampering", () => {
    const r1 = rec(1, GENESIS); const r2 = rec(2, recordHash(r1)); const r3 = rec(3, recordHash(r2));
    expect(verifyChain([r1, r2, r3])).toEqual({ ok: true, root: recordHash(r3) });
    const bad = { ...r2, action: { t: "Call", n: 4 } };
    expect(verifyChain([r1, bad, r3])).toEqual({ ok: false, at: 2 });
  });
});
