import React from "react";
import { StyleSheet, Text } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { NavRow } from "../../components/ui/NavRow";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useGameNav } from "../../hooks/useGameNav";
import { GameNotFound } from "./NotFound";
import { T, findGame, playable } from "./copy";

/** Ways to play (mockup "ways"): bots, pass-and-play, Wi-Fi table, online private room. */
export function WaysScreen({ id }: { id: string }) {
  const { c } = useTheme();
  const { router } = useGameNav();
  const g = findGame(id);
  if (!g) return <GameNotFound />;
  const ready = playable(g);
  const w = T.ways;
  const rows = [
    { icon: "▶", ...w.bots, soon: false, go: () => router.push({ pathname: "/game/[id]/setup", params: { id: g.id } }) },
    { icon: "⇄", ...w.pass, soon: true, go: undefined },
    { icon: "⌁", ...w.wifi, soon: false, go: () => router.push({ pathname: "/wifi/host", params: { game: g.id } }) },
    { icon: "#", ...w.room, soon: false, go: () => router.push({ pathname: "/online/[game]", params: { game: g.id } }) },
  ];
  return (
    <Screen>
      <Header title={g.name} />
      <Text style={[s.text, { color: c.textSecondary }]}>{g.description}</Text>
      {!ready && <Text style={[s.text, { color: c.textMuted }]}>{w.soonGame}</Text>}
      {rows.map((r) => {
        const off = !ready || r.soon;
        return <NavRow key={r.t} icon={r.icon} title={r.t} caption={r.d} badge={!ready ? w.later : r.soon ? w.soonMode : r.b} disabled={off} onPress={off ? undefined : r.go} />;
      })}
    </Screen>
  );
}
const s = StyleSheet.create({ text: { fontFamily: fonts.ui.family, fontSize: 14, lineHeight: 19 } });
