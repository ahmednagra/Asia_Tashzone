import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChipGroup } from "../../components/ui/ChipGroup";
import { NavRow } from "../../components/ui/NavRow";
import { SettingsGroup, SettingsScreen } from "../../components/ui/Settings";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { type HapticStrength, type OrientationOption, type ThemePrefs, usePrefs } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { THEME_IDS, festivalWindow, openFestivals, themes, type ThemeId } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { Caption } from "../../components/ui/Caption";
import { shortDate } from "../../i18n";
import { useFeel } from "../../utils/feel";
import { RoomPreview } from "./RoomPreview";
import { T } from "./copy";

const orientations = (): { value: OrientationOption; label: string }[] => [
  { value: "auto", label: T.looks.orientAuto }, { value: "portrait", label: T.looks.orientPortrait }, { value: "landscape", label: T.looks.orientLandscape },
];
const haptics = (): { value: HapticStrength; label: string }[] => [
  { value: "off", label: T.sound.hapticOff }, { value: "gentle", label: T.sound.hapticGentle }, { value: "crisp", label: T.sound.hapticCrisp }, { value: "firm", label: T.sound.hapticFirm },
];
const VOLUMES: { value: number; label: string }[] = [25, 50, 75, 100].map((v) => ({ value: v, label: `${v}%` }));

/** Settings > How it looks: the room picker, deck, motion and orientation, all applied live through ThemeContext. */
export function AppearanceScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = usePrefs();
  const feel = useFeel();
  const { t: room } = useTheme();
  const festivals = openFestivals();
  const t = T.looks;
  const patch = (p: Partial<ThemePrefs>) => setPrefs((prev) => ({ ...prev, ...p }));
  const choose = (id: ThemeId) => { if (id !== prefs.name) { patch({ name: id }); feel("switch"); } };
  return (
    <SettingsScreen title={t.title}>
      <View>
        <SectionLabel>{t.room}</SectionLabel>
        <View accessibilityRole="radiogroup" accessibilityLabel={t.room} style={s.rooms}>
          {THEME_IDS.map((id) => <RoomPreview key={id} t={themes[id]} on={room.id === id} fourColor={prefs.fourColor} onPress={() => choose(id)} />)}
        </View>
      </View>
      {festivals.length ? (
        <View>
          <SectionLabel>{t.festival}</SectionLabel>
          <View accessibilityRole="radiogroup" accessibilityLabel={t.festival} style={s.rooms}>
            {festivals.map((id) => <RoomPreview key={id} t={themes[id]} on={room.id === id} fourColor={prefs.fourColor} onPress={() => choose(id)} />)}
            {festivals.length === 1 ? <View style={s.spacer} /> : null}
          </View>
          <Caption tone="muted">{festivals.map((id) => t.until(shortDate(festivalWindow(id)!.end))).join(" · ")}</Caption>
        </View>
      ) : null}
      <SettingsGroup title={t.cards}>
        <ToggleRow label={t.four} hint={t.fourHint} value={prefs.fourColor} onChange={(v) => patch({ fourColor: v })} />
        <ToggleRow label={t.large} hint={t.largeHint} value={prefs.largeCards} onChange={(v) => patch({ largeCards: v })} />
        <ToggleRow label={t.motion} hint={t.motionHint} value={prefs.reducedMotion} onChange={(v) => patch({ reducedMotion: v })} />
      </SettingsGroup>
      <ChipGroup label={t.orientation} options={orientations()} value={prefs.orientation} onChange={(v) => patch({ orientation: v })} />
      <NavRow icon="▦" title={t.designs} caption={t.designsHint} onPress={() => router.push("/themes")} />
    </SettingsScreen>
  );
}

/** Settings > Playing: hints, turn clock, easy mode. Easy mode also switches on the large cards and four-colour deck. */
export function PlayScreen() {
  const { profile: p, update } = useProfile();
  const [, setPrefs] = usePrefs();
  const t = T.play;
  const setEasy = (on: boolean) => {
    update(on ? { easy: true, hints: true, timer: false } : { easy: false });
    setPrefs((prev) => ({ ...prev, largeCards: on, fourColor: on }));
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

/** Settings > Sound and feel: table sounds from the current room, their volume, and haptic strength. */
export function SoundScreen() {
  const { profile: p, update } = useProfile();
  const [prefs, setPrefs] = usePrefs();
  const feel = useFeel();
  const t = T.sound;
  const set = (k: keyof typeof p.sound) => (v: boolean) => update({ sound: { ...p.sound, [k]: v } });
  return (
    <SettingsScreen title={t.title}>
      <SettingsGroup>
        <ToggleRow label={t.master} hint={t.masterHint} value={p.sound.master} onChange={set("master")} />
        <ToggleRow label={t.effects} hint={t.effectsHint} value={p.sound.effects} onChange={set("effects")} />
        <ToggleRow label={t.haptics} hint={t.hapticsHint} value={p.sound.haptics} onChange={set("haptics")} />
      </SettingsGroup>
      <ChipGroup label={t.volume} options={VOLUMES} value={prefs.sfxVolume} onChange={(v) => { setPrefs((prev) => ({ ...prev, sfxVolume: v })); feel("tap"); }} />
      <ChipGroup label={t.strength} hint={t.strengthHint} options={haptics()} value={prefs.hapticStrength} onChange={(v) => { setPrefs((prev) => ({ ...prev, hapticStrength: v })); feel("play"); }} />
    </SettingsScreen>
  );
}

const s = StyleSheet.create({ rooms: { flexDirection: "row", gap: 8 }, spacer: { flex: 1 } });
