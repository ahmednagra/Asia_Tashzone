import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Chip } from "../../components/ui/Chip";
import { TagPill } from "../../components/ui/TagPill";
import { StatBox } from "../../components/ui/StatBox";
import { NavRow } from "../../components/ui/NavRow";
import { GoldGradientBar } from "../../components/ui/GoldGradientBar";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { useGameNav } from "../../hooks/useGameNav";
import { GAMES } from "../../constants/games";
import { GameTile } from "../games/GameTile";
import { CardFan } from "../games/CardFan";
import { T, findGame, playable } from "../games/copy";

/** Home (mockup "home"): wordmark + level, card fan, stats, quick play, "pick a game", join shortcuts. */
export function Home() {
  const { t } = useTheme();
  const { profile } = useProfile();
  const nav = useGameNav();
  const { stats, recent } = profile;
  const shelf = [...new Set([...recent, ...GAMES.filter(playable).map((g) => g.id)])].map(findGame).filter((g): g is NonNullable<typeof g> => !!g && playable(g));
  const quick = shelf[0];
  const level = 1 + Math.floor(stats.matches / 5);
  return (
    <Screen>
      <View style={s.head}>
        <Text accessibilityRole="header" style={[s.title, { color: t.accent.color, fontFamily: t.type.display, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }]}>{T.home.title}</Text>
        <TagPill gold text={`★ ${T.home.level(level)}`} />
      </View>
      <CardFan />
      <StatBox items={[
        { value: stats.matches, label: T.home.stats[0] }, { value: stats.wins, label: T.home.stats[1] },
        { value: stats.streak, label: T.home.stats[2] }, { value: stats.bhabhi, label: T.home.stats[3] },
      ]} />
      {quick && <GoldGradientBar title={T.home.quick} caption={T.home.quickSub(quick.name)} onPress={() => nav.deal(quick)} />}
      <View style={s.pickRow}>
        <View style={s.flex}><SectionLabel>{T.home.pick}</SectionLabel></View>
        <Chip label={T.home.all(GAMES.length)} onPress={() => nav.router.push("/games")} />
      </View>
      {shelf.map((g) => <GameTile key={g.id} game={g} lastPlayed={g.id === recent[0]} onOpen={() => nav.open(g)} onPlay={() => nav.deal(g)} />)}
      <SectionLabel>{T.home.join}</SectionLabel>
      <NavRow icon="⌁" title={T.home.joinWifi} caption={T.home.joinWifiSub} onPress={() => nav.router.push("/wifi/join")} />
      <NavRow icon="#" title={T.home.joinRoom} caption={T.home.joinRoomSub} onPress={() => nav.router.push("/wifi/pin")} />
    </Screen>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  title: { fontFamily: fonts.display.family, fontSize: 32 },
  pickRow: { flexDirection: "row", alignItems: "center" },
  flex: { flex: 1 },
});
