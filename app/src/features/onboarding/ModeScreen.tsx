import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { SelectableCard } from "../../components/ui/SelectableCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts } from "../../theme/tokens";
import { useTheme, usePrefs } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { T } from "./copy";

export function ModeScreen() {
  const router = useRouter();
  const { c, t } = useTheme();
  const { profile, update } = useProfile();
  const [, setPrefs] = usePrefs();
  const choose = (easy: boolean) => {
    // Easy: four-colour deck, large cards, hints on, no timer. Standard restores those defaults.
    update({ easy, hints: easy, timer: !easy });
    setPrefs((prev) => ({ ...prev, fourColor: easy, largeCards: easy }));
  };
  const card = (title: string, body: string, on: boolean, easy: boolean) => (
    <SelectableCard on={on} label={`${title}. ${body}`} onPress={() => choose(easy)}>
      <View style={s.top}>
        <Text style={{ flex: 1, color: c.text, fontFamily: t.type.display, fontSize: 18, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }}>{title}</Text>
        {on ? <Text style={[s.chosen, { color: t.accent.on, backgroundColor: t.accent.color, borderRadius: t.shape.chip }]}>{T.chosen}</Text> : null}
      </View>
      <View style={{ marginTop: 6 }}><Caption>{body}</Caption></View>
    </SelectableCard>
  );
  return (
    <Screen footer={<GoldButton label={T.cont} onPress={() => router.push("/onboarding/name")} />}>
      <Header title={T.modeTitle} />
      <StepDots at={3} />
      {card(T.easyT, T.easyB, profile.easy, true)}
      {card(T.stdT, T.stdB, !profile.easy, false)}
      <Caption>{T.modeNote}</Caption>
    </Screen>
  );
}
const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  chosen: { paddingHorizontal: 9, paddingVertical: 3, fontSize: 13, fontFamily: fonts.ui.semibold, overflow: "hidden" },
});
