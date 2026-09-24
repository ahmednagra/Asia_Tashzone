import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "../../theme/tokens";
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
  const { c, t } = useTheme();
  const inset = useSafeAreaInsets();
  return (
    <View style={[s.bar, { paddingBottom: inset.bottom + 6, backgroundColor: t.tab.bg, borderColor: t.tab.border, borderTopWidth: t.tab.borderWidth }]}>
      {state.routes.map((route, i) => {
        const on = state.index === i;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const color = on ? t.accent.color : c.textMuted;
        return (
          <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label} style={s.tab}
            onPress={() => {
              const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name);
            }}>
            <View style={[s.glyph, on && t.tab.pill ? { backgroundColor: t.tab.pill } : null]}>
              <Text style={{ fontSize: 20, color }}>{GLYPH[route.name] ?? "•"}</Text>
            </View>
            <Text style={[s.label, { color, textTransform: t.button.caps ? "uppercase" : "none", letterSpacing: t.button.caps ? 0.8 : 0 }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  bar: { flexDirection: "row", paddingTop: 6 },
  tab: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 2 },
  glyph: { minWidth: 44, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.ui.semibold, fontSize: 12 },
});
