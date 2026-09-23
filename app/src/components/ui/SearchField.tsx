import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { fonts, material, minTouchTarget } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Rounded search input (mockup `.field`). Controlled; `label` is the accessibility label. */
export function SearchField({ value, onChangeText, placeholder, label }: { value: string; onChangeText: (t: string) => void; placeholder: string; label: string }) {
  const { c, name } = useTheme();
  return (
    <View style={[s.box, { borderColor: name === "dark" ? material.line : c.borderControl, backgroundColor: name === "dark" ? material.glass : c.surface }]}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={c.textMuted} accessibilityLabel={label}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" style={[s.input, { color: c.text }]} />
    </View>
  );
}
const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, minHeight: minTouchTarget, justifyContent: "center", paddingHorizontal: 14 },
  input: { fontFamily: fonts.ui.family, fontSize: 16, minHeight: minTouchTarget },
});
