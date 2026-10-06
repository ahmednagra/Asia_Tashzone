import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { cards, fonts } from "../../theme/tokens";
import { SUIT_GLYPH } from "./copy";

/** Decorative face-up card for hero and catalogue art (rank "A", "10"...; suit S/H/D/C). Not the table's card. */
export function MiniCard({ rank, suit, width = 54, rotate = 0, dx = 0, dy = 0 }: { rank: string; suit: "S" | "H" | "D" | "C"; width?: number; rotate?: number; dx?: number; dy?: number }) {
  const color = suit === "H" || suit === "D" ? cards.red : cards.black;
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[s.card, { width, height: width * 1.4, borderRadius: width * 0.14, transform: [{ translateX: dx }, { translateY: dy }, { rotate: `${rotate}deg` }] }]}>
      <Text style={[s.rank, { color, fontSize: width * 0.3 }]}>{rank}</Text>
      <Text style={[s.pip, { color, fontSize: width * 0.5 }]}>{SUIT_GLYPH[suit]}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: cards.face, position: "absolute", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  rank: { position: "absolute", top: 3, left: 5, fontFamily: fonts.cardIndex.family },
  pip: { position: "absolute", bottom: 2, alignSelf: "center", left: 0, right: 0, textAlign: "center" },
});
