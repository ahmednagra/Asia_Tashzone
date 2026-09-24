import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";

/** Row of big-number stats in one glass panel (mockup `.statgrid`). */
export function StatBox({ items }: { items: { value: number | string; label: string }[] }) {
  const { c } = useTheme();
  return (
    <GlassCard style={s.panel}>
      {items.map((it) => (
        <View key={it.label} style={s.cell} accessible accessibilityLabel={`${it.label}: ${it.value}`}>
          <Text style={[s.value, { color: c.text }]}>{it.value}</Text>
          <Text style={[s.label, { color: c.textMuted }]}>{it.label}</Text>
        </View>
      ))}
    </GlassCard>
  );
}
const s = StyleSheet.create({
  panel: { flexDirection: "row", paddingVertical: 10 },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  value: { fontFamily: fonts.display.family, fontSize: 26 },
  label: { fontFamily: fonts.ui.family, fontSize: 12 },
});
