import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AvatarBadge } from "../../components/ui/AvatarPicker";
import { Caption } from "../../components/ui/Caption";
import { Chip } from "../../components/ui/Chip";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { NavRow } from "../../components/ui/NavRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { SettingsScreen } from "../../components/ui/Settings";
import { StatBox } from "../../components/ui/StatBox";
import { useTheme } from "../../context/ThemeContext";
import { GAMES } from "../../constants/games";
import { useGameNav } from "../../hooks/useGameNav";
import { useProfile } from "../../store/profile";
import { winRate } from "../../store/profileModel";
import { fonts, onTable, radius } from "../../theme/tokens";
import { avatarName } from "../onboarding/AvatarView";
import { AvatarSheet } from "./AvatarSheet";
import { T } from "./copy";

const GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;

export function MeScreen() {
  const { c } = useTheme();
  const { profile: p } = useProfile();
  const nav = useGameNav();
  const [sheet, setSheet] = useState(false);
  const played = p.stats.matches > 0;
  const recent = p.recent.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is (typeof GAMES)[number] => !!g);
  const dealTarget = recent.find((g) => g.status === "play") ?? GAMES.find((g) => g.status === "play");

  const rankTitle =
    p.stats.wins >= 50
      ? "Mehfil Ustad"
      : p.stats.wins >= 20
      ? "Mehfil Player"
      : p.stats.wins >= 5
      ? "Rising Cardist"
      : "Shagird (Novice)";

  return (
    <SettingsScreen title={T.title} back={false} right={<Chip label={T.table} onPress={() => nav.router.push("/themes")} />}>
      <GlassCard style={s.passportCard}>
        <View style={s.passportHeader}>
          <Text style={s.passportLabel}>MEHFIL PASSPORT</Text>
          <View style={s.onDeviceBadge}>
            <Text style={s.onDeviceText}>100% On-Device</Text>
          </View>
        </View>

        <View style={s.who}>
          <AvatarBadge index={p.avatar} size={60} selected onPress={() => setSheet(true)} label={T.changeAvatar} />
          <View style={s.grow}>
            <View style={s.nameTitleRow}>
              <Text numberOfLines={1} style={[s.name, { color: c.text }]}>{p.name || T.defaultName}</Text>
            </View>
            <Text style={s.rankTitle}>{rankTitle}</Text>
            <Caption tone="muted">{played ? T.summary(p.stats.matches, avatarName(p.avatar)) : `${T.noHands} · ${avatarName(p.avatar)}`}</Caption>
          </View>
          <Chip label={T.edit} onPress={() => setSheet(true)} />
        </View>

        {p.stats.streak > 1 && (
          <View style={s.streakBanner}>
            <Text style={s.streakText}>🔥 Active Win Streak: {p.stats.streak} Matches</Text>
          </View>
        )}
      </GlassCard>

      {played ? (
        <>
          <View style={s.between}>
            <SectionLabel>{T.allTime}</SectionLabel>
            <Caption tone="muted">{T.won(winRate(p.stats))}</Caption>
          </View>
          <StatBox items={[{ value: p.stats.matches, label: T.matches }, { value: p.stats.wins, label: T.wins }, { value: p.stats.streak, label: T.streak }, { value: p.stats.bhabhi, label: T.bhabhi }]} />
        </>
      ) : (
        <GlassCard style={s.empty}>
          <Text style={[s.star, { color: c.primary }]}>✦</Text>
          <Text style={[s.emptyTitle, { color: c.text }]}>{T.emptyTitle}</Text>
          <Caption center>{T.emptyBody}</Caption>
          {dealTarget ? <GoldButton label={T.deal} onPress={() => nav.deal(dealTarget)} style={s.full} /> : null}
          <GoldButton kind="glass" label={T.browse} onPress={() => nav.router.push("/games")} style={s.full} />
        </GlassCard>
      )}

      {recent.length > 0 ? (
        <>
          <SectionLabel>{T.recent}</SectionLabel>
          {recent.map((g) => <NavRow key={g.id} icon={GLYPH[g.suit ?? "S"]} title={g.name} caption={g.region} onPress={() => nav.open(g)} />)}
        </>
      ) : null}

      <Caption center size={12} tone="muted">{T.localOnly}</Caption>
      <AvatarSheet visible={sheet} onClose={() => setSheet(false)} />
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  passportCard: {
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: onTable.gold,
  },
  passportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  passportLabel: {
    fontSize: 10.5,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: onTable.gold,
  },
  onDeviceBadge: {
    backgroundColor: "rgba(227, 189, 110, 0.15)",
    borderWidth: 1,
    borderColor: onTable.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 1.5,
  },
  onDeviceText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: onTable.gold,
  },
  who: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nameTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rankTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: onTable.gold,
  },
  streakBanner: {
    backgroundColor: "rgba(240, 138, 60, 0.15)",
    borderWidth: 1,
    borderColor: onTable.warning,
    borderRadius: radius.control,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  streakText: {
    fontSize: 11,
    fontWeight: "700",
    color: onTable.warning,
  },
  grow: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: fonts.display.family,
    fontSize: 20,
    fontWeight: "700",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
  },
  star: {
    fontSize: 24,
  },
  emptyTitle: {
    fontFamily: fonts.display.family,
    fontSize: 18,
    fontWeight: "600",
  },
  full: {
    alignSelf: "stretch",
  },
});
