import { describe, expect, it } from "vitest";
import { clampYear, isProtectedForBirth } from "./copy";

describe("onboarding helpers", () => {
  it("clamps years", () => { expect(clampYear(1900, 2026)).toBe(1930); expect(clampYear(2100, 2026)).toBe(2026); });
  it("protects under 13", () => { expect(isProtectedForBirth(2020, 2026)).toBe(true); expect(isProtectedForBirth(2013, 2026)).toBe(false); });
});
