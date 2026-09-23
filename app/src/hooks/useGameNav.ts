import { useCallback } from "react";
import { useRouter } from "expo-router";
import type { GameEntry } from "../types/game";
import { defaultSetup, playParams } from "../features/games/copy";

/** Navigation shared by Home, the catalogue and the game page. `deal` starts a bot table with the setup screen's defaults. */
export function useGameNav() {
  const router = useRouter();
  const open = useCallback((g: GameEntry) => router.push({ pathname: "/game/[id]", params: { id: g.id } }), [router]);
  const ways = useCallback((g: GameEntry) => router.push({ pathname: "/game/[id]/ways", params: { id: g.id } }), [router]);
  const deal = useCallback((g: GameEntry) => {
    const c = defaultSetup(g);
    if (c) router.push({ pathname: "/play/[game]", params: playParams(g, c) });
  }, [router]);
  return { open, ways, deal, router };
}
