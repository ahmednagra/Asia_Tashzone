import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Secondary explanatory text (mockup `.cap`). */
export function Caption({ children, size = 13, center, tone = "secondary", style }: { children: React.ReactNode; size?: number; center?: boolean; tone?: "secondary" | "muted" | "warning" | "error"; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  const color = tone === "muted" ? c.textMuted : tone === "warning" ? c.warning : tone === "error" ? c.error : c.textSecondary;
  return <Text style={[{ color, fontFamily: fonts.ui.family, fontSize: size, lineHeight: Math.round(size * 1.45), textAlign: center ? "center" : "left" }, style]}>{children}</Text>;
}
