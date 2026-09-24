import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { SuitBadge } from "../../components/ui/SuitBadge";
import { Collapsible } from "../../components/ui/Collapsible";
import { CardRow } from "../../components/ui/CardRow";
import { GAMES } from "../../constants/games";
import { HOWTO_INTRO, HOWTO_SECTIONS } from "../../constants/howto";
import { rulesFor } from "../../constants/rules";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { Caption } from "../../components/ui/Caption";
import { useGo } from "../../hooks/useGo";
import { Bullets } from "./parts";

const SUIT_OF: Record<string, "S" | "H" | "D" | "C"> = { callbreak: "S", callbridge: "S", courtpiece: "H", bhabhi: "H" };

/** How to play: the shared basics with small card examples, then one card per playable game (mockup `howto`). */
export function HowToScreen() {
  const { c } = useTheme();
  const go = useGo();
  const playable = GAMES.filter((g) => g.status === "play");
  return (
    <Screen>
      <Header title="How to play" />
      <Caption size={15}>{HOWTO_INTRO}</Caption>
      {HOWTO_SECTIONS.map((sec, i) => (
        <Collapsible key={sec.id} title={sec.title} defaultOpen={i === 0}>
          <Bullets items={sec.body} />
          {sec.examples?.map((ex) => <CardRow key={ex.caption} cards={ex.cards} caption={ex.caption} winner={ex.winner} />)}
        </Collapsible>
      ))}
      <SectionLabel>Each game in brief</SectionLabel>
      {playable.map((g) => (
        <GlassCard key={g.id}>
          <View style={s.row}>
            <SuitBadge suit={g.suit ?? SUIT_OF[g.id] ?? "S"} size={36} />
            <View style={s.flex}>
              <Text accessibilityRole="header" style={[s.name, { color: c.text }]}>{g.name}</Text>
              <Text style={[s.meta, { color: c.textMuted }]}>{[g.alias, rulesFor(g.id)?.players].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          <Text style={[s.goal, { color: c.textSecondary }]}>{rulesFor(g.id)?.goal}</Text>
          <View style={s.row}>
            <GoldButton kind="glass" label="Rules" style={s.flex} onPress={() => go(`/rules?game=${g.id}`)} />
            <GoldButton label="Play" style={s.flex} onPress={() => go(`/game/${g.id}`)} />
          </View>
        </GlassCard>
      ))}
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  flex: { flex: 1 },
  name: { fontFamily: fonts.display.family, fontSize: 20 },
  meta: { fontFamily: fonts.ui.family, fontSize: 13 },
  goal: { fontFamily: fonts.ui.family, fontSize: 15, lineHeight: 21, marginVertical: 10 },
});
