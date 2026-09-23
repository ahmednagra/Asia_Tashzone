import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

interface Route { key: string; name: string }
interface TabBarProps {
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options: { title?: string; tabBarAccessibilityLabel?: string } }>;
  navigation: { navigate: (name: string) => void; emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
}

const GLYPH: Record<string, string> = { index: "▶", games: "♠", me: "☺", settings: "⚙" };

/** Bottom tab bar (mockup `.tabbar`): Play, Games, You, Settings. */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const { c, name } = useTheme();
  const inset = useSafeAreaInsets();
  const dark = name === "dark";
  return (
    <View style={[s.bar, { paddingBottom: inset.bottom + 6, backgroundColor: dark ? "rgba(7,15,13,0.96)" : c.surface, borderColor: dark ? material.line : c.borderSubtle }]}>
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const label = descriptors[route.key]?.options.title ?? route.name;
        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} style={s.tab}
            onPress={() => {
              const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name);
            }}>
            <Text style={{ fontSize: 20, color: on ? material.goldLeaf : c.textMuted }}>{GLYPH[route.name] ?? "•"}</Text>
            <Text style={[s.label, { color: on ? material.goldLeaf : c.textMuted }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: 1, paddingTop: 6 },
  tab: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontFamily: fonts.ui.family, fontSize: 12, fontWeight: "600" },
});
