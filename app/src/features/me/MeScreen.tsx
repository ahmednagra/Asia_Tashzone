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
import { fonts } from "../../theme/tokens";
import { avatarName } from "../onboarding/AvatarView";
import { AvatarSheet } from "./AvatarSheet";
import { T } from "./copy";

const GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;

/** You tab (mockup `me`): identity, real stats from the saved profile, recent games, avatar sheet. */
export function MeScreen() {
  const { c } = useTheme();
  const { profile: p } = useProfile();
  const nav = useGameNav();
  const [sheet, setSheet] = useState(false);
  const played = p.stats.matches > 0;
  const recent = p.recent.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is (typeof GAMES)[number] => !!g);
  const dealTarget = recent.find((g) => g.status === "play") ?? GAMES.find((g) => g.status === "play");

  return (
    <SettingsScreen title={T.title} back={false} right={<Chip label={T.table} onPress={() => nav.router.push("/themes")} />}>
      <GlassCard style={s.who}>
        <AvatarBadge index={p.avatar} size={56} selected onPress={() => setSheet(true)} label={T.changeAvatar} />
        <View style={s.grow}>
          <Text numberOfLines={1} style={[s.name, { color: c.text }]}>{p.name || T.defaultName}</Text>
          <Caption tone="muted">{played ? T.summary(p.stats.matches, avatarName(p.avatar)) : `${T.noHands} · ${avatarName(p.avatar)}`}</Caption>
        </View>
        <Chip label={T.edit} onPress={() => setSheet(true)} />
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
  who: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.display.family, fontSize: 20, fontWeight: "700" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  empty: { alignItems: "center", gap: 8, padding: 18 },
  star: { fontSize: 26 },
  emptyTitle: { fontFamily: fonts.display.family, fontSize: 18, fontWeight: "700" },
  full: { alignSelf: "stretch" },
});
