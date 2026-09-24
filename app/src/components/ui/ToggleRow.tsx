import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Settings row: label, optional hint, switch. */
export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const { c, t } = useTheme();
  return (
    <View style={[s.row, { borderColor: c.borderSubtle }]}>
      <View style={s.text}>
        <Text style={[s.label, { color: c.text }]}>{label}</Text>
        {hint ? <Text style={[s.hint, { color: c.textMuted }]}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: t.accent.dim, false: c.borderControl }} thumbColor={value ? t.accent.color : c.textMuted} />
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 56, borderBottomWidth: 1, gap: 12 },
  text: { flex: 1, paddingVertical: 8 },
  label: { fontFamily: fonts.ui.family, fontSize: 17 },
  hint: { fontFamily: fonts.ui.family, fontSize: 13, marginTop: 2 },
});
