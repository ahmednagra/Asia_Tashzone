import React, { useState } from "react";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Jost_400Regular, Jost_600SemiBold } from "@expo-google-fonts/jost";
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { BodoniModa_700Bold } from "@expo-google-fonts/bodoni-moda";
import { NotoNastaliqUrdu_400Regular } from "@expo-google-fonts/noto-nastaliq-urdu";
import { ThemeProvider, type ThemePrefs } from "./src/ui/theme";
import type { GameEntry } from "./src/features/play/games";
import { Home } from "./src/features/home/HomeScreen";
import { OfflineTable } from "./src/features/play/OfflineTable";
import { OnlineRoom } from "./src/features/lobby/OnlineRoom";
import { Settings } from "./src/features/settings/SettingsScreen";

type Route = { name: "home" } | { name: "offline"; game: GameEntry } | { name: "online"; game: GameEntry } | { name: "settings" };

export default function App() {
  // family names match @tashzone/design-system fonts.*; system fallbacks render until loaded (§13.2)
  useFonts({
    Jost: Jost_400Regular, "Jost-SemiBold": Jost_600SemiBold, "Cormorant Garamond": CormorantGaramond_600SemiBold,
    "Bodoni Moda": BodoniModa_700Bold, "Noto Nastaliq Urdu": NotoNastaliqUrdu_400Regular,
  });
  const scheme = useColorScheme();
  const [prefs, setPrefs] = useState<ThemePrefs>({ name: scheme === "light" ? "light" : "dark", fourColor: false, reducedMotion: false, largeCards: false });
  const [route, setRoute] = useState<Route>({ name: "home" });
  const home = () => setRoute({ name: "home" });
  return (
    <ThemeProvider prefs={prefs}>
      <StatusBar style={prefs.name === "dark" || route.name === "offline" || route.name === "online" ? "light" : "dark"} />
      {route.name === "home" && (
        <Home onPlay={(g) => setRoute({ name: "offline", game: g })} onOnline={(g) => setRoute({ name: "online", game: g })} onSettings={() => setRoute({ name: "settings" })} />
      )}
      {route.name === "offline" && <OfflineTable profileId={route.game.profile!} onExit={home} />}
      {route.name === "online" && <OnlineRoom profileId={route.game.profile!} onExit={home} />}
      {route.name === "settings" && <Settings prefs={prefs} onChange={setPrefs} onExit={home} />}
    </ThemeProvider>
  );
}
