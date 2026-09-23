import React from "react";
import { Redirect, Stack, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Jost_400Regular, Jost_600SemiBold } from "@expo-google-fonts/jost";
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { BodoniModa_700Bold } from "@expo-google-fonts/bodoni-moda";
import { NotoNastaliqUrdu_400Regular } from "@expo-google-fonts/noto-nastaliq-urdu";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { ProfileProvider, useProfile } from "../store/profile";

/** Tables are always dark felt, so the status bar stays light there whatever the theme. */
function Shell() {
  const { name } = useTheme();
  const { profile, ready } = useProfile();
  const path = usePathname();
  const segments = useSegments();
  if (!ready) return null;
  // first run: everything except the onboarding flow redirects into it
  if (!profile.onboarded && segments[0] !== "onboarding") return <Redirect href="/onboarding/welcome" />;
  const onTable = path.startsWith("/play") || path.startsWith("/online");
  return (
    <>
      <StatusBar style={name === "dark" || onTable ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  // family names match @tashzone/design-system fonts.*; system fallbacks render until loaded (§13.2)
  useFonts({
    Jost: Jost_400Regular, "Jost-SemiBold": Jost_600SemiBold, "Cormorant Garamond": CormorantGaramond_600SemiBold,
    "Bodoni Moda": BodoniModa_700Bold, "Noto Nastaliq Urdu": NotoNastaliqUrdu_400Regular,
  });
  return (
    <ThemeProvider>
      <ProfileProvider>
        <Shell />
      </ProfileProvider>
    </ThemeProvider>
  );
}
