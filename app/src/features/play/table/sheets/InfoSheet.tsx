import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard } from "../../../../components/ui/GlassCard";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { Sheet } from "../../../../components/ui/Sheet";
import { fonts } from "../../../../theme/tokens";
import { useTheme } from "../../../../context/ThemeContext";

/** Table info: game, preset, length, players and bots, as chosen at setup. */
export function InfoSheet({ visible, onClose, title, rows }: { visible: boolean; onClose: () => void; title: string; rows: readonly (readonly [string, string])[] }) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} title={title} onClose={onClose} actions={<GoldButton label="Done" onPress={onClose} />}>
      <GlassCard>
        {rows.map(([k, v]) => (
          <View key={k} style={s.row} accessible accessibilityLabel={`${k}: ${v}`}>
            <Text style={[s.k, { color: c.textMuted }]}>{k}</Text>
            <Text style={[s.v, { color: c.text }]}>{v}</Text>
          </View>
        ))}
      </GlassCard>
    </Sheet>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 40, gap: 12 },
  k: { fontFamily: fonts.ui.family, fontSize: 14 },
  v: { fontFamily: fonts.ui.semibold, fontSize: 15, flexShrink: 1, textAlign: "right" },
});
