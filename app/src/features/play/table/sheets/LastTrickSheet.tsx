import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Caption } from "../../../../components/ui/Caption";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { Sheet } from "../../../../components/ui/Sheet";
import { fonts } from "../../../../theme/tokens";
import { useTheme } from "../../../../context/ThemeContext";
import { cardLabel } from "../logic";
import { lastTrick } from "../insights";
import { PlayingCard } from "../PlayingCard";

/** The last trick (mockup `sheet==='last'`): every card with the name of whoever played it, straight from the view. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function LastTrickSheet({ visible, onClose, view, names }: { visible: boolean; onClose: () => void; view: any; names: readonly string[] }) {
  const { c } = useTheme();
  const last = visible ? lastTrick(view, names) : null;
  return (
    <Sheet visible={visible && !!last} title="The last trick" onClose={onClose} actions={<GoldButton label="Back to the game" onPress={onClose} />}>
      {last ? (
        <>
          <Caption>{last.text}</Caption>
          <View style={s.row}>
            {last.plays.map((p, i) => {
              const who = names[p.seat] ?? `Seat ${p.seat + 1}`;
              return (
                <View key={`${p.seat}-${i}`} style={s.cell} accessible accessibilityLabel={`${who}: ${cardLabel(p.card)}`}>
                  <PlayingCard card={p.card} width={52} />
                  <Text style={[s.name, { color: c.textSecondary }]} numberOfLines={1}>{who}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 14 },
  cell: { alignItems: "center", gap: 4, maxWidth: 64 },
  name: { fontFamily: fonts.ui.family, fontSize: 12 },
});
