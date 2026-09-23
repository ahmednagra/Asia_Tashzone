import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Caption } from "../../../../components/ui/Caption";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { Sheet } from "../../../../components/ui/Sheet";
import { cards, fonts, material } from "../../../../theme/tokens";
import { useTheme } from "../../../../context/ThemeContext";
import { SUIT_GLYPH, cardLabel, rankLabel } from "../logic";
import { SUITS_ORDER, trackerRow } from "../insights";

/** What has gone (mockup `sheet==='tracker'`): struck-through cards were played this hand, gold ones are in your hand. Read from the view. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TrackerSheet({ visible, onClose, view }: { visible: boolean; onClose: () => void; view: any }) {
  const { c, fourColor } = useTheme();
  const suits = fourColor ? cards.fourColor : cards.twoColor;
  return (
    <Sheet visible={visible} title="What has gone" onClose={onClose} actions={<GoldButton label="Close" onPress={onClose} />}>
      <Caption>Struck-through cards have been played this hand. Gold ones are in your hand. Anything that goes back into a hand is un-struck.</Caption>
      {visible && SUITS_ORDER.map((suit) => (
        <View key={suit} style={s.suitRow}>
          <Text style={[s.glyph, { color: suit === "H" || suit === "D" ? suits[suit] : c.text }]} accessibilityElementsHidden>{SUIT_GLYPH[suit]}</Text>
          <View style={s.ranks}>
            {trackerRow(view, suit).map(({ card, status }) => (
              <View key={card} accessible accessibilityLabel={`${cardLabel(card)}, ${status === "gone" ? "played" : status === "mine" ? "in your hand" : "still out"}`}
                style={[s.box, { borderColor: status === "mine" ? material.goldLeaf : c.borderSubtle, opacity: status === "gone" ? 0.3 : 1 }]}>
                <Text style={[s.rank, { color: status === "mine" ? material.goldLeaf : c.text }, status === "gone" && s.struck]}>{rankLabel(card)}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Sheet>
  );
}
const s = StyleSheet.create({
  suitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  glyph: { width: 20, fontSize: 18 },
  ranks: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 },
  box: { width: 24, height: 30, borderRadius: 5, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rank: { fontFamily: fonts.cardIndex.family, fontSize: 12, fontWeight: "700" },
  struck: { textDecorationLine: "line-through" },
});
