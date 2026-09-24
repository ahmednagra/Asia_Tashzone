import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { cards, fonts, material, onTable, radius } from "../../../theme/tokens";
import { SUIT_GLYPH, cardLabel, rankLabel } from "./logic";
import { useTheme } from "../../../context/ThemeContext";

export interface PlayingCardProps {
  card?: string;
  width: number;
  legal?: boolean;
  lifted?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
  pressableWhenBlocked?: boolean;
  hitSlopRight?: number;
}

export function PlayingCard({
  card,
  width,
  legal = false,
  lifted = false,
  dimmed = false,
  onPress,
  pressableWhenBlocked,
  hitSlopRight = 0,
}: PlayingCardProps) {
  const t = useTheme();
  const h = Math.round(width * 1.4);
  const suits = t.fourColor ? cards.fourColor : cards.twoColor;

  const liftAnim = useRef(new Animated.Value(lifted ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(liftAnim, {
      toValue: lifted ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [lifted, liftAnim]);

  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [legal ? -4 : 0, -18],
  });

  const scale = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });

  const face = card ? (
    <View
      style={[
        s.face,
        { width, height: h, borderRadius: radius.card },
        dimmed && s.faceDimmed,
      ]}
    >
      <Text style={[s.index, { color: suits[card[1] as keyof typeof suits], fontSize: Math.max(12, width * 0.3) }]}>
        {rankLabel(card)}
      </Text>
      <Text style={[s.pip, { color: suits[card[1] as keyof typeof suits], fontSize: Math.max(10, width * 0.26) }]}>
        {SUIT_GLYPH[card[1]!]}
      </Text>
      <Text style={[s.center, { color: suits[card[1] as keyof typeof suits], fontSize: Math.max(18, width * 0.5) }]}>
        {SUIT_GLYPH[card[1]!]}
      </Text>
    </View>
  ) : (
    <View accessible accessibilityLabel="face-down card" style={[s.back, { width, height: h, borderRadius: radius.card }]}>
      <View style={[s.backInner, { borderRadius: radius.card - 3 }]} />
    </View>
  );

  const haloBorderColor = lifted
    ? "#F6E0B0"
    : legal
    ? onTable.legalHalo
    : "transparent";

  const body = (
    <Animated.View
      style={[
        s.halo,
        {
          borderColor: haloBorderColor,
          borderRadius: radius.card + 3,
          transform: [{ translateY }, { scale }],
        },
        lifted && s.liftedGlow,
        dimmed && { opacity: 0.45 },
      ]}
    >
      {face}
    </Animated.View>
  );

  if (!onPress || !card) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={!legal && !pressableWhenBlocked}
      hitSlop={{ top: 12, bottom: 12, left: 2, right: Math.max(hitSlopRight, 4) }}
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card, legal)}
      accessibilityState={{ disabled: !legal }}
    >
      {body}
    </Pressable>
  );
}

const s = StyleSheet.create({
  halo: {
    padding: 1.5,
    borderWidth: 2,
  },
  liftedGlow: {
    shadowColor: onTable.gold,
    shadowOpacity: 0.85,
    shadowRadius: 10,
    elevation: 8,
  },
  face: {
    backgroundColor: cards.face,
    paddingHorizontal: 4,
    paddingTop: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  faceDimmed: {
    backgroundColor: "#e2ded4",
  },
  index: {
    fontFamily: fonts.cardIndex.family,
    fontWeight: "700",
    lineHeight: undefined,
  },
  pip: {
    marginTop: -4,
  },
  center: {
    position: "absolute",
    right: 4,
    bottom: 0,
    opacity: 0.9,
  },
  back: {
    backgroundColor: material.felt,
    padding: 3,
    borderWidth: 1,
    borderColor: material.goldLeafDim,
  },
  backInner: {
    flex: 1,
    borderWidth: 1,
    borderColor: material.goldLeaf,
    backgroundColor: material.feltDeep,
    opacity: 0.9,
  },
});
