import React, { useEffect } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { AVATARS, AvatarView, avatarName } from "./AvatarView";
import { Caption } from "../../components/ui/Caption";
import { StepDots } from "../../components/ui/StepDots";
import { T, nick } from "./copy";
import { displayFace } from "../../i18n";

export function NameScreen() {
  const router = useRouter();
  const { c, t, lang } = useTheme();
  const { profile, update } = useProfile();
  useEffect(() => { if (!profile.name) update({ name: nick() }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const finish = () => { update({ onboarded: true, name: profile.name.trim() || nick() }); router.replace(profile.tutorialDone ? "/" : "/tutorial"); };
  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <Screen footer={<GoldButton label={T.start} disabled={!profile.name.trim()} onPress={finish} />}>
      <Header title={T.nameTitle} />
      <StepDots at={4} />
      <GlassCard>
        <SectionLabel>{T.nameLabel}</SectionLabel>
        <TextInput value={profile.name} onChangeText={(name) => update({ name })} maxLength={24} placeholder={T.namePh} placeholderTextColor={c.textMuted}
          accessibilityLabel={T.nameTitle} style={[s.input, { color: c.text, borderColor: c.borderControl }, displayFace(t.type.display, 20, lang)]} />
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
            <Pressable key={a.name} accessibilityRole="button" accessibilityLabel={avatarName(i)} accessibilityState={{ selected: on }} onPress={() => update({ avatar: i })}
              style={[s.av, { backgroundColor: a.bg, borderColor: on ? t.accent.color : "transparent" }]}>
              <AvatarView index={i} size={30} />
            </Pressable>
          );
        })}
      </View>
      <Caption>{T.nameNote}</Caption>
    </Screen>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  fill: { flex: 1 },
  input: { marginTop: 6, minHeight: 48, borderBottomWidth: 1, textAlign: "center" },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  av: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
