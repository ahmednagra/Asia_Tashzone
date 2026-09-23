/** Byte helpers. Pure; no host globals beyond typed arrays (TextEncoder is avoided for the zero-global bundle). */
const HEX = "0123456789abcdef";

export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function toHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) { const v = b[i] as number; s += HEX[v >> 4]! + HEX[v & 15]!; }
  return s;
}

export function fromHex(h: string): Uint8Array {
  if (h.length % 2 !== 0 || !/^[0-9a-f]*$/.test(h)) throw new Error("bad hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Length-prefixed concatenation: u32be(len) ‖ bytes for every part (unambiguous framing). */
export function frame(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += 4 + p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    const n = p.length;
    out[o] = (n >>> 24) & 255; out[o + 1] = (n >>> 16) & 255; out[o + 2] = (n >>> 8) & 255; out[o + 3] = n & 255;
    out.set(p, o + 4);
    o += 4 + n;
  }
  return out;
}
