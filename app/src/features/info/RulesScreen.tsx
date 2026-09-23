import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { Chip } from "../../components/ui/Chip";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Collapsible } from "../../components/ui/Collapsible";
import { GAMES } from "../../constants/games";
import { rulesFor, teaserFor } from "../../constants/rules";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { Caption } from "../../components/ui/Caption";
import { useGo } from "../../hooks/useGo";
import { Bullets } from "./parts";

/** Rules and terms: pick a game, read its rules in collapsible sections (mockup `rulesref` / detail "Rules" tab). */
export function RulesScreen() {
  const { c } = useTheme();
  const go = useGo();
  const { game } = useLocalSearchParams<{ game?: string }>();
  const [id, setId] = useState(() => (GAMES.some((g) => g.id === game) ? (game as string) : GAMES[0]!.id));
  const g = GAMES.find((x) => x.id === id)!;
  const rules = rulesFor(id);
  const teaser = teaserFor(id);
  return (
    <Screen>
      <Header title="Rules and terms" />
      <SectionLabel>Playable now</SectionLabel>
      <View style={s.chips}>{GAMES.filter((x) => x.status === "play").map((x) => <Chip key={x.id} label={x.name} on={x.id === id} onPress={() => setId(x.id)} />)}</View>
      <SectionLabel>Coming soon</SectionLabel>
      <View style={s.chips}>{GAMES.filter((x) => x.status === "soon").map((x) => <Chip key={x.id} label={x.name} on={x.id === id} onPress={() => setId(x.id)} />)}</View>

      <View>
        <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>{g.name}</Text>
        <Caption size={15}>{[g.alias, g.region, rules?.players].filter(Boolean).join(" · ")}</Caption>
      </View>

      {rules ? (
        <>
          <GlassCard><Text style={[s.goal, { color: c.text }]}>{rules.goal}</Text></GlassCard>
          {rules.sections.map((sec, i) => (
            <Collapsible key={sec.id} title={sec.title} defaultOpen={i === 0}><Bullets items={sec.body} /></Collapsible>
          ))}
          <Collapsible title="What the words mean">
            <Bullets items={rules.terms.map((t) => `${t.term}: ${t.meaning}`)} />
          </Collapsible>
          {rules.varies.length ? (
            <Collapsible title="Varies by region">
              <Bullets items={rules.varies} />
              <Caption size={15}>Nothing is chosen for you: every table shows which style is in play.</Caption>
            </Collapsible>
          ) : null}
          <GoldButton label={`Play ${g.name}`} onPress={() => go(`/game/${g.id}`)} />
        </>
      ) : teaser ? (
        <GlassCard>
          <Text style={[s.goal, { color: c.text }]}>{teaser.goal}</Text>
          {teaser.deal ? <Caption size={15}>{`The deal: ${teaser.deal}`}</Caption> : null}
          {teaser.terms.length ? <Bullets items={teaser.terms.map((t) => `${t.term}: ${t.meaning}`)} /> : null}
          <Caption size={15}>Full rules arrive when the game can be played.</Caption>
        </GlassCard>
      ) : null}
    </Screen>
  );
}
const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: { fontFamily: fonts.display.family, fontSize: 28, fontWeight: "600" },
  goal: { fontFamily: fonts.ui.family, fontSize: 17, lineHeight: 24, marginBottom: 8 },
});
