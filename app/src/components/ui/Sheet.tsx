import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, material, radius } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

/** Bottom sheet / dialog (mockup `sheetHTML` and `overlayHTML`): scrim tap and system back both close it. */
export function Sheet({ visible, title, onClose, children, actions }: { visible: boolean; title: string; onClose: () => void; children?: React.ReactNode; actions?: React.ReactNode }) {
  const { c, name } = useTheme();
  const inset = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { backgroundColor: name === "dark" ? "rgba(15,28,24,0.97)" : c.surface, borderColor: name === "dark" ? material.lineHard : c.borderSubtle, paddingBottom: inset.bottom + 16 }]}>
        <Text accessibilityRole="header" style={[s.title, { color: c.text }]}>{title}</Text>
        <ScrollView style={s.body}>{children}</ScrollView>
        {actions ? <View style={s.actions}>{actions}</View> : null}
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, padding: 16, gap: 12, maxHeight: "80%" },
  title: { fontFamily: fonts.display.family, fontSize: 24, fontWeight: "600" },
  body: { flexGrow: 0 },
  actions: { gap: 8 },
});
