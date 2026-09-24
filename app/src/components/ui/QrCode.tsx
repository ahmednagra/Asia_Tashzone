import React from "react";
import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { cards } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

const QUIET_ZONE = 12;

/**
 * QR code for a table link. Always dark modules on a light plate with a quiet zone, in both themes, because
 * scanners need that contrast. `label` is what a screen reader announces (never put the PIN in it).
 */
export function QrCode({ value, size = 200, label = "QR code to join the table" }: { value: string; size?: number; label?: string }) {
  const { t } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[s.plate, { padding: QUIET_ZONE, borderRadius: Math.min(t.shape.radius, QUIET_ZONE) }]}>
      <QRCode value={value} size={size} color={cards.black} backgroundColor={cards.face} ecl="M" quietZone={0} />
    </View>
  );
}

const s = StyleSheet.create({
  plate: { alignSelf: "center", backgroundColor: cards.face },
});
