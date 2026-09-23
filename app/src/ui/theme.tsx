import React, { createContext, useContext, useMemo } from "react";
import { type SemanticColors, type ThemeName, colors } from "../design/tokens";

export interface ThemePrefs { name: ThemeName; fourColor: boolean; reducedMotion: boolean; largeCards: boolean }
interface Theme extends ThemePrefs { c: SemanticColors }
const Ctx = createContext<Theme>({ name: "dark", fourColor: false, reducedMotion: false, largeCards: false, c: colors.dark });

export function ThemeProvider({ prefs, children }: { prefs: ThemePrefs; children: React.ReactNode }) {
  const value = useMemo(() => ({ ...prefs, c: colors[prefs.name] }), [prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
