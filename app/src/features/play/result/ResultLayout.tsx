import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Caption } from "../../../components/ui/Caption";
import { GlassCard } from "../../../components/ui/GlassCard";
import { Header } from "../../../components/ui/Header";
import { Screen } from "../../../components/ui/Screen";
import { fonts, material } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";
import type { ResultRow } from "./model";

/** Titled ledger of rows (mockup `.ledger`): label and detail on the left, the value coloured by tone on the right. */
export function ScoreRows({ title, rows }: { title: string; rows: readonly ResultRow[] }) {
  const { c } = useTheme();
  const tone = { plus: c.success, minus: c.error, gold: material.goldLeaf, plain: c.text } as const;
  return (
    <GlassCard>
      <Text accessibilityRole="header" style={[s.panelTitle, { color: c.text }]}>{title}</Text>
      {rows.map((r) => (
        <View key={r.key} style={s.row} accessible accessibilityLabel={`${r.label}${r.detail ? `, ${r.detail}` : ""}, ${r.value}`}>
          <View style={s.grow}>
            <Text style={[s.label, { color: c.text, fontWeight: r.mine ? "700" : "400" }]} numberOfLines={1}>{r.label}</Text>
            {r.detail ? <Caption size={12}>{r.detail}</Caption> : null}
          </View>
          <Text style={[s.value, { color: tone[r.tone] }]}>{r.value}</Text>
        </View>
      ))}
    </GlassCard>
  );
}

/**
 * One frame for both result screens: optional back header, a lead (small label, headline, blurb), the ledger(s)
 * as children and the actions pinned in the footer. `hero` centres the lead and sets the headline large (game over).
 */
export function ResultLayout({ header, label, headline, blurb, hero, children, actions }: {
  header?: string; label?: string; headline: string; blurb?: string; hero?: boolean; children: React.ReactNode; actions: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <Screen footer={actions}>
      {header ? <Header title={header} /> : null}
      <View style={[s.lead, hero && s.hero]} accessible accessibilityLiveRegion="polite" accessibilityLabel={[label, headline, blurb].filter(Boolean).join(". ")}>
        {label ? <Text style={[s.eyebrow, { color: c.textMuted }]}>{label.toUpperCase()}</Text> : null}
        <Text style={[s.headline, { color: hero ? material.goldLeaf : c.text, fontSize: hero ? 44 : 22 }, hero && { textAlign: "center" }]}>{headline}</Text>
        {blurb ? <Caption center={hero} size={hero ? 14 : 13}>{blurb}</Caption> : null}
      </View>
      {children}
    </Screen>
  );
}

const s = StyleSheet.create({
  lead: { gap: 4, paddingVertical: 8 },
  hero: { alignItems: "center", paddingTop: 48, paddingBottom: 16 },
  eyebrow: { fontFamily: fonts.ui.family, fontSize: 12, letterSpacing: 1.4, fontWeight: "600" },
  headline: { fontFamily: fonts.display.family, fontWeight: "600", lineHeight: undefined },
  panelTitle: { fontFamily: fonts.ui.family, fontSize: 15, fontWeight: "700", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  grow: { flex: 1 },
  label: { fontFamily: fonts.ui.family, fontSize: 15 },
  value: { fontFamily: fonts.ui.family, fontSize: 16, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
