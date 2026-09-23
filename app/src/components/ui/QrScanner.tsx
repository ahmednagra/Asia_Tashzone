import React, { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { fonts, radius, typeScale } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "./GoldButton";

/**
 * Scans a table QR code. The camera permission is asked only when the player taps "Scan QR code", never on mount.
 * `onScanned` fires once per opening with the raw QR text; the caller validates it. `onCancel` closes the scanner.
 */
export function QrScanner({ onScanned, onCancel }: { onScanned: (data: string) => void; onCancel: () => void }) {
  const { c } = useTheme();
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
        <View style={s.frame} accessible accessibilityLabel="Camera view. Point it at the table QR code.">
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handle} />
        </View>
        <Text style={[s.text, { color: c.textSecondary }]}>Point the camera at the QR code on the host's screen.</Text>
        <GoldButton kind="glass" label="Cancel" onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      {askedAndRefused ? (
        <Text accessibilityLiveRegion="polite" style={[s.text, { color: c.warning }]}>
          {denied
            ? "Camera access is turned off for TashZone. Turn it on in your phone's settings to scan, or type the table code instead."
            : "TashZone needs the camera only to scan the table QR code. You can allow it, or type the table code instead."}
        </Text>
      ) : (
        <Text style={[s.text, { color: c.textSecondary }]}>The camera is used only to scan the QR code. Nothing is recorded or saved.</Text>
      )}
      {denied ? <GoldButton label="Open settings" onPress={() => void Linking.openSettings()} /> : <GoldButton label="Scan QR code" onPress={() => void start()} />}
      <GoldButton kind="glass" label="Cancel" onPress={onCancel} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  frame: { height: 320, borderRadius: radius.sheet, overflow: "hidden" },
  text: { fontFamily: fonts.ui.family, fontSize: typeScale.secondary, lineHeight: 21 },
});
