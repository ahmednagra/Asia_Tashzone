import React, { memo, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { cards, fonts, onTable, radius } from "../../../theme/tokens";
import { SUIT_GLYPH, cardLabel, rankLabel } from "./logic";
import { useTheme } from "../../../context/ThemeContext";
import { CardBack } from "./CardBack";
import { T } from "./copy";

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

export const PlayingCard = memo(function PlayingCard({
  card,
  width,
  legal = false,
  lifted = false,
  dimmed = false,
  onPress,
  pressableWhenBlocked,
  hitSlopRight = 0,
}: PlayingCardProps) {
  const { t, fourColor, calm } = useTheme();
  const h = Math.round(width * 1.4);
  const suits = fourColor ? cards.fourColor : cards.twoColor;

  const liftAnim = useRef(new Animated.Value(lifted ? 1 : 0)).current;

  useEffect(() => {
    const anim = calm
      ? Animated.timing(liftAnim, { toValue: lifted ? 1 : 0, duration: 120, useNativeDriver: true })
      : Animated.spring(liftAnim, { toValue: lifted ? 1 : 0, friction: t.motion === "juicy" ? 5 : 7, tension: 90, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [lifted, liftAnim, calm, t.motion]);

  const translateY = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [legal ? -4 : 0, -18],
  });

  const scale = liftAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, calm ? 1 : 1.07],
  });

  const ink = card ? suits[card[1] as keyof typeof suits] : undefined;
  const face = card ? (
    <View
      style={[
        s.face,
        { width, height: h, borderRadius: radius.card },
        dimmed && s.faceDimmed,
      ]}
    >
      <Text style={[s.index, { color: ink, fontSize: Math.max(12, width * 0.3) }]}>
        {rankLabel(card)}
      </Text>
      <Text style={[s.pip, { color: ink, fontSize: Math.max(10, width * 0.26) }]}>
        {SUIT_GLYPH[card[1]!]}
      </Text>
      <Text style={[s.center, { color: ink, fontSize: Math.max(18, width * 0.5) }]}>
        {SUIT_GLYPH[card[1]!]}
      </Text>
    </View>
  ) : (
    <View accessible accessibilityLabel={T.seatUi.faceDown}>
      <CardBack t={t} width={width} height={h} />
    </View>
  );

  const haloBorderColor = lifted
    ? t.accent.color
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
        lifted && [s.liftedGlow, { shadowColor: t.accent.color }],
        dimmed && { opacity: 0.45 },
      ]}
    >
      {face}
    </Animated.View>
  );

  if (!onPress || !card) return body;

  const pressable = legal || !!pressableWhenBlocked;
  return (
    <Pressable
      onPress={onPress}
      disabled={!pressable}
      hitSlop={{ top: 12, bottom: 12, left: 2, right: Math.max(hitSlopRight, 4) }}
      accessibilityRole="button"
      accessibilityLabel={cardLabel(card, legal)}
      accessibilityHint={legal ? (lifted ? T.seatUi.tapAgain : T.seatUi.tapToRaise) : undefined}
      accessibilityState={{ disabled: !pressable, selected: lifted }}
    >
      {body}
    </Pressable>
  );
});

const s = StyleSheet.create({
  halo: {
    padding: 1.5,
    borderWidth: 2,
  },
  liftedGlow: {
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
});
