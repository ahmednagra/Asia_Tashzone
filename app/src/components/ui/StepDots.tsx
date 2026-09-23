import React from "react";
import { StyleSheet, View } from "react-native";
import { material } from "../../theme/tokens";

/** Progress dots for multi-step flows (mockup `.steps`); `at` is 1-based. */
export function StepDots({ n = 4, at }: { n?: number; at: number }) {
  return (
    <View style={s.steps} accessible accessibilityLabel={`Step ${at} of ${n}`}>
      {Array.from({ length: n }, (_, i) => <View key={i} style={[s.dot, { backgroundColor: i + 1 === at ? material.goldLeaf : material.line }]} />)}
    </View>
  );
}
const s = StyleSheet.create({ steps: { flexDirection: "row", gap: 6 }, dot: { flex: 1, height: 4, borderRadius: 2 } });
