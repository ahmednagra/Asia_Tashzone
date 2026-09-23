import React from "react";
import { useRouter, type Href } from "expo-router";
import Constants from "expo-constants";
import { NavRow } from "../../components/ui/NavRow";
import { Caption } from "../../components/ui/Caption";
import { SettingsScreen } from "../../components/ui/Settings";
import { usePrefs } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { avatarName } from "../onboarding/AvatarView";
import { T } from "./copy";

/** Settings tab (mockup `settings`): every row leads to a sub-screen; values shown come from the saved profile and prefs. */
export function SettingsHome() {
  const router = useRouter();
  const { profile: p } = useProfile();
  const [prefs] = usePrefs();
  const t = T.settings;
  const go = (href: string) => () => router.push(href as Href);
  const onOff = (v: boolean) => (v ? t.on : t.off);
  const theme = prefs.system !== false ? t.themes.system : prefs.name === "light" ? t.themes.light : t.themes.dark;
  const version = Constants.expoConfig?.version ?? "dev";

  return (
    <SettingsScreen title={t.title} back={false}>
      <NavRow icon="◐" title={t.looks} caption={theme} onPress={go("/settings/appearance")} />
      <NavRow icon="▶" title={t.playing} caption={`${t.hints} ${onOff(p.hints)} · ${t.clock} ${onOff(p.timer)}`} onPress={go("/settings/play")} />
      <NavRow icon="♪" title={t.sound} caption={`${p.sound.master ? t.soundOn : t.silent} · ${t.haptics} ${onOff(p.sound.haptics)}`} onPress={go("/settings/sound")} />
      <NavRow icon="A" title={t.language} caption={t.langNames[p.lang]} onPress={go("/onboarding/language")} />
      <NavRow icon="⚿" title={t.parent} caption={p.parent.pinHash ? t.pinSet : t.pinNone} onPress={go("/settings/parent")} />
      <NavRow icon="?" title={t.howto} caption={t.howtoHint} onPress={go("/howto")} />
      <NavRow icon="§" title={t.rules} caption={t.rulesHint} onPress={go("/rules")} />
      <NavRow icon="☺" title={t.nameAvatar} caption={`${p.name || "Player"} · ${avatarName(p.avatar)}`} onPress={go("/me")} />
      <NavRow icon="▣" title={t.account} caption={t.accountHint} onPress={go("/settings/account")} />
      <Caption center tone="muted">{t.version(version)}</Caption>
    </SettingsScreen>
  );
}
