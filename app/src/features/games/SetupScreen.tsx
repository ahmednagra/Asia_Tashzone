import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { ChipGroup } from "../../components/ui/ChipGroup";
import { GoldButton } from "../../components/ui/GoldButton";
import { SETUP } from "../../constants/games";
import { GameNotFound } from "./NotFound";
import { type BotSetup, T, defaultSetup, findGame, playParams, playable } from "./copy";

/** Bot table setup (mockup "setup"): preset, length, players, bot level, handicap. Start opens /play/[game] with string params. */
export function SetupScreen({ id }: { id: string }) {
  const router = useRouter();
  const g = findGame(id);
  const info = g?.profile ? SETUP[g.profile] : undefined;
  const [c, setC] = useState<BotSetup | undefined>(() => (g ? defaultSetup(g) : undefined));
  if (!g) return <GameNotFound body={T.setup.notFound} />;
  if (!info || !c || !playable(g)) return <GameNotFound title={g.name} body={T.setup.notPlayable} />;
  const set = (patch: Partial<BotSetup>) => setC((prev) => (prev ? { ...prev, ...patch } : prev));
  const preset = info.presets.find((p) => p.id === c.preset);
  const level = T.setup.levels.find((l) => l.id === c.level);
  return (
    <Screen footer={<GoldButton label={T.setup.start} onPress={() => router.push({ pathname: "/play/[game]", params: playParams(g, c) })} />}>
      <Header title={T.setup.title} />
      <ChipGroup label={T.setup.rules} options={info.presets.map((p) => ({ value: p.id, label: p.label }))} value={c.preset} onChange={(v) => set({ preset: v })} hint={preset?.hint} />
      <ChipGroup label={info.lengthLabel} options={info.lengths.map((l, i) => ({ value: i, label: l.label }))} value={c.length} onChange={(v) => set({ length: v })} />
      {info.players && <ChipGroup label={T.setup.players} options={info.players.map((n) => ({ value: n, label: String(n) }))} value={c.players} onChange={(v) => set({ players: v })} hint={T.setup.playersHint} />}
      <ChipGroup label={T.setup.bots} options={T.setup.levels.map((l) => ({ value: l.id, label: l.label }))} value={c.level} onChange={(v) => set({ level: v as BotSetup["level"] })} hint={level?.hint} />
      {info.handicaps && <ChipGroup label={T.setup.deal} options={info.handicaps.map((h) => ({ value: h.value, label: h.label }))} value={c.handicap} onChange={(v) => set({ handicap: v })} />}
    </Screen>
  );
}
