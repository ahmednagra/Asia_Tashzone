import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Caption } from "../../components/ui/Caption";
import { SettingsScreen } from "../../components/ui/Settings";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { useTheme } from "../../context/ThemeContext";
import { fonts, material } from "../../theme/tokens";
import { T } from "./copy";

/** Table cloth designs from the mockup (name, base colour, accent). Decorative data for the preview; not applied to the table yet. */
const DESIGNS: { name: string; base: string; accent: string }[] = [
  { name: "Truck art", base: "#a81f16", accent: "#e3bd6e" }, { name: "Ajrak", base: "#16294f", accent: "#a81f16" },
  { name: "Multani blue", base: "#1b4f9c", accent: "#f4ecd8" }, { name: "Phulkari", base: "#a81f16", accent: "#f0b45a" },
  { name: "Chiniot wood", base: "#5a3a1e", accent: "#2e1c11" }, { name: "Balochi mirror", base: "#7a1f2a", accent: "#e3bd6e" },
  { name: "Sindhi rilli", base: "#1b6b3a", accent: "#f0b45a" }, { name: "Camel lamp", base: "#8a5a1e", accent: "#f4d9a4" },
  { name: "Warli", base: "#8a3a1e", accent: "#f4ecd8" }, { name: "Bandhani", base: "#a81f16", accent: "#f4ecd8" },
  { name: "Jaipur print", base: "#16294f", accent: "#f4ecd8" }, { name: "Kalamkari", base: "#5a2a1e", accent: "#e3bd6e" },
  { name: "Nakshi kantha", base: "#1b6b3a", accent: "#f4ecd8" }, { name: "Jamdani", base: "#f4ecd8", accent: "#16294f" },
  { name: "Rickshaw art", base: "#a81f16", accent: "#f0b45a" }, { name: "Terracotta", base: "#8a3a1e", accent: "#c98a5a" },
  { name: "Mithila", base: "#1b4f9c", accent: "#f0b45a" }, { name: "Newari window", base: "#3a2510", accent: "#e3bd6e" },
  { name: "Dhaka fabric", base: "#16294f", accent: "#e3bd6e" },
];

/** Table designs gallery: a preview only. The table always renders the standard felt, so nothing here can be chosen yet. */
export function ThemesScreen() {
  const { c } = useTheme();
  const t = T.themes;
  return (
    <SettingsScreen title={t.title}>
      <Caption>{t.intro}</Caption>
      <StatusBanner tone="info" title={t.soon} body={t.note} />
      <View style={s.grid}>
        {DESIGNS.map((d) => (
          <View key={d.name} accessible accessibilityLabel={`${d.name}, ${t.soon}`} style={[s.cell, { borderColor: material.line }]}>
            <View style={[s.swatch, { backgroundColor: d.base }]}>
              <View style={[s.band, { backgroundColor: d.accent }]} />
            </View>
            <Text numberOfLines={2} style={[s.name, { color: c.text }]}>{d.name}</Text>
          </View>
        ))}
      </View>
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { width: "30.5%", borderWidth: 1, borderRadius: 12, overflow: "hidden", opacity: 0.8 },
  swatch: { height: 64, justifyContent: "flex-end" },
  band: { height: 10 },
  name: { fontFamily: fonts.ui.semibold, fontSize: 12, padding: 8, minHeight: 44 },
});
