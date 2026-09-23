import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { type ThemePrefs, useTheme } from "../../ui/theme";
import { Button } from "../../ui/Button";

export function Settings({ prefs, onChange, onExit }: { prefs: ThemePrefs; onChange: (p: ThemePrefs) => void; onExit: () => void }) {
  const { c } = useTheme();
  const row = (label: string, value: boolean, set: (v: boolean) => void) => (
    <View style={[s.row, { borderColor: c.borderSubtle }]}>
      <Text style={{ color: c.text, fontSize: 17, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={set} accessibilityLabel={label} />
    </View>
  );
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={s.page}>
      <Text style={{ color: c.text, fontSize: 24, fontWeight: "600" }}>Settings</Text>
      {row("Light theme", prefs.name === "light", (v) => onChange({ ...prefs, name: v ? "light" : "dark" }))}
      {row("Four-colour deck", prefs.fourColor, (v) => onChange({ ...prefs, fourColor: v }))}
      {row("Reduce motion", prefs.reducedMotion, (v) => onChange({ ...prefs, reducedMotion: v }))}
      {row("Large cards", prefs.largeCards, (v) => onChange({ ...prefs, largeCards: v }))}
      <Button label="Done" onPress={onExit} />
    </ScrollView>
  );
}

const s = StyleSheet.create({ page: { padding: 20, paddingTop: 56, gap: 8 }, row: { flexDirection: "row", alignItems: "center", minHeight: 56, borderBottomWidth: 1 } });
