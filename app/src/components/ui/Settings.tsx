import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "./GlassCard";
import { Header } from "./Header";
import { Screen } from "./Screen";
import { SectionLabel } from "./SectionLabel";

/** Page frame for every settings-style screen: safe area, backdrop, header, vertical rhythm. Rows are `NavRow`, `ToggleRow`, `ChipGroup`. */
export function SettingsScreen({ title, back = true, right, children, scroll = true, footer }: { title: string; back?: boolean; right?: React.ReactNode; children: React.ReactNode; scroll?: boolean; footer?: React.ReactNode }) {
  return (
    <Screen scroll={scroll} footer={footer}>
      <Header title={title} back={back} right={right} />
      {children}
    </Screen>
  );
}

/** A glass card holding rows (toggles, choices), with an optional small heading above it. */
export function SettingsGroup({ title, children, tone }: { title?: string; children: React.ReactNode; tone?: "warning" }) {
  const { c } = useTheme();
  return (
    <View>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <GlassCard style={[s.group, tone === "warning" && { borderColor: c.warning }]}>{children}</GlassCard>
    </View>
  );
}

const s = StyleSheet.create({ group: { paddingVertical: 4, gap: 4 } });
