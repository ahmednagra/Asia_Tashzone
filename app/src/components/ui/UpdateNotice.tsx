import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { usePathname } from "expo-router";
import { GoldButton } from "./GoldButton";
import { StatusBanner } from "./StatusBanner";
import { U } from "./copy";

export function UpdateNotice() {
  const { isUpdatePending } = Updates.useUpdates();
  const inset = useSafeAreaInsets();
  const path = usePathname();
  const [later, setLater] = useState(false);
  const busy = path.startsWith("/play") || path.startsWith("/online") || path.startsWith("/tutorial") || path.startsWith("/wifi") || path.startsWith("/wait");
  if (!Updates.isEnabled || !isUpdatePending || later || busy) return null;
  return (
    <View style={[s.wrap, { bottom: inset.bottom + 72 }]} pointerEvents="box-none">
      <StatusBanner tone="info" title={U.updateTitle} body={U.updateBody}>
        <View style={s.row}>
          <GoldButton kind="glass" label={U.later} onPress={() => setLater(true)} style={s.grow} />
          <GoldButton label={U.restart} onPress={() => { Updates.reloadAsync().catch(() => setLater(true)); }} style={s.grow} />
        </View>
      </StatusBanner>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  row: { flexDirection: "row", gap: 8, marginTop: 4 },
  grow: { flex: 1 },
});
