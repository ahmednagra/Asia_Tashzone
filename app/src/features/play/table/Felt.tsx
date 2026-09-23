/** Walnut rail with the felt inside (mockup `.rail` / `.felt`): gradient cloth, gold rim, dashed inner line and a woven lattice motif. */
import React from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { material } from "../../../theme/tokens";

/** Decorative diamond lattice laid over the cloth. Hidden from screen readers. */
function FeltMotif() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <Pattern id="lattice" width={30} height={30} patternUnits="userSpaceOnUse">
          <Path d="M15 0L30 15L15 30L0 15Z" fill="none" stroke={material.goldLeaf} strokeWidth={0.8} />
          <Path d="M15 9L21 15L15 21L9 15Z" fill="none" stroke={material.goldLeaf} strokeWidth={0.6} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#lattice)" opacity={0.1} />
    </Svg>
  );
}

export function Felt({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={[material.walnutLit, material.walnut]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.rim}>
      <LinearGradient colors={[material.feltLit, material.felt, material.feltDeep]} locations={[0, 0.45, 1]} start={{ x: 0.3, y: 0.05 }} end={{ x: 0.7, y: 1 }} style={s.felt}>
        <FeltMotif />
        <View pointerEvents="none" style={s.inner} />
        {children}
      </LinearGradient>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  rim: { flex: 1, borderRadius: 40, padding: 9, borderWidth: 1, borderColor: material.walnutLit },
  felt: { flex: 1, borderRadius: 32, borderWidth: 1.5, borderColor: material.goldLeafDim, padding: 12, justifyContent: "space-between", overflow: "hidden" },
  inner: { position: "absolute", top: 20, bottom: 20, left: 20, right: 20, borderRadius: 24, borderWidth: 1, borderStyle: "dashed", borderColor: material.line },
});
