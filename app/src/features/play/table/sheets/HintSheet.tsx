import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SeatMove } from "@tashzone/engine";
import { Caption } from "../../../../components/ui/Caption";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { Sheet } from "../../../../components/ui/Sheet";
import { fonts } from "../../../../theme/tokens";
import { useTheme } from "../../../../context/ThemeContext";
import { hintText } from "../insights";
import { PlayingCard } from "../PlayingCard";

/** A suggestion (mockup `sheet==='hint'`): the move the engine's Medium bot would make from the viewer's own view, with a plain reason. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HintSheet({ visible, onClose, view, move }: { visible: boolean; onClose: () => void; view: any; move: SeatMove | null }) {
  const { c } = useTheme();
  const h = hintText(view, move);
  return (
    <Sheet visible={visible} title="A suggestion" onClose={onClose} actions={<GoldButton label="Back to the game" onPress={onClose} />}>
      <View style={s.row} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${h.title}. ${h.reason}`}>
        {h.card ? <PlayingCard card={h.card} width={72} /> : null}
        <View style={s.text}>
          <Text style={[s.title, { color: c.text }]}>{h.title}</Text>
          <Caption>{h.reason}</Caption>
        </View>
      </View>
      <Caption>Hints read the same table you can see. They never look at anybody's hand.</Caption>
    </Sheet>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  text: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.display.family, fontSize: 20, fontWeight: "600" },
});
