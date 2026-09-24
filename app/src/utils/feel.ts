import { useCallback } from "react";
import * as Haptics from "expo-haptics";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import type { HapticLevel, ThemeId } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";
import { useProfile } from "../store/profile";

export type Cue = "tap" | "lift" | "play" | "trick" | "turn" | "win" | "warn" | "switch";
type SoundCue = "tap" | "play" | "trick" | "turn" | "win" | "switch";

const SOUNDS: Record<ThemeId, Record<SoundCue, number>> = {
  emerald: {
    tap: require("../../assets/sounds/emerald-tap.wav"), play: require("../../assets/sounds/emerald-play.wav"), trick: require("../../assets/sounds/emerald-trick.wav"),
    turn: require("../../assets/sounds/emerald-turn.wav"), win: require("../../assets/sounds/emerald-win.wav"), switch: require("../../assets/sounds/emerald-switch.wav"),
  },
  gold: {
    tap: require("../../assets/sounds/gold-tap.wav"), play: require("../../assets/sounds/gold-play.wav"), trick: require("../../assets/sounds/gold-trick.wav"),
    turn: require("../../assets/sounds/gold-turn.wav"), win: require("../../assets/sounds/gold-win.wav"), switch: require("../../assets/sounds/gold-switch.wav"),
  },
  arcade: {
    tap: require("../../assets/sounds/arcade-tap.wav"), play: require("../../assets/sounds/arcade-play.wav"), trick: require("../../assets/sounds/arcade-trick.wav"),
    turn: require("../../assets/sounds/arcade-turn.wav"), win: require("../../assets/sounds/arcade-win.wav"), switch: require("../../assets/sounds/arcade-switch.wav"),
  },
};

const SOUND_OF: Partial<Record<Cue, SoundCue>> = { tap: "tap", play: "play", trick: "trick", turn: "turn", win: "win", switch: "switch", warn: "turn" };

const players = new Map<string, AudioPlayer>();
let modeSet = false;

function player(theme: ThemeId, cue: SoundCue): AudioPlayer | null {
  const key = `${theme}-${cue}`;
  const hit = players.get(key);
  if (hit) return hit;
  try {
    if (!modeSet) { modeSet = true; setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {}); }
    const p = createAudioPlayer(SOUNDS[theme][cue]);
    players.set(key, p);
    return p;
  } catch {
    return null;
  }
}

export function playSound(theme: ThemeId, cue: Cue, volume: number) {
  const sc = SOUND_OF[cue];
  if (!sc || volume <= 0) return;
  const p = player(theme, sc);
  if (!p) return;
  try {
    p.volume = Math.max(0, Math.min(1, volume));
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {}
}

const IMPACT: Record<Exclude<HapticLevel, "off">, Haptics.ImpactFeedbackStyle> = {
  gentle: Haptics.ImpactFeedbackStyle.Light,
  crisp: Haptics.ImpactFeedbackStyle.Medium,
  firm: Haptics.ImpactFeedbackStyle.Heavy,
};
const RANK: Record<HapticLevel, number> = { off: 0, gentle: 1, crisp: 2, firm: 3 };
const scale = (level: HapticLevel, cap: HapticLevel): HapticLevel => (RANK[level] <= RANK[cap] ? level : cap);

export function buzz(cue: Cue, themeLevel: { play: HapticLevel; win: HapticLevel }, cap: HapticLevel) {
  if (cap === "off") return;
  const run = (p: Promise<void>) => p.catch(() => {});
  switch (cue) {
    case "tap": case "switch": run(Haptics.selectionAsync()); return;
    case "lift": run(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); return;
    case "play": { const l = scale(themeLevel.play, cap); if (l !== "off") run(Haptics.impactAsync(IMPACT[l])); return; }
    case "trick": case "turn": run(Haptics.impactAsync(IMPACT[scale("gentle", cap) as Exclude<HapticLevel, "off">])); return;
    case "win": if (scale(themeLevel.win, cap) !== "off") run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); return;
    case "warn": run(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)); return;
  }
}

export function useFeel() {
  const { t, hapticStrength, sfxVolume } = useTheme();
  const { profile } = useProfile();
  const { master, effects, haptics } = profile.sound;
  return useCallback((cue: Cue) => {
    if (master && effects) playSound(t.id, cue, sfxVolume / 100);
    if (haptics) buzz(cue, t.haptic, hapticStrength);
  }, [t, hapticStrength, sfxVolume, master, effects, haptics]);
}
