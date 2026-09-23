import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Top bar of a sub-screen (mockup `.head`): back arrow, title, optional right slot. */
export function Header({ title, back = true, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View style={s.row}>
      {back ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={s.back}>
          <Text style={{ color: c.text, fontSize: 26 }}>‹</Text>
        </Pressable>
      ) : null}
      <Text accessibilityRole="header" style={[s.title, { color: c.text }]} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -8 },
  title: { flex: 1, fontFamily: fonts.display.family, fontSize: 24, fontWeight: "600" },
});
