import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { fonts, minTouchTarget, radius } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Generic themed button (primary / quiet); 48 dp minimum touch target. */
export function Button({ label, onPress, kind = "primary", disabled }: { label: string; onPress: () => void; kind?: "primary" | "quiet"; disabled?: boolean }) {
  const { c } = useTheme();
  const primary = kind === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.btn, {
        backgroundColor: primary ? c.primary : "transparent", borderColor: primary ? c.primary : c.borderControl,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      }]}
    >
      <Text style={[s.btnText, { color: primary ? c.onPrimary : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: minTouchTarget, paddingHorizontal: 20, borderRadius: radius.control, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.ui.semibold, fontSize: 17 },
});
