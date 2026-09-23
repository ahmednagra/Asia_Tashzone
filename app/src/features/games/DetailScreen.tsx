import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { TagPill } from "../../components/ui/TagPill";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useGameNav } from "../../hooks/useGameNav";
import { GameArt } from "./GameArt";
import { T, findGame, playable, playersText } from "./copy";

/** Game page (mockup "detail"): art header, description, rules summary, tags, Play → ways. */
export function DetailScreen({ id }: { id: string }) {
  const { c } = useTheme();
  const nav = useGameNav();
  const g = findGame(id);
  if (!g) return <Screen><Header title={T.detail.notFound} /></Screen>;
  const ready = playable(g);
  return (
    <Screen footer={<GoldButton label={ready ? T.detail.play : T.detail.soon} disabled={!ready} onPress={() => nav.ways(g)} />}>
      <Header title={g.name} />
      <GameArt game={g} />
      <Text style={[s.meta, { color: c.textSecondary }]}>
        {g.alias ? `${g.alias} · ` : ""}{g.region} · {T.detail.players(playersText(g))} · {g.teams ?? "Solo"}
      </Text>
      {g.description ? <Text style={[s.desc, { color: c.text }]}>{g.description}</Text> : null}
      {!ready && <Text style={[s.meta, { color: c.textMuted }]}>{T.detail.soonNote}</Text>}
      <View style={s.tags}>
        {g.difficulty ? <TagPill gold text={g.difficulty} /> : null}
        {(g.tags ?? []).map((t) => <TagPill key={t} text={t} />)}
      </View>
      <SectionLabel>{T.detail.rules}</SectionLabel>
      <GlassCard style={s.rules}>
        {g.rules?.length ? g.rules.map((r) => (
          <View key={r.label} style={s.rule}>
            <Text style={[s.label, { color: c.textMuted }]}>{r.label}</Text>
            <Text style={[s.text, { color: c.text }]}>{r.text}</Text>
          </View>
        )) : <Text style={[s.text, { color: c.textMuted }]}>{T.detail.pick}</Text>}
      </GlassCard>
    </Screen>
  );
}
const s = StyleSheet.create({
  meta: { fontFamily: fonts.ui.family, fontSize: 14, lineHeight: 19 },
  desc: { fontFamily: fonts.display.family, fontSize: 21, lineHeight: 27 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rules: { gap: 10 },
  rule: { flexDirection: "row", gap: 10 },
  label: { width: 84, fontFamily: fonts.ui.family, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", paddingTop: 2 },
  text: { flex: 1, fontFamily: fonts.ui.family, fontSize: 15, lineHeight: 21 },
});
