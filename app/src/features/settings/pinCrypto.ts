import * as Crypto from "expo-crypto";
import { type Digest, hashPin } from "./pin";

/** SHA-256 hex via expo-crypto. */
export const sha256: Digest = (s) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s);

/** Random per-install salt (a v4 UUID from the platform CSPRNG). */
export const newSalt = () => Crypto.randomUUID();

/** Fresh salt plus hash for a newly chosen PIN. */
export async function makePinRecord(pin: string): Promise<{ salt: string; pinHash: string }> {
  const salt = newSalt();
  return { salt, pinHash: await hashPin(pin, salt, sha256) };
}
