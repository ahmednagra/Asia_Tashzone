import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Small static label pill (mockup `.chip.mini`). Use `Chip` when the pill must be selectable. */
export function TagPill({ text, gold }: { text: string; gold?: boolean }) {
  const { c, t } = useTheme();
  return (
    <View style={[s.pill, { borderRadius: t.shape.chip, borderColor: gold ? t.accent.dim : c.borderControl }]}>
      <Text style={[s.text, { color: gold ? t.accent.color : c.textSecondary }]}>{text}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  pill: { borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  text: { fontFamily: fonts.ui.family, fontSize: 12 },
});
