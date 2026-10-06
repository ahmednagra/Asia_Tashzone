import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Share, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextStyle } from "react-native";
import { Caption } from "../../../components/ui/Caption";
import { GlassCard } from "../../../components/ui/GlassCard";
import { Header } from "../../../components/ui/Header";
import { Screen } from "../../../components/ui/Screen";
import { GoldButton } from "../../../components/ui/GoldButton";
import { fonts, radius } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";
import { useFeel } from "../../../utils/feel";
import { displayFace, scriptText } from "../../../i18n";
import type { ResultRow } from "./model";
import { R } from "./copy";

const NUM = /[−-]?\d+(?:\.\d+)?/;

function CountUp({ text, run, style }: { text: string; run: boolean; style: StyleProp<TextStyle> }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    const m = NUM.exec(text);
    if (!run || !m) { setShown(text); return; }
    const raw = m[0];
    const target = Number(raw.replace("−", "-"));
    const decimals = raw.includes(".") ? raw.split(".")[1]!.length : 0;
    const neg = raw.startsWith("−") ? "−" : "-";
    const fmt = (v: number) => `${v < 0 ? neg : ""}${Math.abs(v).toFixed(decimals)}`;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / 400);
      setShown(text.replace(raw, fmt(target * (1 - (1 - p) ** 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, run]);
  return <Text style={style}>{shown}</Text>;
}

export function ScoreRows({ title, rows }: { title: string; rows: readonly ResultRow[] }) {
  const { c, t, calm } = useTheme();
  const tone = { plus: c.success, minus: c.error, gold: t.accent.color, plain: c.text } as const;
  const count = t.motion === "juicy" && !calm;

  return (
    <GlassCard>
      <Text accessibilityRole="header" style={[s.panelTitle, { color: c.text }]}>{title}</Text>
      {rows.map((r, i) => (
        <View key={r.key} style={s.row} accessible accessibilityLabel={`${r.label}${r.detail ? `, ${r.detail}` : ""}, ${r.value}`}>
          <View style={[s.rankBadge, { backgroundColor: t.accent.line, borderColor: t.accent.dim }]}>
            <Text style={[s.rankText, { color: c.text }]}>{i + 1}</Text>
          </View>
          <View style={s.grow}>
            <Text style={[s.label, { color: c.text, fontFamily: r.mine ? fonts.ui.bold : fonts.ui.family }]} numberOfLines={1}>{r.label}</Text>
            {r.detail ? <Caption size={13}>{r.detail}</Caption> : null}
          </View>
          <CountUp text={r.value} run={count} style={[s.value, { color: tone[r.tone] }]} />
        </View>
      ))}
    </GlassCard>
  );
}

export function VictoryPodium({ rows }: { rows: readonly ResultRow[] }) {
  const { c, t, calm, lang } = useTheme();
  const { height } = useWindowDimensions();
  const compact = height < 800;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = calm
      ? Animated.timing(rise, { toValue: 1, duration: 120, useNativeDriver: true })
      : t.motion === "juicy"
      ? Animated.spring(rise, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true })
      : Animated.timing(rise, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [rise, calm, t.motion]);

  if (rows.length < 2) return null;

  const motion = calm
    ? { opacity: rise }
    : t.motion === "juicy"
    ? { transform: [{ scale: rise }] }
    : { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] };
  const steps = compact ? [64, 50, 42] : [74, 56, 46];
  const count = t.motion === "juicy" && !calm;

  const col = (row: ResultRow | undefined, place: 0 | 1 | 2) => {
    if (!row) return null;
    const first = place === 0;
    return (
      <Animated.View style={[s.podiumCol, first && s.podiumCol1, motion]} accessible accessibilityLabel={`${R.placesSpoken[place]}: ${row.label}, ${row.value}`}>
        <View style={[s.medal, { borderColor: first ? t.accent.color : c.borderControl, backgroundColor: first ? t.accent.line : "transparent" }]}>
          <Text style={[s.medalText, { color: first ? t.accent.color : c.textSecondary }]}>{place + 1}</Text>
        </View>
        <Text style={[s.podiumName, { color: first ? t.accent.color : c.text, fontFamily: first ? fonts.ui.bold : fonts.ui.family }]} numberOfLines={1}>{row.label}</Text>
        <View
          style={[
            s.podiumStep,
            { height: steps[place], borderRadius: t.shape.radius },
            first
              ? { backgroundColor: t.accent.color, borderColor: t.accent.dim, borderWidth: 1.5 }
              : { backgroundColor: t.c.surfaceRaised, borderColor: c.borderSubtle, borderWidth: 1 },
          ]}
        >
          <CountUp text={row.value} run={count} style={[s.podiumScore, { color: first ? t.accent.on : t.value.coins }]} />
          <Text style={[s.podiumRank, { color: first ? t.accent.on : c.textSecondary }, scriptText(lang)]} numberOfLines={1}>{R.places[place]}</Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[s.podiumContainer, compact && s.podiumCompact]}>
      {col(rows[1], 1)}
      {col(rows[0], 0)}
      {col(rows[2], 2)}
    </View>
  );
}

