import React from "react";
import { useRouter } from "expo-router";
import { Caption } from "../../components/ui/Caption";
import { ChipGroup } from "../../components/ui/ChipGroup";
import { NavRow } from "../../components/ui/NavRow";
import { SettingsGroup, SettingsScreen } from "../../components/ui/Settings";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { type ThemePrefs, usePrefs } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { T } from "./copy";

type ThemeChoice = "system" | "light" | "dark";
const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: T.settings.themes.system }, { value: "light", label: T.settings.themes.light }, { value: "dark", label: T.settings.themes.dark },
];

/** Settings > How it looks: theme, deck and motion options, all applied live through ThemeContext. */
export function AppearanceScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = usePrefs();
  const t = T.looks;
  const choice: ThemeChoice = prefs.system !== false ? "system" : prefs.name;
  const patch = (p: Partial<ThemePrefs>) => setPrefs({ ...prefs, ...p });
  return (
    <SettingsScreen title={t.title}>
      <SettingsGroup title={t.theme}>
        <ChipGroup label={t.theme} hint={t.themeHint} options={THEME_OPTIONS} value={choice}
          onChange={(v) => patch(v === "system" ? { system: true } : { system: false, name: v })} />
      </SettingsGroup>
      <SettingsGroup title={t.cards}>
        <ToggleRow label={t.four} hint={t.fourHint} value={prefs.fourColor} onChange={(v) => patch({ fourColor: v })} />
        <ToggleRow label={t.large} hint={t.largeHint} value={prefs.largeCards} onChange={(v) => patch({ largeCards: v })} />
        <ToggleRow label={t.motion} hint={t.motionHint} value={prefs.reducedMotion} onChange={(v) => patch({ reducedMotion: v })} />
      </SettingsGroup>
      <NavRow icon="▦" title={t.designs} caption={t.designsHint} onPress={() => router.push("/themes")} />
    </SettingsScreen>
  );
}

/** Settings > Playing: hints, turn clock, easy mode. Easy mode also switches on the large cards and four-colour deck. */
export function PlayScreen() {
  const { profile: p, update } = useProfile();
  const [prefs, setPrefs] = usePrefs();
  const t = T.play;
  const setEasy = (on: boolean) => {
    update(on ? { easy: true, hints: true, timer: false } : { easy: false });
    if (on) setPrefs({ ...prefs, largeCards: true, fourColor: true });
  };
  return (
    <SettingsScreen title={t.title}>
      <SettingsGroup>
        <ToggleRow label={t.hints} hint={t.hintsHint} value={p.hints} onChange={(v) => update({ hints: v })} />
        <ToggleRow label={t.timer} hint={t.timerHint} value={p.timer} onChange={(v) => update({ timer: v })} />
        <ToggleRow label={t.easy} hint={t.easyHint} value={p.easy} onChange={setEasy} />
      </SettingsGroup>
    </SettingsScreen>
  );
}

/** Settings > Sound and feel: stores the switches only; the app does not play audio or haptics yet. */
export function SoundScreen() {
  const { profile: p, update } = useProfile();
  const t = T.sound;
  const set = (k: keyof typeof p.sound) => (v: boolean) => update({ sound: { ...p.sound, [k]: v } });
  return (
    <SettingsScreen title={t.title}>
      <SettingsGroup>
        <ToggleRow label={t.master} hint={t.masterHint} value={p.sound.master} onChange={set("master")} />
        <ToggleRow label={t.effects} hint={t.effectsHint} value={p.sound.effects} onChange={set("effects")} />
        <ToggleRow label={t.haptics} hint={t.hapticsHint} value={p.sound.haptics} onChange={set("haptics")} />
      </SettingsGroup>
      <Caption tone="warning">{t.note}</Caption>
    </SettingsScreen>
  );
}
