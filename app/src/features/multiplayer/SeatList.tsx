import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SeatRow } from "../../components/ui/SeatRow";
import { fonts, minTouchTarget } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { copy } from "./copy";

export interface SeatEntry { name: string | null; status: string; ok?: boolean; onRemove?: () => void; removeLabel?: string }

/** Lobby seats in order; an entry with no name is an open seat. Shared by the room lobby and the Wi-Fi host screen. */
export function SeatList({ seats, openName }: { seats: readonly SeatEntry[]; openName: string }) {
  return <>{seats.map((s, i) => <SeatRow key={i} name={s.name ?? openName} status={s.status} filled={s.name !== null} ok={s.ok} />)}</>;
}

export function SeatChips({ seats, openName }: { seats: readonly SeatEntry[]; openName: string }) {
  const { c, t } = useTheme();
  return (
    <View style={s.wrap}>
      {seats.map((seat, i) => {
        const filled = seat.name !== null;
        const name = seat.name ?? openName;
        return (
          <View key={i} style={[s.chip, { borderRadius: t.shape.chip, borderColor: filled ? t.accent.line : c.borderControl, borderStyle: filled ? "solid" : "dashed", backgroundColor: filled ? c.surfaceRaised : "transparent" }]}>
            <View style={s.text} accessible accessibilityLabel={copy.seat(name, seat.status)}>
              <Text numberOfLines={1} style={[s.name, { color: filled ? c.text : c.textMuted }]}>{name}</Text>
              <Text numberOfLines={1} style={[s.status, { color: seat.ok ? c.success : c.textMuted }]}>{seat.status}</Text>
            </View>
            {seat.onRemove ? (
              <Pressable accessibilityRole="button" accessibilityLabel={seat.removeLabel ?? name} onPress={seat.onRemove} hitSlop={4}
                style={({ pressed }) => [s.remove, { borderRadius: t.shape.chip, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={[s.removeText, { color: c.textSecondary }]}>×</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", minHeight: minTouchTarget, borderWidth: 1, paddingLeft: 12, flexBasis: "47%", flexGrow: 1 },
  text: { flex: 1, paddingVertical: 4, paddingRight: 8 },
  name: { fontFamily: fonts.ui.semibold, fontSize: 14 },
  status: { fontFamily: fonts.ui.family, fontSize: 12 },
  remove: { width: minTouchTarget, height: minTouchTarget, alignItems: "center", justifyContent: "center" },
  removeText: { fontFamily: fonts.ui.medium, fontSize: 22 },
});
