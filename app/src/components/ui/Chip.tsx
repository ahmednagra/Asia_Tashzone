import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Selectable pill (mockup `.chip` / `.chip.on`). */
export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const { c, t } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: !!on }} onPress={onPress}
      style={[s.chip, { borderRadius: t.shape.chip, borderColor: on ? t.accent.color : c.borderControl, backgroundColor: on ? t.accent.color : "transparent" }]}>
      <Text style={[s.text, { color: on ? t.accent.on : c.text }]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.ui.semibold, fontSize: 14 },
});
