import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions } from "react-native";
import { useTheme } from "../../context/ThemeContext";

export function RoomSwitch() {
  const { t, calm, ready } = useTheme();
  const { width, height } = useWindowDimensions();
  const last = useRef(t.id);
  const grow = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) { last.current = t.id; return; }
    if (last.current === t.id) return;
    last.current = t.id;
    setColor(t.felt.base);
    grow.setValue(0);
    fade.setValue(1);
    const out = Animated.timing(fade, { toValue: 0, duration: calm ? 120 : 220, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const run = calm ? out : Animated.sequence([Animated.timing(grow, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }), out]);
    if (calm) grow.setValue(1);
    run.start(({ finished }) => { if (finished) setColor(null); });
    return () => run.stop();
  }, [t.id, t.felt.base, calm, ready, grow, fade]);

  if (!color) return null;
  const size = Math.hypot(width, height) * 2;
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[s.disc, { width: size, height: size, borderRadius: size / 2, left: (width - size) / 2, top: (height - size) / 2, backgroundColor: color, opacity: fade, transform: [{ scale: grow }] }]} />
  );
}

const s = StyleSheet.create({ disc: { position: "absolute" } });
