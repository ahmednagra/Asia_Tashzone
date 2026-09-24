import React from "react";
import { StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { SelectableCard } from "../../components/ui/SelectableCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts, scaleFor } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { T as S } from "../settings/copy";
import { LANGS, T } from "./copy";

export function LanguageScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSettings = from === "settings";
  const { c, t } = useTheme();
  const { profile, update } = useProfile();
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/settings"));
  const choose = (k: (typeof LANGS)[number]["k"]) => {
    update({ lang: k });
    if (fromSettings) leave();
  };
  return (
    <Screen footer={fromSettings ? undefined : <GoldButton label={T.cont} onPress={() => router.push("/onboarding/age")} />}>
      <Header title={T.langTitle} />
      {fromSettings ? null : <StepDots at={1} />}
      {LANGS.map((l) => {
        const on = profile.lang === l.k;
        const name = S.settings.langNames[l.k];
        return (
          <SelectableCard key={l.k} on={on} label={name === l.native ? l.native : `${l.native}, ${name}`} onPress={() => choose(l.k)} style={s.row}>
            <Text style={[s.grow, { color: c.text }, l.k === "ur" ? s.nastaliq : s.native]}>{l.native}</Text>
            {name === l.native ? null : <Caption>{name}</Caption>}
            {on ? <Text style={{ color: t.accent.color, fontSize: 20 }} accessibilityLabel={T.selected}>★</Text> : null}
          </SelectableCard>
        );
      })}
      <Caption>{T.langNote}</Caption>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56 },
  grow: { flex: 1 },
  native: { fontFamily: fonts.ui.family, fontSize: 17, lineHeight: 26 },
  nastaliq: { fontFamily: fonts.nastaliq.family, ...scaleFor("body", "nastaliq"), paddingVertical: 2, writingDirection: "rtl" },
});
