import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AvatarBadge } from "../../components/ui/AvatarPicker";
import { Caption } from "../../components/ui/Caption";
import { Chip } from "../../components/ui/Chip";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { NavRow } from "../../components/ui/NavRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { SettingsScreen } from "../../components/ui/Settings";
import { TagPill } from "../../components/ui/TagPill";
import { useTheme } from "../../context/ThemeContext";
import { displayFace } from "../../i18n";
import { GAMES } from "../../constants/games";
import { useGameNav } from "../../hooks/useGameNav";
import { useProfile } from "../../store/profile";
import { winRate } from "../../store/profileModel";
import { fonts } from "../../theme/tokens";
import type { GameEntry } from "../../types/game";
import { avatarName } from "../onboarding/AvatarView";
import { playable } from "../games/copy";
import { AvatarSheet } from "./AvatarSheet";
import { T } from "./copy";

const GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;
const RECENT_SHOWN = 3;

export function MeScreen() {
  const { c, t, lang } = useTheme();
  const latin = lang === "en";
  const { profile: p } = useProfile();
  const nav = useGameNav();
  const [sheet, setSheet] = useState(false);
  const played = p.stats.matches > 0;
  const recent = useMemo(() => p.recent.map((id) => GAMES.find((g) => g.id === id)).filter((g): g is GameEntry => !!g), [p.recent]);
  const dealTarget = recent.find(playable) ?? GAMES.find(playable);
  const rankTitle = T.ranks[T.rankFor(p.stats.wins)];
  const caps = t.type.titleCase === "uppercase";
  const stats = [
    { value: p.stats.matches, label: T.matches }, { value: p.stats.wins, label: T.wins },
    { value: p.stats.streak, label: T.streak }, { value: p.stats.bhabhi, label: T.bhabhi },
  ];

  return (
    <SettingsScreen title={T.title} back={false} right={<Chip label={T.table} onPress={() => nav.router.push("/themes")} />}>
      <GlassCard style={s.passport}>
        <View style={s.between}>
          <Text style={[s.passportLabel, { color: t.accent.color }, !latin && s.plain]}>{latin ? T.passport.toUpperCase() : T.passport}</Text>
          <TagPill gold text={T.onDevice} />
        </View>

        <View style={s.who}>
          <AvatarBadge index={p.avatar} size={60} selected onPress={() => setSheet(true)} label={T.changeAvatar} />
          <View style={s.grow}>
            <Text numberOfLines={1} style={[{ color: c.text, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }, displayFace(t.type.display, caps ? 18 : 22, lang)]}>
              {p.name || T.defaultName}
            </Text>
            <Text style={[s.rank, { color: t.value.coins }]}>{rankTitle}</Text>
            <Caption tone="muted">{played ? T.summary(p.stats.matches, avatarName(p.avatar)) : `${T.noHands} · ${avatarName(p.avatar)}`}</Caption>
          </View>
          <Chip label={T.edit} onPress={() => setSheet(true)} />
        </View>

        {p.stats.streak > 1 ? (
          <View style={[s.streak, { borderColor: c.warning, borderRadius: t.shape.chip === 999 ? 12 : t.shape.chip }]}>
            <Text style={[s.streakText, { color: c.warning }]}>{T.streakLine(p.stats.streak)}</Text>
          </View>
        ) : null}
      </GlassCard>

      {played ? (
        <>
          <View style={s.between}>
            <SectionLabel>{T.allTime}</SectionLabel>
            <Caption tone="muted">{T.won(winRate(p.stats))}</Caption>
          </View>
          <GlassCard style={s.stats}>
            {stats.map((it) => (
              <View key={it.label} style={s.cell} accessible accessibilityLabel={`${it.label}: ${it.value}`}>
                <Text style={[s.value, { color: c.text, fontFamily: t.type.numerals }]}>{it.value}</Text>
                <Text style={[s.label, { color: c.textMuted }]}>{it.label}</Text>
              </View>
            ))}
          </GlassCard>
        </>
      ) : (
        <GlassCard style={s.empty}>
          <Text style={[s.star, { color: t.accent.color }]}>✦</Text>
          <Text style={[s.emptyTitle, { color: c.text, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }, displayFace(t.type.display, 18, lang)]}>{T.emptyTitle}</Text>
          <Caption center>{T.emptyBody}</Caption>
          {dealTarget ? <GoldButton label={T.deal} onPress={() => nav.deal(dealTarget)} style={s.full} /> : null}
          <GoldButton kind="glass" label={T.browse} onPress={() => nav.router.push("/games")} style={s.full} />
        </GlassCard>
      )}

      {recent.length > 0 ? (
        <>
          <SectionLabel>{T.recent}</SectionLabel>
          {recent.slice(0, RECENT_SHOWN).map((g) => <NavRow key={g.id} icon={GLYPH[g.suit ?? "S"]} title={g.name} caption={g.region} onPress={() => nav.open(g)} />)}
        </>
      ) : null}

      <Caption center size={13} tone="muted">{T.localOnly}</Caption>
      <AvatarSheet visible={sheet} onClose={() => setSheet(false)} />
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  passport: { gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  passportLabel: { fontFamily: fonts.ui.bold, fontSize: 13, letterSpacing: 1.4 },
  plain: { letterSpacing: 0 },
  who: { flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  rank: { fontFamily: fonts.ui.semibold, fontSize: 13 },
  streak: { borderWidth: 1, paddingVertical: 4, paddingHorizontal: 10, alignItems: "center" },
  streakText: { fontFamily: fonts.ui.bold, fontSize: 13 },
  stats: { flexDirection: "row", paddingVertical: 10 },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  value: { fontSize: 26 },
  label: { fontFamily: fonts.ui.family, fontSize: 13 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  star: { fontSize: 24 },
  emptyTitle: { textAlign: "center" },
  full: { alignSelf: "stretch" },
});
