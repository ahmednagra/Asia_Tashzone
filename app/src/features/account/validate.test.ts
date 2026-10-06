import { describe, expect, it } from "vitest";
import { codeOk, digitsOnly, emailOk, normalizeEmail, passwordOk } from "./validate";

describe("account validation", () => {
  it("accepts ordinary emails and normalizes case and spaces", () => {
    expect(emailOk(" Asha@Example.com ")).toBe(true);
    expect(normalizeEmail(" Asha@Example.com ")).toBe("asha@example.com");
    expect(emailOk("asha@example")).toBe(false);
    expect(emailOk("a b@example.com")).toBe(false);
    expect(emailOk("@example.com")).toBe(false);
  });

  it("matches the server password rule", () => {
    expect(passwordOk("cards2026")).toBe(true);
    expect(passwordOk("تاش2026کھیل")).toBe(true);
    expect(passwordOk("abcdefgh")).toBe(false);
    expect(passwordOk("12345678")).toBe(false);
    expect(passwordOk("ab1")).toBe(false);
    expect(passwordOk("a1".repeat(65))).toBe(false);
    expect(passwordOk("asha1@x.io", "Asha1@x.io")).toBe(false);
  });

  it("takes only six digits for a code", () => {
    expect(codeOk("012345")).toBe(true);
    expect(codeOk("12345")).toBe(false);
    expect(digitsOnly("12 34-5678")).toBe("123456");
  });
});
