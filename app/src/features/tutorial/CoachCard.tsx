import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { GoldButton } from "../../components/ui/GoldButton";
import { useTheme } from "../../context/ThemeContext";
import { displayFace, scriptText } from "../../i18n";
import { fonts, minTouchTarget } from "../../theme/tokens";
import { T } from "./copy";

const APPEAR_MS = 240;

export interface CoachCardProps {
  tipKey: string | null;
  title?: string;
  body?: string;
  action?: string;
  onAction: () => void;
  onSkip: () => void;
}

export function CoachCard({ tipKey, title, body, action, onAction, onSkip }: CoachCardProps) {
  const { t, c, calm, lang, rtl } = useTheme();
  const shown = useRef(new Animated.Value(calm ? 1 : 0)).current;
  useEffect(() => {
    if (!tipKey) return;
    if (calm) { shown.setValue(1); return; }
    shown.setValue(0);
    const anim = Animated.timing(shown, { toValue: 1, duration: APPEAR_MS, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [tipKey, calm, shown]);

  const align = { textAlign: rtl ? ("right" as const) : ("left" as const) };
  const skip = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={T.skip}
      onPress={onSkip}
      hitSlop={4}
      style={({ pressed }) => [s.skip, pressed && s.pressed]}
    >
      <Text style={[s.skipText, { color: c.textSecondary }, scriptText(lang)]}>{T.skip}</Text>
    </Pressable>
  );

  if (!tipKey || !title) {
    return (
      <View pointerEvents="box-none" style={s.idle}>
        <View style={[s.pill, { backgroundColor: t.sheet.bg, borderColor: t.accent.line, borderRadius: minTouchTarget / 2 }]}>{skip}</View>
      </View>
    );
  }

  const lift = shown.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  return (
    <Animated.View
      style={[
        s.card,
        {
          backgroundColor: t.sheet.bg,
          borderColor: t.accent.color,
          borderRadius: Math.max(12, t.shape.sheet - 6),
          borderWidth: t.surface.kind === "slab" ? 2 : 1.5,
          opacity: shown,
          transform: [{ translateY: lift }],
        },
      ]}
    >
      <View accessible accessibilityLabel={`${T.coach}. ${title}. ${body ?? ""}`} accessibilityLiveRegion="polite" style={s.text}>
        <Text style={[{ color: t.accent.color }, displayFace(t.type.display, 18, lang), align]}>{title}</Text>
        {body ? (
          <Text style={[s.body, { color: c.text, lineHeight: lang === "ur" ? 27 : 20 }, scriptText(lang), align]}>{body}</Text>
        ) : null}
      </View>
      <View style={s.actions}>
        {skip}
        <GoldButton label={action ?? T.gotIt} onPress={onAction} style={s.action} />
      </View>
      <View
        pointerEvents="none"
        style={[s.arrow, { backgroundColor: t.sheet.bg, borderColor: t.accent.color, borderRightWidth: t.surface.kind === "slab" ? 2 : 1.5, borderBottomWidth: t.surface.kind === "slab" ? 2 : 1.5 }]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  text: {
    gap: 2,
  },
  body: {
    fontFamily: fonts.ui.family,
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  action: {
    minWidth: 104,
  },
  skip: {
    minHeight: minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  skipText: {
    fontFamily: fonts.ui.medium,
    fontSize: 14,
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.7,
  },
  idle: {
    alignItems: "flex-end",
  },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  arrow: {
    position: "absolute",
    bottom: -7,
    start: 32,
    width: 12,
    height: 12,
    transform: [{ rotate: "45deg" }],
  },
});
