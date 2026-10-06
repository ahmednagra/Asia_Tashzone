import React, { useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ErrorBoundary } from "../../components/ui/ErrorBoundary";
import { GAMES, SETUP } from "../../constants/games";
import { OfflineTable } from "../../features/play/OfflineTable";
import { parseSetupParams } from "../../features/play/setup";

/** /play/[game]?preset=&length=&players=&level=&handicap= : with a complete, valid set the table starts at once; otherwise the setup sheet shows. */
export default function PlayRoute() {
  const params = useLocalSearchParams<{ game: string; preset?: string; length?: string; players?: string; level?: string; handicap?: string }>();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const entry = GAMES.find((g) => g.id === params.game);
  const info = entry?.profile ? SETUP[entry.profile] : undefined;
  if (!entry?.profile || !info) return <Redirect href="/" />;
  const initial = attempt === 0 ? parseSetupParams(info, params) : null;
  return (
    <ErrorBoundary where="the table" onReset={() => setAttempt((a) => a + 1)}>
      <OfflineTable key={attempt} gameId={entry.id} profileId={entry.profile} initial={initial} onExit={() => router.back()} />
    </ErrorBoundary>
  );
}
