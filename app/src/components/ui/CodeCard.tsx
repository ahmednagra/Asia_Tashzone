import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";
import { GoldButton } from "./GoldButton";

/** Big spaced code to read aloud (mockup `.panel.lift` + `.lab` + `.code`): room code or PIN, with an optional action. `code` may be a placeholder like "····". */
export function CodeCard({ label, code, hint, actionLabel, onAction, placeholder }: { label: string; code: string; hint?: string; actionLabel?: string; onAction?: () => void; placeholder?: boolean }) {
  const { c, t, lang } = useTheme();
  const spoken = placeholder ? "not available" : code.split("").join(" ");
  return (
    <GlassCard style={s.card}>
      <View style={s.main}>
        <Text style={[s.label, { color: c.textMuted }, lang !== "en" && { letterSpacing: 0 }]}>{lang === "en" ? label.toUpperCase() : label}</Text>
        <Text accessibilityLabel={`${label}: ${spoken}`} style={[s.code, { color: placeholder ? c.textMuted : t.accent.color, fontFamily: t.type.numerals }]}>{code}</Text>
        {hint ? <Text style={[s.hint, { color: c.textSecondary }]}>{hint}</Text> : null}
      </View>
      {actionLabel && onAction ? <GoldButton kind="glass" label={actionLabel} onPress={onAction} /> : null}
    </GlassCard>
  );
}
const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12 },
  main: { flex: 1, gap: 4 },
  label: { fontFamily: fonts.ui.semibold, fontSize: 13, letterSpacing: 1.3 },
  code: { fontFamily: fonts.display.family, fontSize: 32, letterSpacing: 8, lineHeight: 38 },
  hint: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18 },
});
