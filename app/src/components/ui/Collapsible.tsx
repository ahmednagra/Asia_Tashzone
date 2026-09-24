import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, minTouchTarget } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";

/** Glass panel with a tappable heading that shows or hides its children. Exposes expanded state to screen readers. */
export function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassCard style={s.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={s.head}>
        <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>{title}</Text>
        <Text style={{ color: c.primary, fontSize: 20 }}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? <View style={s.body}>{children}</View> : null}
    </GlassCard>
  );
}
const s = StyleSheet.create({
  card: { padding: 0 },
  head: { minHeight: minTouchTarget + 4, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  title: { flex: 1, fontFamily: fonts.ui.semibold, fontSize: 16 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
});
