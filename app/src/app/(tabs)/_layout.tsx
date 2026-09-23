import React from "react";
import { Tabs } from "expo-router";
import { TabBar } from "../../components/ui/TabBar";

/** The four main tabs (mockup `.tabbar`). Sub-screens open above this group as stack routes. */
export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...(p as unknown as React.ComponentProps<typeof TabBar>)} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Play" }} />
      <Tabs.Screen name="games" options={{ title: "Games" }} />
      <Tabs.Screen name="me" options={{ title: "You" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
