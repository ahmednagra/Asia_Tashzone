import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, material, minTouchTarget, radius } from "../../theme/tokens";

/** Wide gold call-to-action with title, caption and chevron (mockup `.btn.pri.shine` with two lines). */
export function GoldGradientBar({ title, caption, onPress, disabled }: { title: string; caption?: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={caption ? `${title}. ${caption}` : title} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.9 : 1 })}>
      <LinearGradient colors={[material.btn1, material.btn2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bar}>
        <View style={s.text}>
          <Text style={[s.title, { color: material.btnInk }]}>{title}</Text>
          {caption ? <Text style={[s.cap, { color: material.btnInk }]}>{caption}</Text> : null}
        </View>
        <Text style={[s.chev, { color: material.btnInk }]}>›</Text>
      </LinearGradient>
    </Pressable>
  );
}
const s = StyleSheet.create({
  bar: { minHeight: minTouchTarget + 12, borderRadius: radius.sheet, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  text: { flex: 1 },
  title: { fontFamily: fonts.ui.family, fontWeight: "700", fontSize: 17 },
  cap: { fontFamily: fonts.ui.family, fontSize: 13, opacity: 0.85 },
  chev: { fontFamily: fonts.display.family, fontSize: 26 },
});
