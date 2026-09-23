import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { Chip } from "../../components/ui/Chip";
import { ATLAS_GROUPS, atlasFor, type AtlasGroup } from "../../constants/atlas";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { Caption } from "../../components/ui/Caption";
import { useGo } from "../../hooks/useGo";

/** Atlas (mockup "All screens"): every screen grouped; routes open for real, dialogs are shown as reference cards. */
export function AtlasScreen() {
  const { c } = useTheme();
  const go = useGo();
  const [group, setGroup] = useState<AtlasGroup>("All");
  const shown = atlasFor(group);
  return (
    <Screen>
      <Header title="All screens" right={<Text style={[s.count, { color: c.textMuted }]}>{`${shown.length} of ${atlasFor("All").length}`}</Text>} />
      <View style={s.chips}>{ATLAS_GROUPS.map((gr) => <Chip key={gr} label={gr} on={gr === group} onPress={() => setGroup(gr)} />)}</View>
      {shown.map((x) => {
        const body = (
          <View style={s.row}>
            <View style={s.flex}>
              <Text style={[s.label, { color: c.text }]}>{x.label}</Text>
              {x.sub ? <Text style={[s.sub, { color: c.textSecondary }]}>{x.sub}</Text> : null}
            </View>
            <Text style={[s.tag, { color: c.textMuted }]}>{x.href ? `${x.group} ›` : "Dialog"}</Text>
          </View>
        );
        return x.href
          ? <GlassCard key={x.label} label={`Open ${x.label}`} onPress={() => go(x.href!)}>{body}</GlassCard>
          : <GlassCard key={x.label}>{body}</GlassCard>;
      })}
      <Caption size={15}>Tap a screen to open it for real. Dialogs appear over other screens, so they are listed with their wording.</Caption>
    </Screen>
  );
}
const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  flex: { flex: 1 },
  label: { fontFamily: fonts.ui.family, fontSize: 16, fontWeight: "600" },
  sub: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18, marginTop: 2 },
  tag: { fontFamily: fonts.ui.family, fontSize: 12 },
  count: { fontFamily: fonts.ui.family, fontSize: 13 },
});
