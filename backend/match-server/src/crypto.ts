import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** CSPRNG server seed (CG-03). */
export function newServerSeed(): string { return randomBytes(32).toString("hex"); }

/** AES-256-GCM seed encryption at rest until seal (T-18). Output: iv ‖ tag ‖ ciphertext, hex. */
export function encryptSeed(keyHex: string, seedHex: string, aad: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(Buffer.from(seedHex, "hex")), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("hex");
}

export function decryptSeed(keyHex: string, blobHex: string, aad: string): string {
  const b = Buffer.from(blobHex, "hex");
  const d = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), b.subarray(0, 12));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("hex");
}