export function ResultLayout({
  header,
  label,
  headline,
  blurb,
  hero,
  won = false,
  children,
  actions,
}: {
  header?: string;
  label?: string;
  headline: string;
  blurb?: string;
  hero?: boolean;
  won?: boolean;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const { c, t, calm, lang } = useTheme();
  const feel = useFeel();
  const { height } = useWindowDimensions();
  const compact = height < 800;
  const shake = useRef(new Animated.Value(0)).current;
  const feelRef = useRef(feel);
  feelRef.current = feel;

  const celebrated = useRef(false);

  useEffect(() => {
    if (!hero || !won || celebrated.current) return;
    celebrated.current = true;
    feelRef.current("win");
    if (calm || t.motion !== "juicy") return;
    const step = (v: number) => Animated.timing(shake, { toValue: v, duration: 34, useNativeDriver: true });
    const anim = Animated.sequence([step(6), step(-6), step(0)]);
    anim.start();
    return () => anim.stop();
  }, [hero, won, calm, t.motion, shake]);

  const onShareMatch = async () => {
    try {
      await Share.share({
        message: R.share(headline, blurb ?? ""),
        title: R.shareTitle,
      });
    } catch {}
  };

  const confetti = t.motion === "juicy" ? [t.value.points, t.value.bid, t.value.coins, t.value.points, t.value.bid] : [t.accent.color, t.accent.dim, t.accent.color, t.accent.dim, t.accent.color];
  const showConfetti = hero && won && !calm && !compact;

  return (
    <Screen
      footer={
        <View style={s.footer}>
          {hero && (
            <GoldButton kind="glass" label={R.shareButton} onPress={onShareMatch} />
          )}
          {actions}
        </View>
      }
    >
      {header ? <Header title={header} /> : null}
      <Animated.View style={[s.lead, hero && (compact ? s.heroCompact : s.hero), { transform: [{ translateX: shake }] }]} accessible accessibilityLiveRegion="polite" accessibilityLabel={[label, headline, blurb].filter(Boolean).join(". ")}>
        {showConfetti && (
          <View style={s.confettiRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {["♠", "♥", "♦", "♣", "♠"].map((g, i) => (
              <Text key={i} style={[s.confetti, { color: confetti[i] }]}>{g}</Text>
            ))}
          </View>
        )}
        {label ? <Text style={[s.eyebrow, { color: c.textMuted }, scriptText(lang)]}>{lang === "en" ? label.toUpperCase() : label}</Text> : null}
        <Text style={[s.headline, { color: hero ? t.accent.color : c.text }, displayFace(t.type.display, hero ? (compact ? 30 : 36) : 22, lang), hero && { textAlign: "center" }]}>
          {headline}
        </Text>
        {blurb ? <Caption center={hero} size={hero ? 14 : 13}>{blurb}</Caption> : null}
      </Animated.View>
      {children}
    </Screen>
  );
}

const s = StyleSheet.create({
  footer: { gap: 8 },
  lead: { gap: 4, paddingVertical: 8 },
  hero: { alignItems: "center", paddingTop: 16, paddingBottom: 8 },
  heroCompact: { alignItems: "center", paddingTop: 4, paddingBottom: 4 },
  confettiRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 4 },
  confetti: { fontSize: 20 },
  eyebrow: { fontFamily: fonts.ui.semibold, fontSize: 13, letterSpacing: 1.4 },
  headline: { lineHeight: undefined },
  panelTitle: { fontFamily: fonts.ui.bold, fontSize: 15, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  rankBadge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: fonts.ui.bold, fontSize: 11 },
  grow: { flex: 1 },
  label: { fontSize: 15 },
  value: { fontFamily: fonts.ui.semibold, fontSize: 16, fontVariant: ["tabular-nums"] },
  podiumContainer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, paddingVertical: 12 },
  podiumCompact: { paddingVertical: 4 },
  podiumCol: { alignItems: "center", flex: 1, maxWidth: 96 },
  podiumCol1: { zIndex: 10 },
  medal: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  medalText: { fontFamily: fonts.ui.bold, fontSize: 12 },
  podiumName: { fontSize: 13, textAlign: "center", marginBottom: 4 },
  podiumStep: { width: "100%", alignItems: "center", justifyContent: "center", paddingVertical: 4, borderRadius: radius.control },
  podiumScore: { fontFamily: fonts.ui.bold, fontSize: 14, fontVariant: ["tabular-nums"] },
  podiumRank: { fontFamily: fonts.ui.bold, fontSize: 10, letterSpacing: 1 },
});
