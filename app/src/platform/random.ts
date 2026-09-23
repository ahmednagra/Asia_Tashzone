import { getRandomBytes } from "expo-crypto";

/** 32 CSPRNG bytes as hex: offline hand seeds and online client seed contributions (P-09). */
export function randomSeedHex(): string {
  const b = getRandomBytes(32);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i]!.toString(16).padStart(2, "0");
  return s;
}
