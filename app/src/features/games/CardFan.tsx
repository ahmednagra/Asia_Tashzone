import React from "react";
import { StyleSheet, View } from "react-native";
import { MiniCard } from "./MiniCard";

const FAN = [["A", "S"], ["K", "H"], ["Q", "D"], ["J", "C"], ["10", "S"]] as const;

/** Home hero: five cards fanned on an arc (decorative). */
export function CardFan() {
  return (
    <View style={s.hero} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={s.origin}>
        {FAN.map(([r, su], i) => <MiniCard key={r + su} rank={r} suit={su} width={54} rotate={(i - 2) * 11} dx={(i - 2) * 30} dy={Math.abs(i - 2) * 6} />)}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  hero: { height: 110, alignItems: "center" },
  origin: { position: "absolute", top: 6, left: "50%", width: 0, height: 0, marginLeft: -27 },
});
