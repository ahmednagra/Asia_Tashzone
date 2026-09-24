import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, minTouchTarget } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { ButtonFace, buttonText } from "./GoldButton";

/** Wide gold call-to-action with title, caption and chevron (mockup `.btn.pri.shine` with two lines). */
export function GoldGradientBar({ title, caption, onPress, disabled }: { title: string; caption?: string; onPress: () => void; disabled?: boolean }) {
  const { t, rtl } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={caption ? `${title}. ${caption}` : title} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.9 : 1 })}>
      <ButtonFace t={t} style={s.bar}>
        <View style={s.text}>
          <Text style={[s.title, buttonText(t)]}>{title}</Text>
          {caption ? <Text style={[s.cap, { color: t.button.ink }]}>{caption}</Text> : null}
        </View>
        <Text style={[s.chev, { color: t.button.ink }]}>{rtl ? "‹" : "›"}</Text>
      </ButtonFace>
    </Pressable>
  );
}
const s = StyleSheet.create({
  bar: { minHeight: minTouchTarget + 12, paddingHorizontal: 18, paddingVertical: 10, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  text: { flex: 1 },
  title: { fontFamily: fonts.ui.bold, fontSize: 17 },
  cap: { fontFamily: fonts.ui.family, fontSize: 13, opacity: 0.9 },
  chev: { fontFamily: fonts.display.family, fontSize: 26 },
});
