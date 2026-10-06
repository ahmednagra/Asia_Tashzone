import React from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

/** Screen backdrop (mockup body): the room's ground with its top glow. Handles safe-area insets. */
export function Screen({ children, scroll = true, style, footer }: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; footer?: React.ReactNode }) {
  const { c, t } = useTheme();
  const inset = useSafeAreaInsets();
  const pad = { paddingTop: inset.top + 8, paddingBottom: footer ? 8 : inset.bottom + 24 };
  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <LinearGradient pointerEvents="none" colors={t.vignette} style={s.vignette} />
      {scroll ? (
        <ScrollView contentContainerStyle={[s.page, pad, style]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      ) : (
        <View style={[s.page, s.fill, pad, style]}>{children}</View>
      )}
      {footer ? <View style={[s.footer, { paddingBottom: inset.bottom + 12 }]}>{footer}</View> : null}
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  vignette: { position: "absolute", top: 0, left: 0, right: 0, height: 340 },
  page: { paddingHorizontal: 16, gap: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
});
