import { describe, expect, it } from "vitest";
import { isCompleteCode, normalizeCode, spellCode } from "./roomCode";

describe("room codes", () => {
  it("normalises pasted text and drops characters no code contains", () => {
    expect(normalizeCode(" bk7-q2m9 ")).toBe("BK7Q2M");
    expect(normalizeCode("o0i1l")).toBe("");
  });
  it("accepts only a full six-character code", () => {
    expect(isCompleteCode("BK7Q2M")).toBe(true);
    expect(isCompleteCode("BK7Q2")).toBe(false);
    expect(isCompleteCode("bk7q2m")).toBe(false);
  });
  it("spells a code for screen readers", () => {
    expect(spellCode("BK7Q2M")).toBe("B K 7 Q 2 M");
  });
});
