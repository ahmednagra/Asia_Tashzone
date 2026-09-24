import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { Chip } from "../../components/ui/Chip";
import { ATLAS_GROUPS, atlasFor, atlasGroupLabel, type AtlasGroup } from "../../constants/atlas";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { Caption } from "../../components/ui/Caption";
import { useGo } from "../../hooks/useGo";
import { I } from "./copy";

/** Atlas (mockup "All screens"): every screen grouped; routes open for real, dialogs are shown as reference cards. */
export function AtlasScreen() {
  const { c, rtl } = useTheme();
  const go = useGo();
  const [group, setGroup] = useState<AtlasGroup>("All");
  const shown = atlasFor(group);
  return (
    <Screen>
      <Header title={I.atlas.title} right={<Text style={[s.count, { color: c.textMuted }]}>{I.atlas.count(shown.length, atlasFor("All").length)}</Text>} />
      <View style={s.chips}>{ATLAS_GROUPS.map((gr) => <Chip key={gr} label={atlasGroupLabel(gr)} on={gr === group} onPress={() => setGroup(gr)} />)}</View>
      {shown.map((x) => {
        const body = (
          <View style={s.row}>
            <View style={s.flex}>
              <Text style={[s.label, { color: c.text }]}>{x.label}</Text>
              {x.sub ? <Text style={[s.sub, { color: c.textSecondary }]}>{x.sub}</Text> : null}
            </View>
            <Text style={[s.tag, { color: c.textMuted }]}>{x.href ? `${atlasGroupLabel(x.group)} ${rtl ? "‹" : "›"}` : I.atlas.dialog}</Text>
          </View>
        );
        return x.href
          ? <GlassCard key={x.id} label={I.atlas.open(x.label)} onPress={() => go(x.href!)}>{body}</GlassCard>
          : <GlassCard key={x.id}>{body}</GlassCard>;
      })}
      <Caption size={15}>{I.atlas.note}</Caption>
    </Screen>
  );
}
const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  flex: { flex: 1 },
  label: { fontFamily: fonts.ui.semibold, fontSize: 16 },
  sub: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18, marginTop: 2 },
  tag: { fontFamily: fonts.ui.family, fontSize: 13 },
  count: { fontFamily: fonts.ui.family, fontSize: 13 },
});
