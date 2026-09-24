import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import type { SeatMove } from "@tashzone/engine";
import { type HandSort, sortHand } from "./insights";
import { PlayingCard } from "./PlayingCard";

interface HandCardSlotProps {
  card: string;
  index: number;
  total: number;
  step: number;
  leftStart: number;
  responsiveCardW: number;
  isPlayable: boolean;
  isDimmed: boolean;
  isArmed: boolean;
  onPress: () => void;
  onBlocked?: (card: string) => void;
  onPlay: (card: string) => void;
  hitSlopRight: number;
}

function HandCardSlot({
  card,
  index,
  total,
  step,
  leftStart,
  responsiveCardW,
  isPlayable,
  isDimmed,
  isArmed,
  onPress,
  onBlocked,
  onPlay,
  hitSlopRight,
}: HandCardSlotProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const u = index - (total - 1) / 2;
  const degPerCard = Math.min(2.8, 30 / total);
  const arcFactor = total > 7 ? 0.38 : 0.55;
  const rotDeg = isArmed ? 0 : u * degPerCard;
  const arcDrop = isArmed ? -14 : Math.min(12, u * u * arcFactor);
  const cardX = leftStart + index * step;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 4 || Math.abs(gesture.dx) > 4,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy < 0) {
            pan.setValue({ x: gesture.dx * 0.25, y: gesture.dy });
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -50 || (gesture.dy < -25 && gesture.vy < -0.4)) {
            if (isPlayable) {
              Animated.timing(pan, {
                toValue: { x: gesture.dx * 0.4, y: -100 },
                duration: 140,
                useNativeDriver: true,
              }).start(() => {
                onPlay(card);
                pan.setValue({ x: 0, y: 0 });
              });
              return;
            } else {
              onBlocked?.(card);
            }
          } else if (Math.abs(gesture.dy) < 8 && Math.abs(gesture.dx) < 8) {
            onPress();
          }

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 7,
            tension: 80,
            useNativeDriver: true,
          }).start();
        },
      }),
    [card, isPlayable, onPlay, onBlocked, onPress, pan]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        s.cardSlot,
        {
          left: cardX,
          top: 14 + arcDrop,
          zIndex: isArmed ? 100 : index + 1,
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { rotate: `${rotDeg}deg` },
          ],
        },
      ]}
    >
      <PlayingCard
        card={card}
        width={responsiveCardW}
        legal={isPlayable}
        lifted={isArmed}
        dimmed={isDimmed}
        pressableWhenBlocked={!!onBlocked}
        hitSlopRight={hitSlopRight}
        onPress={onPress}
      />
    </Animated.View>
  );
}

export function Hand({
  cards,
  legal,
  onPlay,
  onBlocked,
  cardWidth,
  layout = "fan",
  sort = "suit",
}: {
  cards: readonly string[];
  legal: readonly SeatMove[];
  onPlay: (card: string) => void;
  onBlocked?: (card: string) => void;
  cardWidth: number;
  textScale?: number;
  layout?: "fan" | "spread";
  sort?: HandSort;
}) {
  const { width } = useWindowDimensions();
  const [armed, setArmed] = useState<string | null>(null);

  const playable = new Set(legal.flatMap((m) => (m.t === "Play" ? [m.card] : [])));
  const ordered = sortHand(cards, sort);
  const N = ordered.length;
  if (N === 0) return null;

  const maxFanWidth = Math.min(width - 16, 680);
  const responsiveCardW = Math.min(
    cardWidth,
    Math.max(46, Math.floor(maxFanWidth / (N > 8 ? 6.5 : 5.2)))
  );
  const cardH = Math.round(responsiveCardW * 1.4);

  const step =
    N <= 1
      ? 0
      : layout === "spread" && N <= 6
      ? responsiveCardW + 4
      : Math.min(responsiveCardW * 0.72, (maxFanWidth - responsiveCardW) / (N - 1));

  const totalFanSpan = responsiveCardW + (N - 1) * step;
  const leftStart = Math.max(0, (maxFanWidth - totalFanSpan) / 2);

  const isTurnActive = playable.size > 0;

  return (
    <View style={s.wrap} accessibilityLabel={`Your hand, ${cards.length} cards`}>
      <View
        style={[
          s.fanContainer,
          {
            width: maxFanWidth,
            height: cardH + 24,
          },
        ]}
      >
        {ordered.map((c, i) => {
          const isPlayable = playable.has(c);
          const isDimmed = isTurnActive && !isPlayable;
          const isArmed = armed === c;
          const hitSlop = i < N - 1 ? Math.max(0, step - responsiveCardW + 6) : 10;

          return (
            <HandCardSlot
              key={`${c}#${i}`}
              card={c}
              index={i}
              total={N}
              step={step}
              leftStart={leftStart}
              responsiveCardW={responsiveCardW}
              isPlayable={isPlayable}
              isDimmed={isDimmed}
              isArmed={isArmed}
              hitSlopRight={hitSlop}
              onBlocked={onBlocked}
              onPlay={onPlay}
              onPress={() => {
                if (!isPlayable) {
                  onBlocked?.(c);
                  return;
                }
                if (isArmed) {
                  setArmed(null);
                  onPlay(c);
                } else {
                  setArmed(c);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  fanContainer: {
    position: "relative",
    alignItems: "center",
  },
  cardSlot: {
    position: "absolute",
  },
});
