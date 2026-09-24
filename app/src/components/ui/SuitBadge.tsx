import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

export type Suit = "S" | "H" | "D" | "C";
const GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

/** Round suit medallion used on game tiles. */
export function SuitBadge({ suit, size = 40 }: { suit: Suit; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={[s.b, { width: size, height: size, borderRadius: size / 2, borderColor: c.borderControl }]}>
      <Text style={{ color: suit === "H" || suit === "D" ? material.rougeLit : c.text, fontSize: size * 0.5 }}>{GLYPH[suit]}</Text>
    </View>
  );
}
const s = StyleSheet.create({ b: { borderWidth: 1, alignItems: "center", justifyContent: "center" } });
