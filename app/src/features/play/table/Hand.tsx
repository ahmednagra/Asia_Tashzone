import React, { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import type { SeatMove } from "@tashzone/engine";
import { fanLayout, handOrder } from "./logic";
import { PlayingCard } from "./PlayingCard";

export function Hand({ cards, legal, onPlay, cardWidth, textScale = 1 }: {
  cards: readonly string[]; legal: readonly SeatMove[]; onPlay: (card: string) => void; cardWidth: number; textScale?: number;
}) {
  const { width } = useWindowDimensions();
  const [armed, setArmed] = useState<string | null>(null); // two-step: tap lifts, second tap plays (one-tap option later)
  const playable = new Set(legal.flatMap((m) => (m.t === "Play" ? [m.card] : [])));
  const ordered = handOrder(cards);
  const L = fanLayout(ordered.length, Math.min(width - 24, 720), cardWidth, textScale);
  const rows: string[][] = [];
  for (let i = 0; i < ordered.length; i += L.perRow) rows.push(ordered.slice(i, i + L.perRow));
  return (
    <View style={s.wrap} accessibilityLabel={`Your hand, ${cards.length} cards`}>
      {rows.map((row, r) => (
        <View key={r} style={[s.row, { height: cardWidth * 1.4 + 16, width: cardWidth + L.step * (row.length - 1) }]}>
          {row.map((c, i) => (
            <View key={c} style={{ position: "absolute", left: i * L.step, top: 12 }}>
              <PlayingCard
                card={c}
                width={cardWidth}
                legal={playable.has(c)}
                lifted={armed === c}
                hitSlopRight={i < row.length - 1 ? 0 : 8}
                onPress={() => { if (armed === c) { setArmed(null); onPlay(c); } else setArmed(c); }}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({ wrap: { alignItems: "center", gap: 4 }, row: { position: "relative" } });
