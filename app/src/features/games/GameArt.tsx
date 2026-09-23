import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { material } from "../../theme/tokens";
import type { GameEntry } from "../../types/game";
import { MiniCard } from "./MiniCard";

/** Felt banner with three cards in the game's suit (mockup detail header). Decorative. */
export function GameArt({ game }: { game: GameEntry }) {
  const suit = game.suit ?? "S";
  return (
    <View style={s.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient colors={[material.feltLit, material.felt, material.feltDeep]} style={s.fill} />
      <View style={s.origin}>
        <MiniCard rank="K" suit={suit} width={40} rotate={-11} dx={-32} dy={4} />
        <MiniCard rank="A" suit={suit} width={40} rotate={0} dx={0} dy={-2} />
        <MiniCard rank="Q" suit={suit} width={40} rotate={11} dx={32} dy={4} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { height: 96, borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: material.line },
  fill: StyleSheet.absoluteFill,
  origin: { position: "absolute", top: 20, left: "50%", marginLeft: -20 },
});
