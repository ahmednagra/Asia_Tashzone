import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { material } from "../../theme/tokens";
import { GlassCard } from "./GlassCard";

/** GlassCard that shows a gold border when selected (mockup `.panel` with gold ring). */
export function SelectableCard({ on, label, onPress, style, children }: { on: boolean; label: string; onPress: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <GlassCard label={label} onPress={onPress} style={[style, on && { borderColor: material.goldLeaf }]}>{children}</GlassCard>;
}
