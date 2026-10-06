import React, { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { fonts, typeScale } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "./GoldButton";
import { copy } from "../../features/multiplayer/copy";

/**
 * Scans a table QR code. The camera permission is asked only when the player taps "Scan QR code", never on mount.
 * `onScanned` fires once per opening with the raw QR text; the caller validates it. `onCancel` closes the scanner.
 */
export function QrScanner({ onScanned, onCancel }: { onScanned: (data: string) => void; onCancel: () => void }) {
  const { c, t: room } = useTheme();
  const t = copy.scanner;
  const [permission, requestPermission] = useCameraPermissions();
  const [open, setOpen] = useState(false);
  const done = useRef(false);

  const start = useCallback(async () => {
    done.current = false;
    if (permission?.granted) return setOpen(true);
    const result = await requestPermission();
    if (result.granted) setOpen(true);
  }, [permission?.granted, requestPermission]);

  const handle = useCallback(
    ({ data }: { data: string }) => {
      if (done.current) return;
      done.current = true;
      setOpen(false);
      onScanned(data);
    },
    [onScanned],
  );

  const denied = permission !== null && !permission.granted && !permission.canAskAgain;
  const askedAndRefused = permission !== null && !permission.granted && permission.status === "denied";

  if (open && permission?.granted) {
    return (
      <View style={s.wrap}>
        <View style={[s.frame, { borderRadius: room.shape.sheet }]} accessible accessibilityLabel={t.camera}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handle} />
        </View>
        <Text style={[s.text, { color: c.textSecondary }]}>{t.point}</Text>
        <GoldButton kind="glass" label={t.cancel} onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {askedAndRefused ? (
        <Text accessibilityLiveRegion="polite" style={[s.text, { color: c.warning }]}>
          {denied
            ? t.off
            : t.why}
        </Text>
      ) : (
        <Text style={[s.text, { color: c.textSecondary }]}>{t.privacy}</Text>
      )}
      {denied ? <GoldButton label={t.settings} onPress={() => void Linking.openSettings()} /> : <GoldButton label={t.scan} onPress={() => void start()} />}
      <GoldButton kind="glass" label={t.cancel} onPress={onCancel} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  frame: { height: 320, overflow: "hidden" },
  text: { fontFamily: fonts.ui.family, fontSize: typeScale.secondary, lineHeight: 21 },
});
