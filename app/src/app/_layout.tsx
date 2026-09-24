import React, { useEffect, useLayoutEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SystemUI from "expo-system-ui";
import { Jost_400Regular, Jost_500Medium, Jost_600SemiBold, Jost_700Bold } from "@expo-google-fonts/jost";
import { CormorantGaramond_600SemiBold } from "@expo-google-fonts/cormorant-garamond";
import { BodoniModa_700Bold } from "@expo-google-fonts/bodoni-moda";
import { NotoNastaliqUrdu_400Regular } from "@expo-google-fonts/noto-nastaliq-urdu";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { ProfileProvider, useProfile } from "../store/profile";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";
import { setLang } from "../i18n";
import { RoomSwitch } from "../components/ui/RoomSwitch";
import { StorageNotice } from "../components/ui/StorageNotice";
import { UpdateNotice } from "../components/ui/UpdateNotice";

SplashScreen.preventAutoHideAsync().catch(() => {});

const LOCKS: Record<string, ScreenOrientation.OrientationLock> = {
  auto: ScreenOrientation.OrientationLock.DEFAULT,
  portrait: ScreenOrientation.OrientationLock.PORTRAIT_UP,
  landscape: ScreenOrientation.OrientationLock.LANDSCAPE,
};

function Shell({ fontsReady }: { fontsReady: boolean }) {
  const { c, ready: themeReady, orientation, rtl } = useTheme();
  const { profile, ready } = useProfile();
  const segments = useSegments();
  const allReady = fontsReady && themeReady && ready;

  useLayoutEffect(() => { setLang(profile.lang); }, [profile.lang]);

  useEffect(() => { if (allReady) SplashScreen.hideAsync().catch(() => {}); }, [allReady]);
  useEffect(() => { SystemUI.setBackgroundColorAsync(c.bg).catch(() => {}); }, [c.bg]);
  useEffect(() => { ScreenOrientation.lockAsync(LOCKS[orientation] ?? LOCKS.auto!).catch(() => {}); }, [orientation]);

  if (!allReady) return null;
  if (!profile.onboarded && segments[0] !== "onboarding") return <Redirect href="/onboarding/welcome" />;
  return (
    <View style={[s.root, { backgroundColor: c.bg, direction: rtl ? "rtl" : "ltr" }]}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: "fade_from_bottom" }} />
      <RoomSwitch />
      <StorageNotice />
      <UpdateNotice />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Jost: Jost_400Regular, "Jost-Medium": Jost_500Medium, "Jost-SemiBold": Jost_600SemiBold, "Jost-Bold": Jost_700Bold,
    "Cormorant Garamond": CormorantGaramond_600SemiBold, "Bodoni Moda": BodoniModa_700Bold, "Noto Nastaliq Urdu": NotoNastaliqUrdu_400Regular,
  });
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ProfileProvider>
          <Shell fontsReady={loaded || !!error} />
        </ProfileProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
