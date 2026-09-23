import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Small static label pill (mockup `.chip.mini`). Use `Chip` when the pill must be selectable. */
export function TagPill({ text, gold }: { text: string; gold?: boolean }) {
  const { c, name } = useTheme();
  return (
    <View style={[s.pill, { borderColor: gold ? material.goldLeafDim : name === "dark" ? material.line : c.borderControl }]}>
      <Text style={[s.text, { color: gold ? material.goldLeaf : c.textSecondary }]}>{text}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  text: { fontFamily: fonts.ui.family, fontSize: 12 },
});
