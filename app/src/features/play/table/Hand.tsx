import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import type { SeatMove } from "@tashzone/engine";
import { useTheme } from "../../../context/ThemeContext";
import { useFeel } from "../../../utils/feel";
import { type HandSort, sortHand } from "./insights";
import { type HandSpot, handGeometry } from "./logic";
import { PlayingCard } from "./PlayingCard";

interface HandCardSlotProps {
  id: string;
  card: string;
  spot: HandSpot;
  cardW: number;
  isPlayable: boolean;
  isDimmed: boolean;
  isArmed: boolean;
  blockable: boolean;
  onTap: (id: string) => void;
  onSwipe: (id: string) => boolean;
}

const HandCardSlot = memo(function HandCardSlot({ id, card, spot, cardW, isPlayable, isDimmed, isArmed, blockable, onTap, onSwipe }: HandCardSlotProps) {
  const { calm } = useTheme();
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const live = useRef({ id, isPlayable, calm, onTap, onSwipe });
  live.current = { id, isPlayable, calm, onTap, onSwipe };
  const busy = useRef(false);

  const press = useCallback(() => {
    if (!busy.current) live.current.onTap(live.current.id);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 || Math.abs(g.dx) > 4,
        onPanResponderMove: (_, g) => {
          if (!busy.current && g.dy < 0) pan.setValue({ x: g.dx * 0.25, y: g.dy });
        },
        onPanResponderRelease: (_, g) => {
          if (busy.current) return;
          const now = live.current;
          if (g.dy < -50 || (g.dy < -25 && g.vy < -0.4)) {
            if (now.isPlayable) {
              busy.current = true;
              const finish = () => {
                pan.setValue({ x: 0, y: 0 });
                if (!now.onSwipe(now.id)) busy.current = false;
                else setTimeout(() => { busy.current = false; }, 1500);
              };
              if (now.calm) { finish(); return; }
              Animated.timing(pan, { toValue: { x: g.dx * 0.4, y: -100 }, duration: 140, useNativeDriver: true }).start(finish);
              return;
            }
            now.onTap(now.id);
          } else if (Math.abs(g.dy) < 8 && Math.abs(g.dx) < 8) {
            now.onTap(now.id);
          }
          if (now.calm) { pan.setValue({ x: 0, y: 0 }); return; }
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 7, tension: 80, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => pan.setValue({ x: 0, y: 0 }),
      }),
    [pan]
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        s.cardSlot,
        {
          left: spot.x,
          top: isArmed ? spot.y - 14 : spot.y + spot.drop,
          zIndex: isArmed ? 1000 : spot.z,
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate: `${isArmed ? 0 : spot.rot}deg` }],
        },
      ]}
    >
      <PlayingCard
        card={card}
        width={cardW}
        legal={isPlayable}
        lifted={isArmed}
        dimmed={isDimmed}
        pressableWhenBlocked={blockable}
        hitSlopRight={spot.slopRight}
        onPress={press}
      />
    </Animated.View>
  );
});

function occurrenceIds(cards: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return cards.map((c) => {
    const n = seen.get(c) ?? 0;
    seen.set(c, n + 1);
    return `${c}#${n}`;
  });
}
const cardOf = (id: string) => id.slice(0, id.indexOf("#"));

export const Hand = memo(function Hand({
  cards,
  legal,
  onPlay,
  onBlocked,
  cardWidth,
  maxWidth,
  textScale = 1,
  layout = "fan",
  sort = "suit",
}: {
  cards: readonly string[];
  legal: readonly SeatMove[];
  onPlay: (card: string) => void;
  onBlocked?: (card: string) => void;
  cardWidth: number;
  maxWidth: number;
  textScale?: number;
  layout?: "fan" | "spread";
  sort?: HandSort;
}) {
  const feel = useFeel();
  const [armed, setArmed] = useState<string | null>(null);

  const playable = useMemo(() => new Set(legal.flatMap((m) => (m.t === "Play" ? [m.card] : []))), [legal]);
  const ordered = useMemo(() => sortHand(cards, sort), [cards, sort]);
  const ids = useMemo(() => occurrenceIds(ordered), [ordered]);
  const geo = useMemo(() => handGeometry(ordered.length, maxWidth, cardWidth, layout, textScale), [ordered.length, maxWidth, cardWidth, layout, textScale]);

  const handKey = cards.join(",");
  const legalKey = [...playable].sort().join(",");
  const lock = useRef<string | null>(null);
  useEffect(() => {
    setArmed(null);
    lock.current = null;
  }, [handKey, legalKey]);

  const live = useRef({ armed, playable, onPlay, onBlocked, feel, key: `${handKey}|${legalKey}` });
  live.current = { armed, playable, onPlay, onBlocked, feel, key: `${handKey}|${legalKey}` };

  const play = useCallback((id: string): boolean => {
    const now = live.current;
    const card = cardOf(id);
    if (!now.playable.has(card) || lock.current === now.key) return false;
    const key = now.key;
    lock.current = key;
    setTimeout(() => { if (lock.current === key) lock.current = null; }, 1500);
    setArmed(null);
    now.onPlay(card);
    return true;
  }, []);

  const onTap = useCallback((id: string) => {
    const now = live.current;
    const card = cardOf(id);
    if (!now.playable.has(card)) {
      now.onBlocked?.(card);
      return;
    }
    if (now.armed === id) {
      play(id);
      return;
    }
    setArmed(id);
    now.feel("lift");
  }, [play]);

  const onSwipe = useCallback((id: string) => play(id), [play]);

  if (ordered.length === 0) return null;
  const isTurnActive = playable.size > 0;

  return (
    <View style={s.wrap} accessibilityLabel={`Your hand, ${cards.length} cards`}>
      <View style={[s.fanContainer, { width: maxWidth, height: geo.height }]}>
        {ordered.map((c, i) => {
          const isPlayable = playable.has(c);
          return (
            <HandCardSlot
              key={ids[i]}
              id={ids[i]!}
              card={c}
              spot={geo.spots[i]!}
              cardW={geo.cardW}
              isPlayable={isPlayable}
              isDimmed={isTurnActive && !isPlayable}
              isArmed={armed === ids[i]}
              blockable={!!onBlocked}
              onTap={onTap}
              onSwipe={onSwipe}
            />
          );
        })}
      </View>
    </View>
  );
});

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
