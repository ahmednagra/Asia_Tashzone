import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { MIN_YEAR, T, clampYear, isProtectedForBirth } from "./copy";

export function AgeScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile, update } = useProfile();
  const now = new Date().getFullYear();
  const [year, setYear] = useState(() => clampYear(profile.born ?? now - 25));
  const step = (d: number) => setYear((y) => clampYear(y + d));
  const next = () => router.push("/onboarding/mode");
  return (
    <Screen footer={<>
      <GoldButton label={T.bornIn(year)} onPress={() => { update({ born: year, protectedMode: isProtectedForBirth(year) }); next(); }} />
      <GoldButton kind="glass" label={T.skip} onPress={() => { update({ born: undefined, protectedMode: true, parent: { ...profile.parent, text: false } }); next(); }} />
    </>}>
      <Header title={T.yearTitle} />
      <StepDots at={2} />
      <Caption size={14}>{T.yearBody}</Caption>
      <View style={s.drum} accessible accessibilityRole="adjustable" accessibilityLabel={`Birth year ${year}`}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}>
        <View pointerEvents="none" style={[s.line, { top: 53 }]} />
        <View pointerEvents="none" style={[s.line, { top: 83 }]} />
        {[-2, -1, 0, 1, 2].map((k) => {
          const a = Math.abs(k);
          const y = year + k;
          return (
            <Text key={k} style={[s.r, { top: 54 + k * 26, color: c.text, opacity: 1 - a * 0.3, transform: [{ scaleY: 1 - a * 0.12 }] }]}>
              {y <= now && y >= MIN_YEAR ? y : ""}
            </Text>
          );
        })}
      </View>
      <View style={s.btns}>
        <View style={{ minWidth: 120 }}><GoldButton kind="glass" label={T.earlier} onPress={() => step(-1)} /></View>
        <View style={{ minWidth: 120 }}><GoldButton kind="glass" label={T.later} onPress={() => step(1)} /></View>
      </View>
      <GlassCard style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Text style={{ color: material.goldLeaf, fontSize: 20 }} accessibilityElementsHidden>🛡</Text>
        <View style={{ flex: 1 }}><Caption>{T.protect}</Caption></View>
      </GlassCard>
    </Screen>
  );
}
const s = StyleSheet.create({
  drum: { height: 136, borderRadius: 16, borderWidth: 1, borderColor: material.line, backgroundColor: material.glass, overflow: "hidden" },
  r: { position: "absolute", left: 0, right: 0, height: 28, textAlign: "center", fontFamily: fonts.display.family, fontWeight: "600", fontSize: 21, lineHeight: 28 },
  line: { position: "absolute", left: 8, right: 8, height: 1, backgroundColor: material.goldLeaf },
  btns: { flexDirection: "row", justifyContent: "center", gap: 14 },
});
