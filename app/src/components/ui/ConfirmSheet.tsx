import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "./GoldButton";
import { Sheet } from "./Sheet";
import { TagPill } from "./TagPill";

export interface ConfirmFact { mark: string; title: string; body: string }

/**
 * Generic confirm dialog (mockup `leaveHTML` / `concedeHTML`): title, "where you stand" pills, numbered or
 * lettered facts, a confirming action and a way back. The safe choice is the gold button; `confirmLabel` is the
 * outlined one, so a stray tap never confirms.
 */
export function ConfirmSheet({ visible, title, standing, facts, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  visible: boolean; title: string; standing?: readonly string[]; facts: readonly ConfirmFact[];
  confirmLabel: string; cancelLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} title={title} onClose={onCancel}
      actions={<><GoldButton label={cancelLabel} onPress={onCancel} /><GoldButton label={confirmLabel} kind="glass" onPress={onConfirm} /></>}>
      {standing?.length ? <View style={s.pills}>{standing.map((x) => <TagPill key={x} text={x} />)}</View> : null}
      <View style={s.facts}>
        {facts.map((f) => (
          <View key={f.title} style={s.fact} accessible accessibilityLabel={`${f.title}. ${f.body}`}>
            <View style={[s.mark, { borderColor: material.goldLeafDim }]}><Text style={[s.markText, { color: material.goldLeaf }]}>{f.mark}</Text></View>
            <View style={s.factText}>
              <Text style={[s.factTitle, { color: c.text }]}>{f.title}</Text>
              <Text style={[s.factBody, { color: c.textSecondary }]}>{f.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </Sheet>
  );
}
const s = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  facts: { gap: 10, paddingBottom: 4 },
  fact: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 1 },
  markText: { fontFamily: fonts.ui.family, fontSize: 12, fontWeight: "700" },
  factText: { flex: 1, gap: 1 },
  factTitle: { fontFamily: fonts.ui.family, fontSize: 15, fontWeight: "600" },
  factBody: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18 },
});
