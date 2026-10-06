import React from "react";
import { Tabs } from "expo-router";
import { TabBar } from "../../components/ui/TabBar";
import { U } from "../../components/ui/copy";
import { useTheme } from "../../context/ThemeContext";

/** The four main tabs (mockup `.tabbar`). Sub-screens open above this group as stack routes. */
export default function TabsLayout() {
  useTheme();
  return (
    <Tabs tabBar={(p) => <TabBar {...(p as unknown as React.ComponentProps<typeof TabBar>)} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: U.tabs.index }} />
      <Tabs.Screen name="games" options={{ title: U.tabs.games }} />
      <Tabs.Screen name="me" options={{ title: U.tabs.me }} />
      <Tabs.Screen name="settings" options={{ title: U.tabs.settings }} />
    </Tabs>
  );
}
