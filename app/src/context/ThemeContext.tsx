import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type SemanticColors, type ThemeName, colors } from "../theme/tokens";

export type OrientationOption = "auto" | "portrait" | "landscape";
export type HapticStrength = "off" | "gentle" | "crisp" | "firm";

export interface ThemePrefs {
  name: ThemeName;
  fourColor: boolean;
  reducedMotion: boolean;
  largeCards: boolean;
  system?: boolean;
  orientation?: OrientationOption;
  hapticStrength?: HapticStrength;
  sfxVolume?: number;
  ambienceVolume?: number;
}

interface Theme extends Omit<ThemePrefs, "system"> {
  c: SemanticColors;
  orientation: OrientationOption;
  system: boolean;
  hapticStrength: HapticStrength;
  sfxVolume: number;
  ambienceVolume: number;
}

const DEFAULTS: ThemePrefs = {
  name: "emerald",
  fourColor: false,
  reducedMotion: false,
  largeCards: false,
  system: false,
  orientation: "auto",
  hapticStrength: "crisp",
  sfxVolume: 80,
  ambienceVolume: 40,
};
const KEY = "tashzone.theme.v1";

const Ctx = createContext<Theme>({
  ...DEFAULTS,
  orientation: "auto",
  system: false,
  hapticStrength: "crisp",
  sfxVolume: 80,
  ambienceVolume: 40,
  c: colors.emerald,
});
const PrefsCtx = createContext<[ThemePrefs, (p: ThemePrefs) => void]>([DEFAULTS, () => {}]);

function parsePrefs(raw: unknown): ThemePrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const orient = (v: unknown): OrientationOption =>
    v === "portrait" || v === "landscape" || v === "auto" ? v : "auto";
  const haptic = (v: unknown): HapticStrength =>
    v === "off" || v === "gentle" || v === "crisp" || v === "firm" ? v : "crisp";
  const themeName = (v: unknown): ThemeName =>
    v === "gold" ? "gold" : v === "light" ? "light" : "emerald";

  return {
    name: themeName(r.name),
    fourColor: b(r.fourColor, false),
    reducedMotion: b(r.reducedMotion, false),
    largeCards: b(r.largeCards, false),
    system: b(r.system, false),
    orientation: orient(r.orientation),
    hapticStrength: haptic(r.hapticStrength),
    sfxVolume: num(r.sfxVolume, 80),
    ambienceVolume: num(r.ambienceVolume, 40),
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [prefs, setPrefsState] = useState<ThemePrefs>(DEFAULTS);
  const touched = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v && !touched.current) setPrefsState(parsePrefs(JSON.parse(v))); })
      .catch(() => {});
  }, []);

  const setPrefs = useCallback((next: ThemePrefs) => {
    touched.current = true;
    setPrefsState(next);
    try {
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    } catch {}
  }, []);

  const effective: ThemeName = prefs.system ? (scheme === "light" ? "light" : "emerald") : prefs.name;
  const value = useMemo<Theme>(
    () => ({
      name: effective,
      fourColor: prefs.fourColor,
      reducedMotion: prefs.reducedMotion,
      largeCards: prefs.largeCards,
      system: !!prefs.system,
      orientation: prefs.orientation ?? "auto",
      hapticStrength: prefs.hapticStrength ?? "crisp",
      sfxVolume: prefs.sfxVolume ?? 80,
      ambienceVolume: prefs.ambienceVolume ?? 40,
      c: colors[effective] ?? colors.emerald,
    }),
    [
      effective,
      prefs.fourColor,
      prefs.reducedMotion,
      prefs.largeCards,
      prefs.system,
      prefs.orientation,
      prefs.hapticStrength,
      prefs.sfxVolume,
      prefs.ambienceVolume,
    ]
  );
  const pair = useMemo<[ThemePrefs, (p: ThemePrefs) => void]>(() => [prefs, setPrefs], [prefs, setPrefs]);
  return (
    <PrefsCtx.Provider value={pair}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </PrefsCtx.Provider>
  );
}
export const useTheme = () => useContext(Ctx);
export const usePrefs = () => useContext(PrefsCtx);
