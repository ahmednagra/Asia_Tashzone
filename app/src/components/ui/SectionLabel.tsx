import React from "react";
import { StyleSheet, Text } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Small uppercase group heading (mockup "PICK A GAME"). */
export function SectionLabel({ children }: { children: string }) {
  const { c, lang } = useTheme();
  return <Text accessibilityRole="header" style={[s.t, { color: c.textMuted }, lang !== "en" && { letterSpacing: 0 }]}>{lang === "en" ? children.toUpperCase() : children}</Text>;
}
const s = StyleSheet.create({ t: { fontFamily: fonts.ui.semibold, fontSize: 13, letterSpacing: 1.4, marginTop: 8 } });
