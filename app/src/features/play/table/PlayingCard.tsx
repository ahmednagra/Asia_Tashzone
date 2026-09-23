import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { cards, fonts, material, onTable, radius } from "../../../theme/tokens";
import { SUIT_GLYPH, cardLabel, rankLabel } from "./logic";
import { useTheme } from "../../../context/ThemeContext";

export interface PlayingCardProps {
  card?: string;          // undefined = face-down
  width: number;
  legal?: boolean;        // halo on the felt around the card, never a tint on the face
  lifted?: boolean;
  onPress?: () => void;
  /** when set, a card that is not playable is still pressable (the caller explains why) */
  pressableWhenBlocked?: boolean;
  hitSlopRight?: number;  // extends a covered card's hit area toward its uncovered edge
}

export function PlayingCard({ card, width, legal, lifted, onPress, pressableWhenBlocked, hitSlopRight = 0 }: PlayingCardProps) {
  const t = useTheme();
  const h = Math.round(width * 1.4);
  const suits = t.fourColor ? cards.fourColor : cards.twoColor;
  const face = card ? (
    <View style={[s.face, { width, height: h, borderRadius: radius.card }]}>
      <Text style={[s.index, { color: suits[card[1] as keyof typeof suits], fontSize: width * 0.3 }]}>{rankLabel(card)}</Text>
      <Text style={[s.pip, { color: suits[card[1] as keyof typeof suits], fontSize: width * 0.26 }]}>{SUIT_GLYPH[card[1]!]}</Text>
      <Text style={[s.center, { color: suits[card[1] as keyof typeof suits], fontSize: width * 0.5 }]}>{SUIT_GLYPH[card[1]!]}</Text>
    </View>
  ) : (
    <View accessible accessibilityLabel="face-down card" style={[s.back, { width, height: h, borderRadius: radius.card }]}>
      <View style={[s.backInner, { borderRadius: radius.card - 3 }]} />
    </View>
  );
  const halo = legal ? { borderColor: onTable.legalHalo, borderWidth: 2 } : { borderColor: "transparent", borderWidth: 2 };
  const body = (
    <View style={[s.halo, halo, { borderRadius: radius.card + 3, transform: [{ translateY: lifted ? -12 : legal ? -6 : 0 }] }]}>{face}</View>
  );
  if (!onPress || !card) return body;
  return (
    <Pressable
      onPress={onPress}
      disabled={!legal && !pressableWhenBlocked}
      hitSlop={{ top: 8, bottom: 8, left: 0, right: hitSlopRight }}
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card, legal)}
      accessibilityState={{ disabled: !legal }}
    >
      {body}
    </Pressable>
  );
}

const s = StyleSheet.create({
  halo: { padding: 1 },
  face: {
    backgroundColor: cards.face, paddingHorizontal: 4, paddingTop: 2, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  index: { fontFamily: fonts.cardIndex.family, fontWeight: "700", lineHeight: undefined },
  pip: { marginTop: -4 },
  center: { position: "absolute", right: 4, bottom: 0, opacity: 0.9 },
  back: { backgroundColor: material.felt, padding: 3, borderWidth: 1, borderColor: material.goldLeafDim },
  backInner: { flex: 1, borderWidth: 1, borderColor: material.goldLeaf, backgroundColor: material.feltDeep, opacity: 0.9 },
});
