import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { PlayingCard } from "../../features/play/table/PlayingCard";
import { cardLabel } from "../../features/play/table/logic";

/** Small illustrative row of face-up cards ("AS", "TH"...) with a caption; `winner` gets the gold halo. Read as one sentence by screen readers. */
export function CardRow({ cards, caption, winner, width = 40 }: { cards: string[]; caption?: string; winner?: number; width?: number }) {
  const { c } = useTheme();
  const spoken = `${caption ? caption + ". " : ""}${cards.map((x, i) => cardLabel(x) + (i === winner ? ", the winner" : "")).join(", ")}`;
  return (
    <View accessible accessibilityLabel={spoken} style={s.wrap}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.row}>
        {cards.map((x, i) => <PlayingCard key={`${x}${i}`} card={x} width={width} legal={i === winner} />)}
      </View>
      {caption ? <Text style={[s.cap, { color: c.textSecondary }]}>{caption}</Text> : null}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingTop: 8 },
  cap: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18 },
});
