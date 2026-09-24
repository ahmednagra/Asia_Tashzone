/** Game, rules, length and player choices shared by the private-room screen and the same-Wi-Fi host screen. */
import React, { useEffect, useMemo, useState } from "react";
import { ChipGroup } from "../../components/ui/ChipGroup";
import { GAMES, SETUP } from "../../constants/games";
import { copy } from "../multiplayer/copy";

/** Games with a frozen rules profile: the ones a networked table can run. */
export const TABLE_GAMES = GAMES.filter((g) => g.profile && g.status === "play");

export function useTableSetup(game?: string) {
  const [gameId, setGameId] = useState(TABLE_GAMES.find((g) => g.id === game)?.id ?? TABLE_GAMES[0]?.id ?? "");
  const entry = TABLE_GAMES.find((g) => g.id === gameId);
  const setup = entry?.profile ? SETUP[entry.profile] : undefined;
  const [preset, setPreset] = useState<string>("");
  const [length, setLength] = useState(0);
  const [players, setPlayers] = useState(4);

  useEffect(() => {
    if (!setup) return;
    setPreset(setup.presets[0]?.id ?? "standard");
    setLength(setup.defaultLength);
    setPlayers(setup.players?.includes(4) ? 4 : setup.players?.[0] ?? 4);
  }, [setup]);

  const settings = useMemo(() => ({ ...(setup?.lengths[length]?.settings ?? {}), ...(setup?.players ? { players } : {}) }), [setup, length, players]);
  return { gameId, setGameId, entry, setup, preset, setPreset, length, setLength, players, setPlayers, settings };
}
export type TableSetup = ReturnType<typeof useTableSetup>;

export function TableSetupChips({ ts }: { ts: TableSetup }) {
  const { setup } = ts;
  if (!setup) return null;
  const t = copy.room;
  const hint = setup.presets.find((p) => p.id === ts.preset)?.hint;
  return (
    <>
      <ChipGroup label={t.game} value={ts.gameId} onChange={ts.setGameId} options={TABLE_GAMES.map((g) => ({ value: g.id, label: g.name }))} />
      <ChipGroup label={t.preset} value={ts.preset} onChange={ts.setPreset} hint={hint} options={setup.presets.map((p) => ({ value: p.id, label: p.label }))} />
      <ChipGroup label={setup.lengthLabel} value={ts.length} onChange={ts.setLength} options={setup.lengths.map((l, i) => ({ value: i, label: l.label }))} />
      {setup.players ? <ChipGroup label={t.players} value={ts.players} onChange={ts.setPlayers} options={setup.players.map((p) => ({ value: p, label: String(p) }))} /> : null}
    </>
  );
}
