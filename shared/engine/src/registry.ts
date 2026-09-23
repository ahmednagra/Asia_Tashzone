/** GameId → module, for callers that only know an id at runtime (match server, offline table, bots). */
import type { GameModule } from "./core/contract.js";
import type { GameId } from "./core/types.js";
import { callbreak } from "./games/callbreak.js";
import { courtpiece } from "./games/courtpiece.js";
import { bhabhi } from "./games/bhabhi.js";

export const GAMES: Readonly<Record<GameId, GameModule>> = { callbreak, courtpiece, bhabhi };
export const GAME_IDS: readonly GameId[] = ["callbreak", "courtpiece", "bhabhi"];

export function getModule(id: string): GameModule {
  const m = (GAMES as Record<string, GameModule | undefined>)[id];
  if (!m) throw new Error(`unknown game ${id}`);
  return m;
}

/** Profile id → game id ("courtpiece.tz@1" → "courtpiece"; Call Bridge runs on the Callbreak module). */
export function gameOfProfile(profileId: string): GameId {
  const family = profileId.split(".")[0];
  if (family === "callbreak" || family === "callbridge") return "callbreak";
  if (family === "courtpiece") return "courtpiece";
  if (family === "bhabhi") return "bhabhi";
  throw new Error(`unknown profile ${profileId}`);
}
