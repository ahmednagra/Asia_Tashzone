import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";
import { TagPill } from "./TagPill";

/** Tappable glass row: icon slot, title, caption, optional badge and chevron (mockup `.panel.row` list items). `disabled` draws it dashed and inert. */
export function NavRow({ icon, title, caption, badge, onPress, disabled }: { icon?: string; title: string; caption?: string; badge?: string; onPress?: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={disabled ? s.off : undefined} accessibilityState={{ disabled: !!disabled }}>
      <GlassCard onPress={disabled ? undefined : onPress} label={`${title}${caption ? `. ${caption}` : ""}`} style={[s.row, disabled && s.dashed]}>
        {icon ? <View style={[s.icon, { borderColor: material.line }]}><Text style={{ color: material.goldLeaf, fontSize: 20 }}>{icon}</Text></View> : null}
        <View style={s.text}>
          <Text style={[s.title, { color: c.text }]}>{title}</Text>
          {caption ? <Text style={[s.cap, { color: c.textMuted }]}>{caption}</Text> : null}
        </View>
        {badge ? <TagPill text={badge} /> : null}
        {!disabled && <Text style={{ color: material.goldLeaf, fontSize: 24 }}>›</Text>}
      </GlassCard>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58 },
  dashed: { borderStyle: "dashed" },
  off: { opacity: 0.55 },
  icon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 1 },
  title: { fontFamily: fonts.ui.family, fontWeight: "600", fontSize: 15 },
  cap: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 17 },
});
