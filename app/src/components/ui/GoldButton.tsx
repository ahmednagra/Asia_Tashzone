import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, minTouchTarget, type ThemeSpec } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

export function ButtonFace({ t, style, children }: { t: ThemeSpec; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const b = t.button;
  const shape = { borderRadius: t.shape.button };
  if (b.kind === "slab") {
    return (
      <View style={[shape, { backgroundColor: b.fill[0], borderWidth: 2, borderColor: t.surface.border, borderBottomWidth: 5, borderBottomColor: b.press }, style]}>
        <View style={[s.edge, { backgroundColor: b.edge, borderTopLeftRadius: t.shape.button, borderTopRightRadius: t.shape.button }]} />
        {children}
      </View>
    );
  }
  const vertical = b.kind === "embossed";
  return (
    <LinearGradient colors={b.fill} start={{ x: 0, y: 0 }} end={vertical ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={[shape, vertical && { borderBottomWidth: 2, borderBottomColor: b.press, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.45)" }, style]}>
      {children}
    </LinearGradient>
  );
}

export function buttonText(t: ThemeSpec) {
  return { color: t.button.ink, textTransform: t.button.caps ? ("uppercase" as const) : ("none" as const), letterSpacing: t.button.caps ? 1.4 : 0 };
}

/** Primary button (mockup `.btn`): `gold` = the room's primary, `glass` = outlined secondary. */
export function GoldButton({ label, onPress, kind = "gold", disabled, style }: { label: string; onPress: () => void; kind?: "gold" | "glass"; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c, t } = useTheme();
  const slab = t.surface.kind === "slab";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.88 : 1, transform: [{ translateY: pressed && t.button.kind !== "gradient" ? 2 : 0 }] }, style]}>
      {kind === "gold" ? (
        <ButtonFace t={t} style={s.btn}>
          <Text style={[s.text, buttonText(t)]}>{label}</Text>
        </ButtonFace>
      ) : (
        <View style={[s.btn, { borderRadius: t.shape.button, borderWidth: slab ? 2 : 1, borderColor: slab ? t.surface.border : c.borderControl, backgroundColor: t.surface.kind === "glass" ? t.surface.bg : c.surface }]}>
          <Text style={[s.text, { color: c.text, textTransform: t.button.caps ? "uppercase" : "none", letterSpacing: t.button.caps ? 1.2 : 0 }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  btn: { minHeight: minTouchTarget, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  edge: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  text: { fontFamily: fonts.ui.semibold, fontSize: 15 },
});
