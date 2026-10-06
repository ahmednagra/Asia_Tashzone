import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { U } from "./copy";
import { AVATARS, AvatarView, avatarBg, avatarName } from "../../features/onboarding/AvatarView";

/** A drawn avatar on its coloured disc. Pressable when `onPress` is set (selected = gold ring). */
export function AvatarBadge({ index, size = 50, selected, onPress, label }: { index: number; size?: number; selected?: boolean; onPress?: () => void; label?: string }) {
  const { t } = useTheme();
  const disc = [s.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarBg(index), borderColor: selected ? t.accent.color : "transparent" }];
  const glyph = <AvatarView index={index} size={Math.round(size * 0.56)} />;
  if (!onPress) return <View style={disc}>{glyph}</View>;
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={label ?? avatarName(index)} accessibilityState={{ selected: !!selected }} hitSlop={Math.max(0, (44 - size) / 2)} onPress={onPress} style={disc}>
      {glyph}
    </Pressable>
  );
}

/** Grid of every avatar; used by the You tab sheet (and reusable by onboarding). */
export function AvatarPicker({ value, onChange, label }: { value: number; onChange: (i: number) => void; label?: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label ?? U.avatar} style={s.grid}>
      {AVATARS.map((_, i) => <AvatarBadge key={i} index={i} size={56} selected={value % AVATARS.length === i} onPress={() => onChange(i)} />)}
    </View>
  );
}

const s = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center", borderWidth: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
});
