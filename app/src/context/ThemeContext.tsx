import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type SemanticColors, type ThemeName, colors } from "../theme/tokens";

/** `system: true` (the default) follows the device scheme and ignores `name`. */
export interface ThemePrefs { name: ThemeName; fourColor: boolean; reducedMotion: boolean; largeCards: boolean; system?: boolean }
interface Theme extends Omit<ThemePrefs, "system"> { c: SemanticColors }

const DEFAULTS: ThemePrefs = { name: "dark", fourColor: false, reducedMotion: false, largeCards: false, system: true };
const KEY = "tashzone.theme.v1";

const Ctx = createContext<Theme>({ ...DEFAULTS, c: colors.dark });
const PrefsCtx = createContext<[ThemePrefs, (p: ThemePrefs) => void]>([DEFAULTS, () => {}]);

/** Reads saved prefs defensively; anything malformed falls back to the default for that field. */
function parsePrefs(raw: unknown): ThemePrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const b = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    name: r.name === "light" ? "light" : "dark",
    fourColor: b(r.fourColor, false), reducedMotion: b(r.reducedMotion, false), largeCards: b(r.largeCards, false), system: b(r.system, true),
  };
}

/** Owns the display preferences (theme, four-colour deck, reduced motion, large cards), saved on the device. */
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
    } catch {
      /* storage unavailable: the choice still applies for this session */
    }
  }, []);

  const effective: ThemeName = prefs.system !== false ? (scheme === "light" ? "light" : "dark") : prefs.name;
  const value = useMemo<Theme>(() => ({ name: effective, fourColor: prefs.fourColor, reducedMotion: prefs.reducedMotion, largeCards: prefs.largeCards, c: colors[effective] }), [effective, prefs.fourColor, prefs.reducedMotion, prefs.largeCards]);
  const pair = useMemo<[ThemePrefs, (p: ThemePrefs) => void]>(() => [prefs, setPrefs], [prefs, setPrefs]);
  return (
    <PrefsCtx.Provider value={pair}>
      <Ctx.Provider value={value}>{children}</Ctx.Provider>
    </PrefsCtx.Provider>
  );
}
export const useTheme = () => useContext(Ctx);
export const usePrefs = () => useContext(PrefsCtx);
