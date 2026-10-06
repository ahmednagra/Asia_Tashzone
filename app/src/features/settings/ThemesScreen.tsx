import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Caption } from "../../components/ui/Caption";
import { SettingsScreen } from "../../components/ui/Settings";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/tokens";
import { T } from "./copy";

/** Table cloth designs from the mockup (base colour, accent). Decorative data for the preview; not applied to the table yet. */
const DESIGNS: { base: string; accent: string }[] = [
  { base: "#a81f16", accent: "#e3bd6e" }, { base: "#16294f", accent: "#a81f16" },
  { base: "#1b4f9c", accent: "#f4ecd8" }, { base: "#a81f16", accent: "#f0b45a" },
  { base: "#5a3a1e", accent: "#2e1c11" }, { base: "#7a1f2a", accent: "#e3bd6e" },
  { base: "#1b6b3a", accent: "#f0b45a" }, { base: "#8a5a1e", accent: "#f4d9a4" },
  { base: "#8a3a1e", accent: "#f4ecd8" }, { base: "#a81f16", accent: "#f4ecd8" },
  { base: "#16294f", accent: "#f4ecd8" }, { base: "#5a2a1e", accent: "#e3bd6e" },
  { base: "#1b6b3a", accent: "#f4ecd8" }, { base: "#f4ecd8", accent: "#16294f" },
  { base: "#a81f16", accent: "#f0b45a" }, { base: "#8a3a1e", accent: "#c98a5a" },
  { base: "#1b4f9c", accent: "#f0b45a" }, { base: "#3a2510", accent: "#e3bd6e" },
  { base: "#16294f", accent: "#e3bd6e" },
];

/** Table designs gallery: a preview only. The table always renders the standard felt, so nothing here can be chosen yet. */
export function ThemesScreen() {
  const { c, t: room } = useTheme();
  const t = T.themes;
  return (
    <SettingsScreen title={t.title}>
      <Caption>{t.intro}</Caption>
      <StatusBanner tone="info" title={t.soon} body={t.note} />
      <View style={s.grid}>
        {DESIGNS.map((d, i) => (
          <View key={i} accessible accessibilityLabel={`${t.designs[i]}, ${t.soon}`} style={[s.cell, { borderColor: room.surface.border, borderWidth: room.surface.borderWidth, borderRadius: room.shape.radius, backgroundColor: room.surface.bg }]}>
            <View style={[s.swatch, { backgroundColor: d.base }]}>
              <View style={[s.band, { backgroundColor: d.accent }]} />
            </View>
            <Text numberOfLines={2} style={[s.name, { color: c.text }]}>{t.designs[i]}</Text>
          </View>
        ))}
      </View>
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "30.5%", overflow: "hidden", opacity: 0.8 },
  swatch: { height: 64, justifyContent: "flex-end" },
  band: { height: 10 },
  name: { fontFamily: fonts.ui.semibold, fontSize: 13, lineHeight: 19, padding: 8, minHeight: 44 },
});
