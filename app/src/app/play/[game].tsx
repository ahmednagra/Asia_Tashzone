import React from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { GAMES, SETUP } from "../../constants/games";
import { OfflineTable } from "../../features/play/OfflineTable";
import { parseSetupParams } from "../../features/play/setup";

/** /play/[game]?preset=&length=&players=&level=&handicap= : with a complete, valid set the table starts at once; otherwise the setup sheet shows. */
export default function PlayRoute() {
  const params = useLocalSearchParams<{ game: string; preset?: string; length?: string; players?: string; level?: string; handicap?: string }>();
  const router = useRouter();
  const entry = GAMES.find((g) => g.id === params.game);
  if (!entry?.profile) return <Redirect href="/" />;
  const initial = parseSetupParams(SETUP[entry.profile]!, params);
  return <OfflineTable gameId={entry.id} profileId={entry.profile} initial={initial} onExit={() => router.back()} />;
}
