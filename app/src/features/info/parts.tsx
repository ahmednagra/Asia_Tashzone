import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, typeScale } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Bulleted lines, used by every info screen for rule text, terms and notes. */
export function Bullets({ items }: { items: string[] }) {
  const { c } = useTheme();
  return (
    <View style={s.list}>
      {items.map((t, i) => (
        <View key={i} style={s.item}>
          <Text style={{ color: c.primary }} importantForAccessibility="no">•</Text>
          <Text style={[s.text, { color: c.textSecondary }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: 6 },
  item: { flexDirection: "row", gap: 8 },
  text: { flex: 1, fontFamily: fonts.ui.family, fontSize: typeScale.secondary, lineHeight: 21 },
});
