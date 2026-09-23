import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, material, onTable } from "../../../theme/tokens";
import { TurnBar } from "./chrome";
import { PlayerAvatar } from "./Seat";

/** The player's own plate below the felt (mockup `.me-plate`): profile avatar, name, cards left, YOUR TURN, the instruction and the clock. */
export function MePlate({ name, avatar, cards, turn, instruction, clock }: {
  name: string; avatar: number; cards: number; turn: boolean; instruction: string; clock?: { remainingMs: number; totalMs: number } | null;
}) {
  return (
    <View style={s.row}>
      <PlayerAvatar name={name} size={36} turn={turn} bot={false} avatar={avatar} />
      <View style={s.text}>
        <View style={s.line}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <View style={s.count} accessible accessibilityLabel={`${cards} cards in hand`}><Text style={s.countText}>{cards}</Text></View>
          {turn ? <View style={s.tag}><Text style={s.tagText}>YOUR TURN</Text></View> : null}
        </View>
        <Text style={s.ask} accessibilityLiveRegion="polite" numberOfLines={2}>{instruction}</Text>
        {clock ? <TurnBar remainingMs={clock.remainingMs} totalMs={clock.totalMs} width={96} /> : null}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  text: { flex: 1, gap: 3 },
  line: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: onTable.text, fontFamily: fonts.ui.family, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  count: { minWidth: 21, height: 21, borderRadius: 11, paddingHorizontal: 5, borderWidth: 1, borderColor: material.line, backgroundColor: material.glass, alignItems: "center", justifyContent: "center" },
  countText: { color: onTable.gold, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  tag: { borderWidth: 1, borderColor: onTable.gold, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { color: onTable.gold, fontSize: 10, letterSpacing: 1 },
  ask: { color: onTable.gold, fontFamily: fonts.ui.family, fontSize: 13 },
});
