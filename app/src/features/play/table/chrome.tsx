/** Small table-only controls, drawn on the always-dark table whatever the app theme (tokens: onTable, material). */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, material, minTouchTarget, onTable } from "../../../theme/tokens";
import { CLOCK_LOW_MS, timeLeftFraction } from "./insights";

/** Static pill over the felt (mockup `.chip.mini`). */
export function FeltChip({ text, warn }: { text: string; warn?: boolean }) {
  return (
    <View style={[s.chip, warn && { borderColor: onTable.warning }]}>
      <Text style={[s.chipText, warn && { color: onTable.warning }]}>{text}</Text>
    </View>
  );
}

/** Round icon button of the top bar (mockup `.rd`), 44 dp. */
export function RoundButton({ glyph, label, onPress, on }: { glyph: string; label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [s.round, on && s.roundOn, pressed && { opacity: 0.8 }]}>
      <Text style={s.roundGlyph}>{glyph}</Text>
    </Pressable>
  );
}

/** Small action under the table (mockup `.actions .btn`), 44 dp tall. */
export function ActionPill({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [s.pill, primary && s.pillPrimary, disabled && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
      <Text style={[s.pillText, primary && { color: material.btnInk }]}>{label}</Text>
    </Pressable>
  );
}

/** Turn clock (mockup `.tbar`): gold, red in the last seconds. Not announced; the turn itself is. */
export function TurnBar({ remainingMs, totalMs, width = 64 }: { remainingMs: number; totalMs: number; width?: number }) {
  const low = remainingMs <= CLOCK_LOW_MS;
  return (
    <View style={[s.track, { width }]} accessible accessibilityRole="progressbar" accessibilityLabel={`Time left: ${Math.max(0, Math.ceil(remainingMs / 1000))} seconds`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(timeLeftFraction(remainingMs, totalMs) * 100) }}>
      <View style={[s.fill, { width: `${timeLeftFraction(remainingMs, totalMs) * 100}%`, backgroundColor: low ? onTable.error : onTable.gold }]} />
    </View>
  );
}

const s = StyleSheet.create({
  chip: { borderWidth: 1, borderColor: material.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: material.feltRim },
  chipText: { color: onTable.secondary, fontFamily: fonts.ui.family, fontSize: 12 },
  round: { width: minTouchTarget, height: minTouchTarget, borderRadius: minTouchTarget / 2, borderWidth: 1, borderColor: material.line, backgroundColor: material.glass, alignItems: "center", justifyContent: "center" },
  roundOn: { borderColor: onTable.gold },
  roundGlyph: { color: onTable.text, fontSize: 19 },
  pill: { minHeight: minTouchTarget, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: material.lineHard, backgroundColor: material.glass, alignItems: "center", justifyContent: "center" },
  pillPrimary: { backgroundColor: material.goldLeaf, borderColor: material.goldLeaf },
  pillText: { color: onTable.text, fontFamily: fonts.ui.semibold, fontSize: 14 },
  track: { height: 4, borderRadius: 3, backgroundColor: material.glass, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});
