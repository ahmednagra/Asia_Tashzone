import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type SemanticColors, type ThemeId, type ThemeSpec, themes, toThemeId } from "../theme/tokens";
import { type Lang, getLang, isRTL, subscribeLang } from "../i18n";

export type OrientationOption = "auto" | "portrait" | "landscape";
export type HapticStrength = "off" | "gentle" | "crisp" | "firm";

export interface ThemePrefs {
  name: ThemeId;
  fourColor: boolean;
  reducedMotion: boolean;
  largeCards: boolean;
  orientation: OrientationOption;
  hapticStrength: HapticStrength;
  sfxVolume: number;
  ambienceVolume: number;
}

export interface Theme extends ThemePrefs {
  t: ThemeSpec;
  c: SemanticColors;
  calm: boolean;
  ready: boolean;
  lang: Lang;
  rtl: boolean;
}

export const DEFAULT_PREFS: ThemePrefs = {
  name: "emerald",
  fourColor: false,
  reducedMotion: false,
  largeCards: false,
  orientation: "auto",
  hapticStrength: "crisp",
  sfxVolume: 80,
  ambienceVolume: 40,
};
const KEY = "tashzone.theme.v1";

const initial: Theme = { ...DEFAULT_PREFS, t: themes.emerald, c: themes.emerald.c, calm: false, ready: false, lang: "en", rtl: false };
const Ctx = createContext<Theme>(initial);
type SetPrefs = (next: ThemePrefs | ((prev: ThemePrefs) => ThemePrefs)) => void;
const PrefsCtx = createContext<[ThemePrefs, SetPrefs]>([DEFAULT_PREFS, () => {}]);

const clampVol = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

export function parsePrefs(raw: unknown): ThemePrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? clampVol(v) : d);
  const orient = (v: unknown): OrientationOption => (v === "portrait" || v === "landscape" ? v : "auto");
  const haptic = (v: unknown): HapticStrength => (v === "off" || v === "gentle" || v === "crisp" || v === "firm" ? v : "crisp");
  return {
    name: toThemeId(r.name),
    fourColor: b(r.fourColor, false),
    reducedMotion: b(r.reducedMotion, false),
    largeCards: b(r.largeCards, false),
    orientation: orient(r.orientation),
    hapticStrength: haptic(r.hapticStrength),
    sfxVolume: num(r.sfxVolume, 80),
    ambienceVolume: num(r.ambienceVolume, 40),
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<ThemePrefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [osCalm, setOsCalm] = useState(false);
  const touched = useRef(false);
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  const writes = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((v) => { if (live && v && !touched.current) setPrefsState(parsePrefs(JSON.parse(v))); })
      .catch(() => {})
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOsCalm).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setOsCalm);
    return () => sub.remove();
  }, []);

  const setPrefs = useCallback<SetPrefs>((next) => {
    touched.current = true;
    setPrefsState((prev) => {
      const value = parsePrefs(typeof next === "function" ? next(prev) : next);
      const json = JSON.stringify(value);
      writes.current = writes.current.then(() => AsyncStorage.setItem(KEY, json)).catch(() => {});
      return value;
    });
  }, []);

  const value = useMemo<Theme>(() => {
    const t = themes[prefs.name] ?? themes.emerald;
    return { ...prefs, t, c: t.c, calm: prefs.reducedMotion || osCalm, ready, lang, rtl: isRTL(lang) };
  }, [prefs, osCalm, ready, lang]);
  const pair = useMemo<[ThemePrefs, SetPrefs]>(() => [prefs, setPrefs], [prefs, setPrefs]);
  return (
    <PrefsCtx.Provider value={pair}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </PrefsCtx.Provider>
  );
}
export const useTheme = () => useContext(Ctx);
export const usePrefs = () => useContext(PrefsCtx);
