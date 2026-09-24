import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { StatusBanner } from "./StatusBanner";

export function StorageNotice() {
  const { c } = useTheme();
  const { storageError } = useProfile();
  const inset = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  if (!storageError || dismissed) return null;
  return (
    <View style={[s.wrap, { top: inset.top + 8 }]} pointerEvents="box-none">
      <StatusBanner tone="warn" title="Your progress can't be saved right now" body="Changes work until you close the app. Free up some space on your phone, then reopen TashZone.">
        <Pressable accessibilityRole="button" onPress={() => setDismissed(true)} style={s.btn} hitSlop={8}>
          <Text style={[s.btnText, { color: c.text }]}>OK</Text>
        </Pressable>
      </StatusBanner>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  btn: { alignSelf: "flex-end", minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.ui.semibold, fontSize: 15 },
});
