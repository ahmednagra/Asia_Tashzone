import { sha256 } from "@noble/hashes/sha2.js";
import { toHex, utf8 } from "./bytes.js";

/**
 * Canonical serialisation: JSON with object keys sorted by code unit, no whitespace,
 * safe integers only, undefined fields omitted. Used for state hashes, journal records,
 * profile hashes and view hashes. Serialisation is not rule logic, so key iteration here is allowed.
 */
export function canonicalize(v: unknown): string {
  if (v === null) return "null";
  switch (typeof v) {
    case "boolean": return v ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(v)) throw new Error("canonical: non-integer number");
      return String(v);
    case "string": return JSON.stringify(v);
    case "object": {
      if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).sort(compareCodeUnits);
      const parts: string[] = [];
      for (const k of keys) {
        const val = obj[k];
        if (val === undefined) continue;
        parts.push(JSON.stringify(k) + ":" + canonicalize(val));
      }
      return "{" + parts.join(",") + "}";
    }
    default: throw new Error("canonical: unsupported type " + typeof v);
  }
}

export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sha256Hex(data: Uint8Array | string): string {
  return toHex(sha256(typeof data === "string" ? utf8(data) : data));
}

export function hashCanonical(v: unknown): string {
  return sha256Hex(canonicalize(v));
}
