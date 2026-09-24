import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Chip } from "../../components/ui/Chip";
import { TagPill } from "../../components/ui/TagPill";
import { StatBox } from "../../components/ui/StatBox";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { useGameNav } from "../../hooks/useGameNav";
import { GAMES } from "../../constants/games";
import type { GameEntry } from "../../types/game";
import { GameTile } from "../games/GameTile";
import { T, findGame, playable } from "../games/copy";

const PLAYABLE_IDS = GAMES.filter(playable).map((g) => g.id);

/** Home (mockup "home"): wordmark + level, stats, "pick a game" shelf, join shortcuts. */
export function Home() {
  const { t } = useTheme();
  const { profile } = useProfile();
  const { open, deal, router } = useGameNav();
  const { stats, recent } = profile;
  const shelf = useMemo(
    () => [...new Set([...recent, ...PLAYABLE_IDS])].map(findGame).filter((g): g is GameEntry => !!g && playable(g)),
    [recent],
  );
  const level = 1 + Math.floor(stats.matches / 5);
  const caps = t.type.titleCase === "uppercase";
  return (
    <Screen>
      <View style={s.head}>
        <Text accessibilityRole="header" numberOfLines={1}
          style={[s.title, { color: t.accent.color, fontFamily: t.type.display, letterSpacing: t.type.tracking, textTransform: t.type.titleCase, fontSize: caps ? 26 : 32 }]}>{T.home.title}</Text>
        <TagPill gold text={`★ ${T.home.level(level)}`} />
      </View>
      <StatBox items={[
        { value: stats.matches, label: T.home.stats[0] }, { value: stats.wins, label: T.home.stats[1] },
        { value: stats.streak, label: T.home.stats[2] }, { value: stats.bhabhi, label: T.home.stats[3] },
      ]} />
      <View style={s.row}>
        <View style={s.flex}><SectionLabel>{T.home.pick}</SectionLabel></View>
        <Chip label={T.home.all(GAMES.length)} onPress={() => router.push("/games")} />
      </View>
      {shelf.map((g) => <GameTile key={g.id} compact game={g} lastPlayed={g.id === recent[0]} onOpen={open} onPlay={deal} />)}
      <View style={s.row}>
        <View style={s.flex}><SectionLabel>{T.home.join}</SectionLabel></View>
        <View style={s.chips}>
          <Chip label={T.home.joinNearby} onPress={() => router.push("/wifi/join")} />
          <Chip label={T.home.joinCode} onPress={() => router.push("/wifi/pin")} />
        </View>
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 48 },
  title: { flexShrink: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
});
