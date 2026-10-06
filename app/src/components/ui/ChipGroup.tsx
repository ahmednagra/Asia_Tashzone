import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { Chip } from "./Chip";

/** Labelled single-choice group of `Chip`s (mockup `.lab` + `.seg`/`.chip` rows). */
export function ChipGroup<V extends string | number>({ label, options, value, onChange, hint }: { label: string; options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; hint?: string }) {
  const { c, lang } = useTheme();
  return (
    <View style={s.wrap}>
      <Text style={[s.label, { color: c.textMuted }, lang !== "en" && s.plain]}>{lang === "en" ? label.toUpperCase() : label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.row}>
        {options.map((o) => <Chip key={String(o.value)} label={o.label} on={o.value === value} onPress={() => onChange(o.value)} />)}
      </View>
      {hint ? <Text style={[s.hint, { color: c.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.ui.semibold, fontSize: 13, letterSpacing: 1.4 },
  plain: { letterSpacing: 0 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hint: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18 },
});
