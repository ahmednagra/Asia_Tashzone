import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { material } from "../../../theme/tokens";

function FeltMotif() {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <Pattern id="lattice" width={28} height={28} patternUnits="userSpaceOnUse">
          <Path d="M14 0L28 14L14 28L0 14Z" fill="none" stroke={material.goldLeaf} strokeWidth={0.75} />
          <Path d="M14 8L20 14L14 20L8 14Z" fill="none" stroke={material.goldLeaf} strokeWidth={0.5} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#lattice)" opacity={0.09} />
    </Svg>
  );
}

export function Felt({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const breatheAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 0.75,
          duration: 3400,
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0.4,
          duration: 3400,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breatheAnim]);

  return (
    <View style={[s.stage3D, style]}>
      <LinearGradient colors={[material.walnutLit, material.walnut, "#1F120A"]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.rim}>
        <LinearGradient
          colors={[material.feltLit, material.felt, material.feltDeep, material.feltRim]}
          locations={[0, 0.35, 0.75, 1]}
          start={{ x: 0.3, y: 0.05 }}
          end={{ x: 0.7, y: 0.95 }}
          style={s.felt}
        >
          <FeltMotif />

          <Animated.View pointerEvents="none" style={[s.spotlight, { opacity: breatheAnim }]}>
            <LinearGradient
              colors={["rgba(246, 224, 176, 0.22)", "rgba(26, 116, 88, 0.1)", "transparent"]}
              start={{ x: 0.5, y: 0.1 }}
              end={{ x: 0.5, y: 0.9 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <View pointerEvents="none" style={s.inner} />
          {children}
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

const s = StyleSheet.create({
  stage3D: {
    flex: 1,
    minHeight: 0,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  rim: {
    flex: 1,
    borderRadius: 36,
    padding: 7,
    borderWidth: 1.5,
    borderColor: "rgba(227, 189, 110, 0.3)",
  },
  felt: {
    flex: 1,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: material.goldLeafDim,
    padding: 8,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  spotlight: {
    position: "absolute",
    top: -20,
    left: "15%",
    right: "15%",
    bottom: "20%",
    borderRadius: 999,
  },
  inner: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 14,
    right: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: material.line,
  },
});
