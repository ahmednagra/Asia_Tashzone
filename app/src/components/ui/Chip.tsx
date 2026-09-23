import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Selectable pill (mockup `.chip` / `.chip.on`). */
export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  const { c, name } = useTheme();
  const dark = name === "dark";
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: !!on }} onPress={onPress}
      style={[s.chip, { borderColor: on ? material.goldLeaf : dark ? material.line : c.borderControl, backgroundColor: on ? material.goldLeaf : dark ? material.glass : "transparent" }]}>
      <Text style={[s.text, { color: on ? material.btnInk : c.text }]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.ui.family, fontWeight: "600", fontSize: 14 },
});
