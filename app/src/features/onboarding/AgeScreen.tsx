import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard, surfaceStyle } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { MIN_YEAR, T, clampYear, isProtectedForBirth } from "./copy";

const ANCHOR_AGE = 25;
const STEPS = [-10, -1, 1, 10] as const;

export function AgeScreen() {
  const router = useRouter();
  const { c, t } = useTheme();
  const { profile, update } = useProfile();
  const now = new Date().getFullYear();
  const [year, setYear] = useState<number | null>(() => (profile.born !== undefined ? clampYear(profile.born) : null));
  const center = year ?? now - ANCHOR_AGE;
  const step = (d: number) => setYear((y) => clampYear((y ?? now - ANCHOR_AGE) + d));
  const next = () => router.push("/onboarding/mode");
  return (
    <Screen footer={<>
      <GoldButton label={year === null ? T.pickYear : T.bornIn(year)} disabled={year === null}
        onPress={() => { if (year === null) return; update({ born: year, protectedMode: isProtectedForBirth(year) }); next(); }} />
      <GoldButton kind="glass" label={T.skip} onPress={() => { update({ born: undefined, protectedMode: true, parent: { ...profile.parent, text: false } }); next(); }} />
    </>}>
      <Header title={T.yearTitle} />
      <StepDots at={2} />
      <Caption size={14}>{T.yearBody}</Caption>
      <View style={[s.drum, surfaceStyle(t)]} accessible accessibilityRole="adjustable" accessibilityLabel={year === null ? T.noYear : T.yearLabel(year)}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}>
        <View pointerEvents="none" style={[s.line, { top: 53, backgroundColor: year === null ? c.borderControl : t.accent.color }]} />
        <View pointerEvents="none" style={[s.line, { top: 83, backgroundColor: year === null ? c.borderControl : t.accent.color }]} />
        {[-2, -1, 0, 1, 2].map((k) => {
          const a = Math.abs(k);
          const y = center + k;
          const valid = y <= now && y >= MIN_YEAR;
          const dim = year === null ? 0.45 : 1;
          return (
            <Pressable key={k} disabled={!valid} onPress={() => setYear(y)} importantForAccessibility="no" accessibilityElementsHidden
              style={[s.r, { top: 50 + k * 26 }]}>
              <Text style={[s.year, { color: c.text, fontFamily: t.type.numerals, opacity: (1 - a * 0.3) * dim, transform: [{ scaleY: 1 - a * 0.12 }] }]}>
                {valid ? y : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {year === null ? <Caption center tone="muted">{T.pickHint}</Caption> : null}
      <View style={s.btns}>
        {STEPS.map((d) => (
          <View key={d} style={s.btn}>
            <GoldButton kind="glass" label={d > 0 ? `+${d}` : `−${-d}`} onPress={() => step(d)} />
          </View>
        ))}
      </View>
      <GlassCard style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Text style={{ color: t.accent.color, fontSize: 20 }} accessibilityElementsHidden>🛡</Text>
        <View style={{ flex: 1 }}><Caption>{T.protect}</Caption></View>
      </GlassCard>
    </Screen>
  );
}
const s = StyleSheet.create({
  drum: { height: 136, overflow: "hidden" },
  r: { position: "absolute", left: 0, right: 0, height: 34, justifyContent: "center" },
  year: { textAlign: "center", fontSize: 21, lineHeight: 28 },
  line: { position: "absolute", left: 8, right: 8, height: 1 },
  btns: { flexDirection: "row", justifyContent: "center", gap: 8 },
  btn: { flex: 1 },
});
