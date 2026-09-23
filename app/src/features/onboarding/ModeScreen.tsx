import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { SelectableCard } from "../../components/ui/SelectableCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts, material } from "../../theme/tokens";
import { useTheme, usePrefs } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { T } from "./copy";

export function ModeScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile, update } = useProfile();
  const [prefs, setPrefs] = usePrefs();
  const choose = (easy: boolean) => {
    // Easy: four-colour deck, large cards, hints on, no timer. Standard restores those defaults.
    update({ easy, hints: easy, timer: !easy });
    setPrefs({ ...prefs, fourColor: easy, largeCards: easy });
  };
  const card = (title: string, body: string, on: boolean, easy: boolean) => (
    <SelectableCard on={on} label={`${title}. ${body}`} onPress={() => choose(easy)}>
      <View style={s.top}>
        <Text style={{ flex: 1, color: c.text, fontFamily: fonts.display.family, fontSize: 17, fontWeight: "700" }}>{title}</Text>
        {on ? <Text style={s.chosen}>{T.chosen}</Text> : null}
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
  chosen: { color: material.btnInk, backgroundColor: material.goldLeaf, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontSize: 12, fontWeight: "600", overflow: "hidden" },
});
