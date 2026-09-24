import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";

/** GlassCard that shows a gold border when selected (mockup `.panel` with gold ring). */
export function SelectableCard({ on, label, onPress, style, children }: { on: boolean; label: string; onPress: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const { t } = useTheme();
  return <GlassCard label={label} onPress={onPress} style={[style, on && { borderColor: t.accent.color, borderWidth: 2 }]}>{children}</GlassCard>;
}
