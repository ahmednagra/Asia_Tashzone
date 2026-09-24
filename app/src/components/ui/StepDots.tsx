import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";

/** Progress dots for multi-step flows (mockup `.steps`); `at` is 1-based. */
export function StepDots({ n = 4, at }: { n?: number; at: number }) {
  const { c, t } = useTheme();
  return (
    <View style={s.steps} accessible accessibilityLabel={`Step ${at} of ${n}`}>
      {Array.from({ length: n }, (_, i) => <View key={i} style={[s.dot, { backgroundColor: i + 1 <= at ? t.accent.color : c.borderControl }]} />)}
    </View>
  );
}
const s = StyleSheet.create({ steps: { flexDirection: "row", gap: 6 }, dot: { flex: 1, height: 4, borderRadius: 2 } });
