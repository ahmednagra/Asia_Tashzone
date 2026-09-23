import React, { useEffect } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { AVATARS, AvatarView } from "./AvatarView";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { NICKS, T } from "./copy";

const nick = () => NICKS[Math.floor(Math.random() * NICKS.length)]!;

export function NameScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile, update } = useProfile();
  useEffect(() => { if (!profile.name) update({ name: nick() }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = () => { update({ onboarded: true, name: profile.name.trim() || nick() }); router.replace("/"); };
  return (
    <Screen footer={<GoldButton label={T.start} onPress={finish} />}>
      <Header title={T.nameTitle} />
      <StepDots at={4} />
      <GlassCard>
        <SectionLabel>{T.nameLabel}</SectionLabel>
        <TextInput value={profile.name} onChangeText={(name) => update({ name })} maxLength={24} placeholder={T.namePh} placeholderTextColor={c.textMuted}
          accessibilityLabel="Your table name" style={[s.input, { color: c.text, borderColor: material.line }]} />
        <View style={s.row}>
          <View style={{ flex: 1 }}><GoldButton kind="glass" label={T.suggest} onPress={() => update({ name: nick() })} /></View>
          <View style={{ flex: 1 }}><GoldButton kind="glass" label={T.clear} onPress={() => update({ name: "" })} /></View>
        </View>
      </GlassCard>
      <SectionLabel>{T.pickAvatar}</SectionLabel>
      <View style={s.grid}>
        {AVATARS.map((a, i) => {
          const on = profile.avatar === i;
          return (
            <Pressable key={a.name} accessibilityRole="button" accessibilityLabel={a.name} accessibilityState={{ selected: on }} onPress={() => update({ avatar: i })}
              style={[s.av, { backgroundColor: a.bg, borderColor: on ? material.goldLeaf : "transparent" }]}>
              <AvatarView index={i} size={30} />
            </Pressable>
          );
        })}
      </View>
      <Caption>{T.nameNote}</Caption>
    </Screen>
  );
}
const s = StyleSheet.create({
  input: { marginTop: 6, minHeight: 48, borderBottomWidth: 1, textAlign: "center", fontFamily: fonts.display.family, fontSize: 20 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  av: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
