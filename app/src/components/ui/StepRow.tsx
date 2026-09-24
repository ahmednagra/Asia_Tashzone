import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";

/** Numbered instruction card (mockup hotspot steps: `.panel.lift.row` + `.mono`). */
export function StepRow({ n, title, body }: { n: number; title: string; body: string }) {
  const { c, t } = useTheme();
  return (
    <GlassCard style={s.row}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.num, { backgroundColor: t.accent.color, borderRadius: t.shape.chip === 999 ? 17 : t.shape.radius }]}><Text style={[s.n, { color: t.accent.on, fontFamily: t.type.numerals }]}>{n}</Text></View>
      <View style={s.text} accessible accessibilityLabel={`Step ${n}. ${title}. ${body}`}>
        <Text style={[s.title, { color: c.text }]}>{title}</Text>
        <Text style={[s.body, { color: c.textSecondary }]}>{body}</Text>
      </View>
    </GlassCard>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  num: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  n: { fontFamily: fonts.ui.bold, fontSize: 15 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.ui.semibold, fontSize: 15 },
  body: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18 },
});
