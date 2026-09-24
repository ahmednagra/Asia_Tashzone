import React from "react";
import { StyleSheet, Text } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Small uppercase group heading (mockup "PICK A GAME"). */
export function SectionLabel({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text accessibilityRole="header" style={[s.t, { color: c.textMuted }]}>{children.toUpperCase()}</Text>;
}
const s = StyleSheet.create({ t: { fontFamily: fonts.ui.semibold, fontSize: 12, letterSpacing: 1.4, marginTop: 8 } });
