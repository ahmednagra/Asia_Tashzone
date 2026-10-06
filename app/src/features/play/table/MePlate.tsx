import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, onTable } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";
import { scriptText } from "../../../i18n";
import { PlayerAvatar } from "./Seat";
import { T } from "./copy";

/** The player's own plate below the felt (mockup `.me-plate`): profile avatar, name, cards left, YOUR TURN, the instruction and the clock. */
export function MePlate({ name, avatar, cards, turn, instruction, clock }: {
  name: string; avatar: number; cards: number; turn: boolean; instruction: string; clock?: React.ReactNode;
}) {
  const { t, lang } = useTheme();
  return (
    <View style={s.row}>
      <PlayerAvatar name={name} size={36} turn={turn} bot={false} avatar={avatar} />
      <View style={s.text}>
        <View style={s.line}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <View style={[s.count, { borderColor: t.accent.line, backgroundColor: t.surface.bg }]} accessible accessibilityLabel={T.seatUi.inHand(cards)}><Text style={[s.countText, { color: t.accent.color }]}>{cards}</Text></View>
          {turn ? <View style={[s.tag, { borderColor: t.accent.color }]}><Text style={[s.tagText, { color: t.accent.color }, scriptText(lang)]} numberOfLines={1}>{T.seatUi.yourTurn}</Text></View> : null}
        </View>
        <Text style={[s.ask, { color: t.accent.color }]} accessibilityLiveRegion="polite" numberOfLines={2}>{instruction}</Text>
        {clock}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  text: { flex: 1, gap: 3, minWidth: 0 },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: onTable.text, fontFamily: fonts.ui.semibold, fontSize: 14, flexShrink: 1 },
  count: { minWidth: 21, height: 21, borderRadius: 11, paddingHorizontal: 5, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  countText: { fontFamily: fonts.ui.semibold, fontSize: 12, fontVariant: ["tabular-nums"] },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontFamily: fonts.ui.semibold, fontSize: 10, letterSpacing: 1 },
  ask: { fontFamily: fonts.ui.family, fontSize: 13 },
});
