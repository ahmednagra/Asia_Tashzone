import type { HostTable } from "./hostTable.js";
import { LAN_HOST_JOIN_TOKEN, linkSocket, memoryLink } from "./linkSocket.js";

/**
 * The host phone plays too: its own `MatchClient` connects to its own table through an in-memory link (no TCP, no PIN).
 * `new MatchClient({ ...hostSeat(table), engineBuildHash, behaviourDigest, versionCode, randomSeed })`.
 */
export function hostSeat(table: HostTable) {
  return {
    url: "lan://host",
    joinToken: LAN_HOST_JOIN_TOKEN,
    socket: (_url: string) => linkSocket(memoryLink((link) => table.acceptHost(link))),
  };
}
