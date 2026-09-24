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
import { GameNotFound } from "./NotFound";
import { T, findGame, playable, playersText } from "./copy";

/** Game page (mockup "detail"): art header, description, rules summary, tags, Play → ways. */
export function DetailScreen({ id }: { id: string }) {
  const { c } = useTheme();
  const nav = useGameNav();
  const g = findGame(id);
  if (!g) return <GameNotFound />;
  const ready = playable(g);
  return (
    <Screen footer={<GoldButton label={ready ? T.detail.play : T.detail.soon} disabled={!ready} onPress={() => nav.ways(g)} />}>
      <Header title={g.name} />
      <GameArt game={g} />
      <View style={s.metaRow}>
        <Text style={[s.meta, { color: c.textSecondary }]}>
          {g.alias ? `${g.alias} · ` : ""}{g.region} · {T.detail.players(playersText(g))} · {g.teams ?? T.tile.solo}
        </Text>
        {g.difficulty ? <TagPill gold text={g.difficulty} /> : null}
        {(g.tags ?? []).map((tag) => <TagPill key={tag} text={tag} />)}
      </View>
      {g.description ? <Text style={[s.desc, { color: c.text }]}>{g.description}</Text> : null}
      {!ready && <Text style={[s.meta, { color: c.textMuted }]}>{T.detail.soonNote}</Text>}
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
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  meta: { fontFamily: fonts.ui.family, fontSize: 14, lineHeight: 19 },
  desc: { fontFamily: fonts.ui.family, fontSize: 17, lineHeight: 23 },
  rules: { gap: 8 },
  rule: { flexDirection: "row", gap: 10 },
  label: { width: 84, fontFamily: fonts.ui.family, fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase", paddingTop: 1 },
  text: { flex: 1, fontFamily: fonts.ui.family, fontSize: 15, lineHeight: 20 },
});
