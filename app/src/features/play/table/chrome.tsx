/** Small table-only controls, drawn on the always-dark table in the room's accent (tokens: onTable for text, ThemeSpec for chrome). */
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, minTouchTarget, onTable } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";
import { CLOCK_LOW_MS, timeLeftFraction } from "./insights";
import { useDeadlineLeft, useTurnClock } from "./hooks";

/** Static pill over the felt (mockup `.chip.mini`). */
export function FeltChip({ text, warn, color }: { text: string; warn?: boolean; color?: string }) {
  const { t } = useTheme();
  const ink = warn ? onTable.warning : color ?? onTable.secondary;
  return (
    <View style={[s.chip, { backgroundColor: t.felt.deep, borderColor: warn ? onTable.warning : t.accent.line, borderRadius: t.shape.chip }]}>
      <Text style={[s.chipText, { color: ink }]}>{text}</Text>
    </View>
  );
}

/** Round icon button of the top bar (mockup `.rd`), 44 dp. */
export function RoundButton({ glyph, label, onPress, on }: { glyph: string; label: string; onPress: () => void; on?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.round, { borderColor: on ? t.accent.color : t.accent.lineHard, backgroundColor: on ? t.accent.color : t.surface.bg, borderWidth: t.surface.kind === "slab" ? 2 : 1 }, pressed && { opacity: 0.8 }]}>
      <Text style={[s.roundGlyph, { color: on ? t.accent.on : onTable.text }]} accessibilityElementsHidden importantForAccessibility="no">{glyph}</Text>
    </Pressable>
  );
}

/** Small action under the table (mockup `.actions .btn`), 44 dp tall. */
export function ActionPill({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.pill, { borderColor: primary ? t.accent.color : t.accent.lineHard, backgroundColor: primary ? t.accent.color : t.surface.bg, borderRadius: t.shape.button }, disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
      <Text style={[s.pillText, { color: primary ? t.accent.on : onTable.text }]}>{label}</Text>
    </Pressable>
  );
}

/** Turn clock (mockup `.tbar`): the room's accent, red in the last seconds. Not announced; the turn itself is. */
export function TurnBar({ remainingMs, totalMs, width = 64 }: { remainingMs: number; totalMs: number; width?: number }) {
  const { t } = useTheme();
  const low = remainingMs <= CLOCK_LOW_MS;
  const frac = timeLeftFraction(remainingMs, totalMs);
  return (
    <View style={[s.track, { width }]} accessible accessibilityRole="progressbar" accessibilityLabel={`Time left: ${Math.max(0, Math.ceil(remainingMs / 1000))} seconds`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(frac * 100) }}>
      <View style={[s.fill, { width: `${frac * 100}%`, backgroundColor: low ? onTable.error : t.accent.color }]} />
    </View>
  );
}

export const TurnClock = memo(function TurnClock({ local, turnKey, totalMs, paused, deadline, onExpire, width }: {
  local: boolean; turnKey: string; totalMs: number; paused: boolean; deadline: number | null; onExpire: () => void; width?: number;
}) {
  const localLeft = useTurnClock(local, turnKey, totalMs, paused, onExpire);
  const serverLeft = useDeadlineLeft(deadline, !local && !!deadline);
  const remaining = serverLeft ?? localLeft;
  if (!local && serverLeft === null) return null;
  return <TurnBar remainingMs={remaining} totalMs={totalMs} width={width} />;
});

const s = StyleSheet.create({
  chip: { borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontFamily: fonts.ui.medium, fontSize: 12 },
  round: { width: minTouchTarget, height: minTouchTarget, borderRadius: minTouchTarget / 2, alignItems: "center", justifyContent: "center" },
  roundGlyph: { fontSize: 19 },
  pill: { minHeight: minTouchTarget, paddingHorizontal: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: fonts.ui.semibold, fontSize: 14 },
  track: { height: 4, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});
