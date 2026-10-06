import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { displayFace } from "../../i18n";
import { U } from "./copy";

/** Bottom sheet / dialog (mockup `sheetHTML` and `overlayHTML`): scrim tap and system back both close it. */
export function Sheet({ visible, title, onClose, children, actions }: { visible: boolean; title: string; onClose: () => void; children?: React.ReactNode; actions?: React.ReactNode }) {
  const { c, t, lang, rtl } = useTheme();
  const inset = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel={U.close} />
      <View style={[s.sheet, { backgroundColor: t.sheet.bg, borderColor: t.sheet.border, borderWidth: t.surface.kind === "slab" ? 2 : 1, borderTopLeftRadius: t.shape.sheet, borderTopRightRadius: t.shape.sheet, paddingBottom: inset.bottom + 16, direction: rtl ? "rtl" : "ltr" }, wide && s.wide]}>
        <Text accessibilityRole="header" style={[s.title, { color: c.text, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }, displayFace(t.type.display, t.type.titleCase === "uppercase" ? 19 : 24, lang)]}>{title}</Text>
        <ScrollView style={s.body}>{children}</ScrollView>
        {actions ? <View style={s.actions}>{actions}</View> : null}
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { padding: 16, gap: 12, maxHeight: "80%" },
  title: { fontFamily: fonts.display.family },
  wide: { maxHeight: "94%", width: "100%", maxWidth: 520, alignSelf: "center" },
  body: { flexGrow: 0 },
  actions: { gap: 8 },
});
