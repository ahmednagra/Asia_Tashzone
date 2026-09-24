import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { Chip } from "../../components/ui/Chip";
import { Collapsible } from "../../components/ui/Collapsible";
import { GAMES } from "../../constants/games";
import { rulesFor, teaserFor } from "../../constants/rules";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { Caption } from "../../components/ui/Caption";
import { useGo } from "../../hooks/useGo";
import { playable } from "../games/copy";
import { Bullets } from "./parts";
import { I } from "./copy";

const ORDER = [...GAMES.filter(playable), ...GAMES.filter((g) => !playable(g))];

/** Rules and terms: pick a game, read its rules in collapsible sections (mockup `rulesref` / detail "Rules" tab). */
export function RulesScreen() {
  const { c, t, rtl } = useTheme();
  const go = useGo();
  const { game } = useLocalSearchParams<{ game?: string }>();
  const [id, setId] = useState(() => (GAMES.some((g) => g.id === game) ? (game as string) : ORDER[0]!.id));
  useEffect(() => { if (game && GAMES.some((g) => g.id === game)) setId(game); }, [game]);
  const g = GAMES.find((x) => x.id === id)!;
  const rules = rulesFor(id);
  const teaser = teaserFor(id);
  const chips = ORDER.map((x) => <Chip key={x.id} label={playable(x) ? x.name : I.rules.soonChip(x.name)} on={x.id === id} onPress={() => setId(x.id)} />);
  return (
    <Screen>
      <Header title={I.rules.title} />
      {rtl ? (
        <View style={s.wrap} accessibilityRole="radiogroup">{chips}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.strip} contentContainerStyle={s.chips} accessibilityRole="radiogroup">{chips}</ScrollView>
      )}

      <View>
        <Text accessibilityRole="header" style={[s.title, { color: c.text, fontFamily: t.type.display, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }]}>{g.name}</Text>
        <Caption size={15}>{[g.alias, g.region, rules?.players].filter(Boolean).join(" · ")}</Caption>
      </View>

      {rules ? (
        <>
          <GlassCard><Text style={[s.goal, { color: c.text }]}>{rules.goal}</Text></GlassCard>
          {rules.sections.map((sec, i) => (
            <Collapsible key={sec.id} title={sec.title} defaultOpen={i === 0}><Bullets items={sec.body} /></Collapsible>
          ))}
          <Collapsible title={I.rules.terms}>
            <Bullets items={rules.terms.map((x) => I.rules.term(x.term, x.meaning))} />
          </Collapsible>
          {rules.varies.length ? (
            <Collapsible title={I.rules.varies}>
              <Bullets items={rules.varies} />
              <Caption size={15}>{I.rules.variesNote}</Caption>
            </Collapsible>
          ) : null}
          <GoldButton label={I.rules.play(g.name)} onPress={() => go(`/game/${g.id}`)} />
        </>
      ) : teaser ? (
        <GlassCard>
          <Text style={[s.goal, { color: c.text }]}>{teaser.goal}</Text>
          {teaser.deal ? <Caption size={15}>{I.rules.deal(teaser.deal)}</Caption> : null}
          {teaser.terms.length ? <Bullets items={teaser.terms.map((x) => I.rules.term(x.term, x.meaning))} /> : null}
          <Caption size={15}>{I.rules.teaserNote}</Caption>
        </GlassCard>
      ) : (
        <GlassCard>
          <Caption size={15}>{I.rules.missing}</Caption>
        </GlassCard>
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  strip: { flexGrow: 0, marginHorizontal: -16 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { fontSize: 28 },
  goal: { fontFamily: fonts.ui.family, fontSize: 17, lineHeight: 24, marginBottom: 8 },
});
