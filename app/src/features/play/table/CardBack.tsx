import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from "react-native-svg";
import { cards, type ThemeSpec } from "../../../theme/tokens";

function Motif({ t, id }: { t: ThemeSpec; id: string }) {
  const b = t.cardBack;
  if (b.kind === "ajrak") {
    return (
      <Pattern id={id} width={10} height={10} patternUnits="userSpaceOnUse">
        <Rect width={10} height={10} fill={b.base} />
        <Line x1={0} y1={0} x2={10} y2={10} stroke={b.line} strokeWidth={0.7} />
        <Line x1={10} y1={0} x2={0} y2={10} stroke={b.line} strokeWidth={0.7} />
        <Circle cx={5} cy={5} r={2.2} fill={b.motif} stroke={b.line} strokeWidth={0.5} />
      </Pattern>
    );
  }
  if (b.kind === "stripe") {
    return (
      <Pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <Rect width={6} height={6} fill={b.base} />
        <Rect width={3} height={6} fill={b.motif} />
      </Pattern>
    );
  }
  return (
    <Pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse">
      <Rect width={8} height={8} fill={b.base} />
      <Path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke={b.motif} strokeWidth={2} />
      <Path d="M4 1L7 4L4 7L1 4Z" fill="none" stroke={b.line} strokeWidth={0.4} opacity={0.6} />
    </Pattern>
  );
}

export function CardBack({ t, width, height }: { t: ThemeSpec; width: number; height?: number }) {
  const h = height ?? Math.round(width * 1.4);
  const id = `back-${t.id}`;
  const border = t.cardBack.kind === "ajrak" ? t.accent.color : cards.face;
  return (
    <View style={[s.card, { width, height: h, borderColor: border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs><Motif t={t} id={id} /></Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 3, borderWidth: 1.5, overflow: "hidden" },
});
