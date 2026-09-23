import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";

/** Status panel (mockup overlays: "Connection lost", "Room locked", offline): tone stripe, optional spinner, title, body and action slot. */
export function StatusBanner({ tone = "info", title, body, busy, children }: { tone?: "info" | "warn" | "error"; title: string; body?: string; busy?: boolean; children?: React.ReactNode }) {
  const { c } = useTheme();
  const color = tone === "error" ? c.error : tone === "warn" ? c.warning : c.info;
  return (
    <GlassCard style={[s.card, { borderColor: color }]}>
      <View style={s.head} accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={body ? `${title}. ${body}` : title}>
        {busy ? <ActivityIndicator color={color} /> : null}
        <Text style={[s.title, { color }]}>{title}</Text>
      </View>
      {body ? <Text style={[s.body, { color: c.textSecondary }]}>{body}</Text> : null}
      {children}
    </GlassCard>
  );
}
const s = StyleSheet.create({
  card: { gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontFamily: fonts.ui.family, fontWeight: "700", fontSize: 15, flexShrink: 1 },
  body: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18 },
});
