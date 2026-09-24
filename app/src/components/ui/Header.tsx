import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";

/** Top bar of a sub-screen (mockup `.head`): back arrow, title in the room's display face, optional right slot. */
export function Header({ title, back = true, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const { c, t } = useTheme();
  const router = useRouter();
  const caps = t.type.titleCase === "uppercase";
  return (
    <View>
      <View style={s.row}>
        {back ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.back}>
            <Text style={{ color: c.text, fontSize: 26 }}>‹</Text>
          </Pressable>
        ) : null}
        <Text accessibilityRole="header" numberOfLines={1}
          style={[s.title, { color: c.text, fontFamily: t.type.display, fontSize: caps ? 20 : 24, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }]}>{title}</Text>
        {right}
      </View>
      {t.ornament === "rule" ? (
        <View style={s.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[s.line, { backgroundColor: t.accent.dim }]} />
          <View style={[s.dot, { backgroundColor: t.accent.color }]} />
          <View style={[s.line, { backgroundColor: t.accent.dim }]} />
        </View>
      ) : null}
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  title: { flex: 1 },
  rule: { flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 2 },
  line: { flex: 1, height: 1 },
  dot: { width: 6, height: 6, transform: [{ rotate: "45deg" }] },
});
