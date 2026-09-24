import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SeatMove } from "@tashzone/engine";
import { Caption } from "../../../../components/ui/Caption";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { Sheet } from "../../../../components/ui/Sheet";
import { fonts } from "../../../../theme/tokens";
import { useTheme } from "../../../../context/ThemeContext";
import { displayFace } from "../../../../i18n";
import { hintText } from "../insights";
import { T } from "../copy";
import { PlayingCard } from "../PlayingCard";

/** A suggestion (mockup `sheet==='hint'`): the move the engine's Medium bot would make from the viewer's own view, with a plain reason. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HintSheet({ visible, onClose, view, move }: { visible: boolean; onClose: () => void; view: any; move: SeatMove | null }) {
  const { c, lang } = useTheme();
  const h = hintText(view, move);
  return (
    <Sheet visible={visible} title={T.sheets.suggestion} onClose={onClose} actions={<GoldButton label={T.sheets.backToGame} onPress={onClose} />}>
      <View style={s.row} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${h.title}. ${h.reason}`}>
        {h.card ? <PlayingCard card={h.card} width={72} /> : null}
        <View style={s.text}>
          <Text style={[s.title, displayFace(fonts.display.family, 20, lang), { color: c.text }]}>{h.title}</Text>
          <Caption>{h.reason}</Caption>
        </View>
      </View>
      <Caption>{T.sheets.hintNote}</Caption>
    </Sheet>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  text: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.display.family, fontSize: 20 },
});
