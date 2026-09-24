import React, { memo, useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { PlayingCard } from "./PlayingCard";

export const TrickCard = memo(function TrickCard({ card, width, left, top, fromX, fromY }: { card: string; width: number; left: number; top: number; fromX: number; fromY: number }) {
  const { t, calm } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const juicy = t.motion === "juicy" && !calm;
    const land = Animated.timing(a, { toValue: 1, duration: calm ? 120 : juicy ? 180 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const anim = juicy
      ? Animated.sequence([
          land,
          Animated.timing(pop, { toValue: 1.04, duration: 70, useNativeDriver: true }),
          Animated.timing(pop, { toValue: 1, duration: 90, useNativeDriver: true }),
        ])
      : land;
    anim.start();
    return () => anim.stop();
  }, [a, pop, calm, t.motion]);

  const motion = calm
    ? { opacity: a }
    : {
        opacity: a.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) },
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) },
          { scale: pop },
        ],
      };

  return (
    <Animated.View style={[{ position: "absolute", left, top }, motion]}>
      <PlayingCard card={card} width={width} />
    </Animated.View>
  );
});
