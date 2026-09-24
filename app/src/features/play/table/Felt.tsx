import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Path, Pattern, Rect } from "react-native-svg";
import { material, type ThemeSpec } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";

function FeltMotif({ t }: { t: ThemeSpec }) {
  if (t.ornament === "bands") {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {t.felt.bands.map((color, i) => (
          <View key={color} style={[s.band, { backgroundColor: color, top: `${20 + i * 38}%`, transform: [{ rotate: "-24deg" }] }]} />
        ))}
      </View>
    );
  }
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <Pattern id="lattice" width={28} height={28} patternUnits="userSpaceOnUse">
          <Path d="M14 0L28 14L14 28L0 14Z" fill="none" stroke={t.accent.color} strokeWidth={0.75} />
          <Path d="M14 8L20 14L14 20L8 14Z" fill="none" stroke={t.accent.color} strokeWidth={0.5} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#lattice)" opacity={t.ornament === "rule" ? 0.06 : 0.09} />
    </Svg>
  );
}

function Rim({ t, children }: { t: ThemeSpec; children: React.ReactNode }) {
  const radius = t.shape.felt + 18;
  if (t.felt.rimStyle === "double") {
    return (
      <View style={[s.rim, { borderRadius: radius, backgroundColor: t.felt.deep, borderWidth: 2, borderColor: t.felt.rim }]}>
        <View style={[s.fill, { borderRadius: radius - 4, borderWidth: 1, borderColor: t.felt.rim, padding: 3 }]}>{children}</View>
      </View>
    );
  }
  if (t.surface.kind === "slab") {
    return <View style={[s.rim, { borderRadius: radius, backgroundColor: t.c.surface, borderWidth: t.felt.rimWidth, borderColor: t.felt.rim, borderBottomWidth: t.felt.rimWidth + 3 }]}>{children}</View>;
  }
  return (
    <LinearGradient colors={[material.walnutLit, t.felt.rim, "#1F120A"]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[s.rim, { borderRadius: radius, borderWidth: 1.5, borderColor: t.accent.line }]}>
      {children}
    </LinearGradient>
  );
}

export function Felt({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { t, calm } = useTheme();
  const glow = useRef(new Animated.Value(0.4)).current;
  const breathes = t.motion === "lush" && !calm;

  useEffect(() => {
    if (!breathes) { glow.setValue(0.4); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.75, duration: 3000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 3000, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [breathes, glow]);

  return (
    <View style={[s.stage3D, style]}>
      <Rim t={t}>
        <LinearGradient
          colors={[t.felt.lit, t.felt.base, t.felt.deep, material.feltRim]}
          locations={[0, 0.35, 0.8, 1]}
          start={{ x: 0.3, y: 0.05 }}
          end={{ x: 0.7, y: 0.95 }}
          style={[s.felt, { borderRadius: t.shape.felt + 12, borderColor: t.surface.kind === "slab" ? t.felt.rim : t.accent.dim }]}
        >
          <FeltMotif t={t} />
          {t.ornament === "vignette" ? (
            <Animated.View pointerEvents="none" style={[s.spotlight, { opacity: glow }]}>
              <LinearGradient colors={["rgba(246,224,176,0.22)", "rgba(26,116,88,0.1)", "transparent"]} start={{ x: 0.5, y: 0.1 }} end={{ x: 0.5, y: 0.9 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          ) : null}
          <View pointerEvents="none" style={[s.inner, { borderRadius: Math.max(4, t.shape.felt + 4), borderColor: t.surface.kind === "slab" ? "rgba(255,255,255,0.08)" : t.accent.line }]} />
          {children}
        </LinearGradient>
      </Rim>
    </View>
  );
}

const s = StyleSheet.create({
  stage3D: { flex: 1, minHeight: 0, shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  rim: { flex: 1, padding: 7 },
  fill: { flex: 1 },
  felt: { flex: 1, borderWidth: 1.5, padding: 8, justifyContent: "space-between", overflow: "hidden", position: "relative" },
  spotlight: { position: "absolute", top: -20, left: "15%", right: "15%", bottom: "20%", borderRadius: 999 },
  inner: { position: "absolute", top: 14, bottom: 14, left: 14, right: 14, borderWidth: 1, borderStyle: "dashed" },
  band: { position: "absolute", left: "-30%", right: "-30%", height: "16%" },
});
