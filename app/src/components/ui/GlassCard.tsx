import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { type ThemeSpec } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

export function surfaceStyle(t: ThemeSpec): ViewStyle {
  const sf = t.surface;
  const base = { backgroundColor: sf.bg, borderColor: sf.border, borderWidth: sf.borderWidth, borderRadius: t.shape.radius };
  if (sf.kind === "slab") return { ...base, borderBottomWidth: sf.borderWidth + 3 };
  if (sf.kind === "framed") return { ...base, borderTopColor: sf.shadow };
  return base;
}

/** The room's panel (glass, framed or slab). Pressable when `onPress` is set. */
export function GlassCard({ children, onPress, style, label }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  const { t } = useTheme();
  const base = [s.card, surfaceStyle(t), style];
  if (!onPress) return <View style={base}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
}
const s = StyleSheet.create({ card: { padding: 14 } });
