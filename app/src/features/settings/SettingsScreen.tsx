import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Constants from "expo-constants";
import { NavRow } from "../../components/ui/NavRow";
import { Caption } from "../../components/ui/Caption";
import { SettingsGroup, SettingsScreen } from "../../components/ui/Settings";
import { surfaceStyle } from "../../components/ui/GlassCard";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { AvatarView, avatarBg } from "../onboarding/AvatarView";
import { fonts } from "../../theme/tokens";
import { AboutSheet } from "./AboutSheet";
import { T } from "./copy";

export function SettingsHome() {
  const router = useRouter();
  const { c, t: room, fourColor, calm } = useTheme();
  const { profile: p } = useProfile();
  const [aboutOpen, setAboutOpen] = useState(false);
  const t = T.settings;
  const go = (href: string) => () => router.push(href as Href);
  const onOff = (v: boolean) => (v ? t.on : t.off);
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const looks = [room.label.en, fourColor ? t.fourColor : null, calm ? t.calm : null].filter(Boolean).join(" · ");

  return (
    <SettingsScreen title={t.title} back={false}>
      <Pressable onPress={go("/me")} accessibilityRole="button" accessibilityLabel={t.profileLabel(p.name)}
        style={({ pressed }) => [s.profile, surfaceStyle(room), pressed && { opacity: 0.9 }]}>
        <View style={[s.avatar, { backgroundColor: avatarBg(p.avatar), borderColor: room.accent.color }]}>
          <AvatarView index={p.avatar} size={30} />
        </View>
        <View style={s.grow}>
          <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{p.name || t.player}</Text>
          <Text style={[s.stats, { color: c.textSecondary }]} numberOfLines={1}>{t.statsLine(p.stats.matches, p.stats.wins)}</Text>
        </View>
        <Text style={{ color: room.accent.color, fontSize: 22 }}>›</Text>
      </Pressable>

      <SettingsGroup title={t.groupLook}>
        <NavRow icon="◐" title={t.looks} caption={looks} onPress={go("/settings/appearance")} />
        <NavRow icon="▶" title={t.playing} caption={`${t.hints} ${onOff(p.hints)} · ${t.clock} ${onOff(p.timer)}`} onPress={go("/settings/play")} />
        <NavRow icon="♪" title={t.sound} caption={`${p.sound.master ? t.soundOn : t.silent} · ${t.haptics} ${onOff(p.sound.haptics)}`} onPress={go("/settings/sound")} />
      </SettingsGroup>

      <SettingsGroup title={t.groupFamily}>
        <NavRow icon="A" title={t.language} caption={t.langNames[p.lang]} onPress={go("/onboarding/language")} />
        <NavRow icon="⚿" title={t.parent} badge={p.parent.pinHash ? t.pinBadge : undefined} caption={p.parent.pinHash ? t.pinSet : t.pinNone} onPress={go("/settings/parent")} />
        <NavRow icon="▣" title={t.account} caption={t.accountHint} onPress={go("/settings/account")} />
      </SettingsGroup>

      <SettingsGroup title={t.groupHelp}>
        <NavRow icon="?" title={t.howto} caption={t.howtoHint} onPress={go("/howto")} />
        <NavRow icon="§" title={t.rules} caption={t.rulesHint} onPress={go("/rules")} />
        <NavRow icon="ℹ" title={t.about} caption={t.aboutHint} onPress={() => setAboutOpen(true)} />
      </SettingsGroup>

      <Caption center tone="muted">{t.version(version)}</Caption>
      <AboutSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 64 },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.ui.semibold, fontSize: 17 },
  stats: { fontFamily: fonts.ui.family, fontSize: 13 },
});
