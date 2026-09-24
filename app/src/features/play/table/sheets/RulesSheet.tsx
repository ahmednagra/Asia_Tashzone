import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Caption } from "../../../../components/ui/Caption";
import { GlassCard } from "../../../../components/ui/GlassCard";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { Sheet } from "../../../../components/ui/Sheet";
import { TagPill } from "../../../../components/ui/TagPill";
import { fonts } from "../../../../theme/tokens";
import { useTheme } from "../../../../context/ThemeContext";
import { houseRules } from "../insights";
import { T } from "../copy";

/** House rules (mockup `sheet==='rules'`): the rules this match was compiled with. They are fixed for the match, so they are shown, not switched. */
export function RulesSheet({ visible, onClose, view }: { visible: boolean; onClose: () => void; view: any }) {
  const { c } = useTheme();
  const rows = houseRules(view);
  return (
    <Sheet visible={visible} title={T.sheets.houseRules} onClose={onClose} actions={<GoldButton label={T.sheets.done} onPress={onClose} />}>
      <Caption>{T.sheets.rulesFixed}</Caption>
      <View style={s.list}>
        {rows.map((r) => (
          <GlassCard key={r.title} style={s.row}>
            <View style={s.text}>
              <Text style={[s.title, { color: c.text }]}>{r.title}</Text>
              <Caption>{r.text}</Caption>
            </View>
            {r.on !== null ? <TagPill text={r.on ? T.sheets.on : T.sheets.off} gold={r.on} /> : null}
          </GlassCard>
        ))}
      </View>
    </Sheet>
  );
}
const s = StyleSheet.create({
  list: { gap: 8, marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.ui.semibold, fontSize: 15 },
});
