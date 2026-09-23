/** L5 protocol: strict schemas, bounded frames, version negotiation (§6.1–6.4). */
import { describe, expect, it } from "vitest";
import { MAX_FRAME_BYTES, negotiate, parseClientFrame, viewHash } from "./index.js";

const hello = {
  type: "Hello", protocol_min: 2, protocol_max: 2, version_code: 3, engine_build_hash: "a".repeat(64),
  behaviour_digest: "b".repeat(64), correlation_id: "c-1", join_token: "x".repeat(20),
};

describe("protocol v2", () => {
  it("accepts a valid Hello and intents; round-trips", () => {
    const r = parseClientFrame(JSON.stringify(hello));
    expect(r.ok && r.msg.type).toBe("Hello");
    const intent = { type: "Intent", intent_id: "i1", hand_id: "h1", expected_view_seq: 4, action: { t: "Play", card: "AS" } };
    const p = parseClientFrame(JSON.stringify(intent));
    expect(p.ok && JSON.stringify(p.msg)).toBe(JSON.stringify(intent));
    for (const action of [{ t: "ChooseTrump", suit: "H" }, { t: "Take" }]) {
      expect(parseClientFrame(JSON.stringify({ ...intent, action })).ok).toBe(true);
    }
  });
  it("rejects unknown fields, unknown types, bad cards, oversize and non-JSON (never throws)", () => {
    for (const bad of [
      { ...hello, extra: 1 },
      { type: "Teleport" },
      { type: "Intent", intent_id: "i", hand_id: "h", expected_view_seq: 0, action: { t: "Play", card: "ZZ" } },
      { type: "Intent", intent_id: "i", hand_id: "h", expected_view_seq: 0, action: { t: "Play", card: "AS", actor: 3 } },
      { type: "Chat", text: "x".repeat(201) },
      { type: "Intent", intent_id: "i", hand_id: "h", expected_view_seq: 0, action: { t: "ChooseTrump", suit: "X" } },
      { type: "Intent", intent_id: "i", hand_id: "h", expected_view_seq: 0, action: { t: "Take", from: 2 } },
    ]) expect(parseClientFrame(JSON.stringify(bad)).ok).toBe(false);
    expect(parseClientFrame("{").ok).toBe(false);
    expect(parseClientFrame(" ".repeat(MAX_FRAME_BYTES + 1)).ok).toBe(false);
  });
  it("clients cannot name an actor or seat in an intent (C-06)", () => {
    const r = parseClientFrame(JSON.stringify({ type: "Intent", intent_id: "i", hand_id: "h", expected_view_seq: 0, seat: 2, action: { t: "Call", n: 3 } }));
    expect(r.ok).toBe(false);
  });
  it("negotiates the highest common major; refuses retired v1", () => {
    expect(negotiate(1, 2)).toBe(2);
    expect(negotiate(1, 1)).toBeNull();
    expect(negotiate(3, 4)).toBeNull();
  });
  it("view hash is canonical (key order independent)", () => {
    expect(viewHash({ a: 1, b: [2] })).toBe(viewHash({ b: [2], a: 1 }));
  });
});
