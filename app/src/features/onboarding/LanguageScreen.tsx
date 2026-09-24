import React from "react";
import { StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { SelectableCard } from "../../components/ui/SelectableCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts, scaleFor } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { LANGS, T } from "./copy";

export function LanguageScreen() {
  const router = useRouter();
  const { c, t } = useTheme();
  const { profile, update } = useProfile();
  const rtl = profile.lang === "ur";
  return (
    <Screen footer={<GoldButton label={T.cont} onPress={() => router.push("/onboarding/age")} />}>
      <Header title={T.langTitle} />
      <StepDots at={1} />
      {LANGS.map((l) => {
        const on = profile.lang === l.k;
        return (
          <SelectableCard key={l.k} on={on} label={`${l.native}, ${l.en}`} onPress={() => update({ lang: l.k })}
            style={[s.row, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Text style={[{ flex: 1, color: c.text, textAlign: rtl ? "right" : "left" }, l.k === "ur" ? s.nastaliq : s.native]}>{l.native}</Text>
            <Caption>{l.en}</Caption>
            {on ? <Text style={{ color: t.accent.color, fontSize: 20 }} accessibilityLabel="Selected">★</Text> : null}
          </SelectableCard>
        );
      })}
      <Caption>{T.langNote}</Caption>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { alignItems: "center", gap: 10, minHeight: 56 },
  native: { fontFamily: fonts.ui.family, fontSize: 17 },
  nastaliq: { fontFamily: fonts.nastaliq.family, ...scaleFor("body", "nastaliq"), paddingVertical: 2 },
});
