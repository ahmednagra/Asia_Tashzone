import React, { useEffect, useRef } from "react";
import { Animated, Share, StyleSheet, Text, View } from "react-native";
import { Caption } from "../../../components/ui/Caption";
import { GlassCard } from "../../../components/ui/GlassCard";
import { Header } from "../../../components/ui/Header";
import { Screen } from "../../../components/ui/Screen";
import { GoldButton } from "../../../components/ui/GoldButton";
import { fonts, material, onTable, radius } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";
import { triggerSound } from "../../../utils/sound";
import type { ResultRow } from "./model";

export function ScoreRows({ title, rows }: { title: string; rows: readonly ResultRow[] }) {
  const { c } = useTheme();
  const tone = { plus: c.success, minus: c.error, gold: material.goldLeaf, plain: c.text } as const;

  return (
    <GlassCard>
      <Text accessibilityRole="header" style={[s.panelTitle, { color: c.text }]}>{title}</Text>
      {rows.map((r, i) => (
        <View key={r.key} style={s.row} accessible accessibilityLabel={`${r.label}${r.detail ? `, ${r.detail}` : ""}, ${r.value}`}>
          <View style={s.rankBadge}>
            <Text style={s.rankText}>{i + 1}</Text>
          </View>
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

export function VictoryPodium({ rows }: { rows: readonly ResultRow[] }) {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(bounceAnim, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [bounceAnim]);

  if (rows.length < 2) return null;

  const first = rows[0];
  const second = rows[1];
  const third = rows[2];

  return (
    <View style={s.podiumContainer}>
      {second && (
        <Animated.View style={[s.podiumCol, s.podiumCol2, { transform: [{ scale: bounceAnim }] }]}>
          <View style={s.podiumCrown}><Text style={{ fontSize: 18 }}>🥈</Text></View>
          <Text style={s.podiumName} numberOfLines={1}>{second.label}</Text>
          <View style={[s.podiumStep, s.podiumStep2]}>
            <Text style={s.podiumScore}>{second.value}</Text>
            <Text style={s.podiumRank}>2ND</Text>
          </View>
        </Animated.View>
      )}

      {first && (
        <Animated.View style={[s.podiumCol, s.podiumCol1, { transform: [{ scale: bounceAnim }] }]}>
          <View style={s.podiumCrown}><Text style={{ fontSize: 24 }}>👑</Text></View>
          <Text style={[s.podiumName, { color: onTable.gold, fontWeight: "700" }]} numberOfLines={1}>{first.label}</Text>
          <View style={[s.podiumStep, s.podiumStep1]}>
            <Text style={[s.podiumScore, { color: material.btnInk }]}>{first.value}</Text>
            <Text style={[s.podiumRank, { color: material.btnInk }]}>1ST</Text>
          </View>
        </Animated.View>
      )}

      {third && (
        <Animated.View style={[s.podiumCol, s.podiumCol3, { transform: [{ scale: bounceAnim }] }]}>
          <View style={s.podiumCrown}><Text style={{ fontSize: 18 }}>🥉</Text></View>
          <Text style={s.podiumName} numberOfLines={1}>{third.label}</Text>
          <View style={[s.podiumStep, s.podiumStep3]}>
            <Text style={s.podiumScore}>{third.value}</Text>
            <Text style={s.podiumRank}>3RD</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

export function ResultLayout({
  header,
  label,
  headline,
  blurb,
  hero,
  children,
  actions,
}: {
  header?: string;
  label?: string;
  headline: string;
  blurb?: string;
  hero?: boolean;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const { c } = useTheme();

  useEffect(() => {
    if (hero) {
      triggerSound("victory", true, true, "firm");
    }
  }, [hero]);

  const onShareMatch = async () => {
    try {
      await Share.share({
        message: `TashZone Match Complete: ${headline}! ${blurb ?? ""}`,
        title: "TashZone Match Result",
      });
    } catch {}
  };

  return (
    <Screen
      footer={
        <View style={{ gap: 8 }}>
          {hero && (
            <GoldButton kind="glass" label="Share Result 🏆" onPress={onShareMatch} />
          )}
          {actions}
        </View>
      }
    >
      {header ? <Header title={header} /> : null}
      <View style={[s.lead, hero && s.hero]} accessible accessibilityLiveRegion="polite" accessibilityLabel={[label, headline, blurb].filter(Boolean).join(". ")}>
        {hero && (
          <View style={s.confettiRow}>
            <Text style={{ fontSize: 24 }}>✨</Text>
            <Text style={{ fontSize: 20 }}>♠</Text>
            <Text style={{ fontSize: 24 }}>👑</Text>
            <Text style={{ fontSize: 20 }}>♥</Text>
            <Text style={{ fontSize: 24 }}>✨</Text>
          </View>
        )}
        {label ? <Text style={[s.eyebrow, { color: c.textMuted }]}>{label.toUpperCase()}</Text> : null}
        <Text style={[s.headline, { color: hero ? material.goldLeafHot : c.text, fontSize: hero ? 36 : 22 }, hero && { textAlign: "center" }]}>
          {headline}
        </Text>
        {blurb ? <Caption center={hero} size={hero ? 14 : 13}>{blurb}</Caption> : null}
      </View>
      {children}
    </Screen>
  );
}

const s = StyleSheet.create({
  lead: { gap: 4, paddingVertical: 8 },
  hero: { alignItems: "center", paddingTop: 28, paddingBottom: 12 },
  confettiRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  eyebrow: { fontFamily: fonts.ui.semibold, fontSize: 12, letterSpacing: 1.4 },
  headline: { fontFamily: fonts.display.family, lineHeight: undefined },
  panelTitle: { fontFamily: fonts.ui.bold, fontSize: 15, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  rankBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(227, 189, 110, 0.15)", borderWidth: 1, borderColor: material.line, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 11, fontWeight: "700", color: onTable.gold },
  grow: { flex: 1 },
  label: { fontFamily: fonts.ui.family, fontSize: 15 },
  value: { fontFamily: fonts.ui.semibold, fontSize: 16, fontVariant: ["tabular-nums"] },
  podiumContainer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, paddingVertical: 14 },
  podiumCol: { alignItems: "center", flex: 1, maxWidth: 96 },
  podiumCol1: { zIndex: 10 },
  podiumCol2: { zIndex: 5 },
  podiumCol3: { zIndex: 5 },
  podiumCrown: { height: 28, alignItems: "center", justifyContent: "center" },
  podiumName: { fontSize: 12, color: onTable.text, textAlign: "center", marginBottom: 4 },
  podiumStep: { width: "100%", borderRadius: radius.control, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  podiumStep1: { height: 74, backgroundColor: onTable.gold, borderWidth: 1.5, borderColor: material.goldLeafHot },
  podiumStep2: { height: 56, backgroundColor: "rgba(180, 195, 190, 0.35)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.3)" },
  podiumStep3: { height: 44, backgroundColor: "rgba(175, 120, 80, 0.35)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.2)" },
  podiumScore: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  podiumRank: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1 },
});
