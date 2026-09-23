import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, material, minTouchTarget, radius } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Pill button (mockup `.btn`): `gold` = gradient primary, `glass` = outlined secondary. */
export function GoldButton({ label, onPress, kind = "gold", disabled, style }: { label: string; onPress: () => void; kind?: "gold" | "glass"; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c, name } = useTheme();
  const dark = name === "dark";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.9 : 1 }, style]}>
      {kind === "gold" ? (
        <LinearGradient colors={[material.btn1, material.btn2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
          <Text style={[s.text, { color: material.btnInk }]}>{label}</Text>
        </LinearGradient>
      ) : (
        <View style={[s.btn, { borderWidth: 1, borderColor: dark ? material.line : c.borderControl, backgroundColor: dark ? material.glass : "transparent" }]}>
          <Text style={[s.text, { color: c.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  btn: { minHeight: minTouchTarget, borderRadius: radius.chip, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: fonts.ui.family, fontWeight: "600", fontSize: 15 },
});
