import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Glass panel (mockup `.gcard`): hairline gold border over dark, plain surface in light. Pressable when `onPress` is set. */
export function GlassCard({ children, onPress, style, label }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  const { c, name } = useTheme();
  const base = [s.card, { backgroundColor: name === "dark" ? material.glass : c.surface, borderColor: name === "dark" ? material.line : c.borderSubtle }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
}
const s = StyleSheet.create({ card: { borderWidth: 1, borderRadius: 15, padding: 14 } });
