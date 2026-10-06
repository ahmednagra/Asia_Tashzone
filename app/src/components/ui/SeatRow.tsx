import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";

/** One seat in a lobby (mockup `.panel.row` + `.mono`): initial or "+" avatar, name, status. `filled=false` draws an open seat (dashed avatar). */
export function SeatRow({ name, status, filled, ok }: { name: string; status: string; filled: boolean; ok?: boolean }) {
  const { c, t } = useTheme();
  return (
    <GlassCard style={s.row}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={[s.avatar, filled ? { backgroundColor: t.accent.color } : { borderColor: c.borderControl, borderStyle: "dashed", borderWidth: 1 }]}>
        <Text style={[s.initial, { color: filled ? t.accent.on : c.textMuted }]}>{filled ? (name[0] ?? "?").toUpperCase() : "+"}</Text>
      </View>
      <View style={s.grow} accessible accessibilityLabel={`${name}, ${status}`}>
        <Text style={[s.name, { color: filled ? c.text : c.textMuted }]} numberOfLines={1}>{name}</Text>
      </View>
      <Text style={[s.status, { color: ok ? c.success : c.textMuted }]}>{status}</Text>
    </GlassCard>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 6 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.ui.bold, fontSize: 15 },
  grow: { flex: 1 },
  name: { fontFamily: fonts.ui.family, fontSize: 16 },
  status: { fontFamily: fonts.ui.family, fontSize: 13 },
});
