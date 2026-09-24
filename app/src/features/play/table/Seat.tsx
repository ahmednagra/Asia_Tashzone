import React, { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { fonts, onTable } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";
import { AvatarView, avatarBg } from "../../onboarding/AvatarView";
import { scriptText } from "../../../i18n";
import { T } from "./copy";

export const PlayerAvatar = memo(function PlayerAvatar({ name, size, turn, bot, avatar }: { name: string; size: number; turn: boolean; bot: boolean; avatar?: number }) {
  const { t, calm } = useTheme();
  const human = !bot && avatar !== undefined;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pulseAnim.setValue(1);
    if (!turn || calm) return;
    const to = (v: number, d: number) => Animated.timing(pulseAnim, { toValue: v, duration: d, useNativeDriver: true });
    const anim =
      t.motion === "lush"
        ? Animated.loop(Animated.sequence([to(1.14, 700), to(1, 700)]), { iterations: 2 })
        : t.motion === "standard"
        ? Animated.sequence([to(1.08, 180), to(1, 260)])
        : Animated.sequence([to(1.18, 110), Animated.spring(pulseAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })]);
    anim.start();
    return () => anim.stop();
  }, [turn, calm, t.motion, pulseAnim]);

  return (
    <Animated.View
      style={[
        s.ring,
        turn && { borderColor: t.accent.color, shadowColor: t.accent.color, shadowOpacity: 0.8, shadowRadius: 10, elevation: 6 },
        {
          borderRadius: (size + 8) / 2,
          transform: [{ scale: pulseAnim }],
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[s.disc, { width: size, height: size, borderRadius: size / 2, borderColor: t.accent.dim, backgroundColor: human ? avatarBg(avatar!) : t.felt.deep }, bot && { borderStyle: "dashed", borderColor: t.accent.color }]}>
        {human ? <AvatarView index={avatar!} size={Math.round(size * 0.68)} /> : <Text style={[s.initial, { color: t.accent.color, fontSize: size * 0.46 }]}>{name.slice(0, 1).toUpperCase()}</Text>}
      </View>
    </Animated.View>
  );
});

export const Seat = memo(function Seat({ name, isTurn, badge, badgeColor, spoken = "", control, dealer, online = true, out = false, compact = false, voids = [] }: {
  name: string; isTurn: boolean; badge: string; badgeColor?: string; spoken?: string; control: "human" | "handover" | "bot"; dealer: boolean;
  online?: boolean; out?: boolean; compact?: boolean; voids?: readonly string[];
}) {
  const { t, lang } = useTheme();
  const U = T.seatUi;
  const status = control === "bot" ? U.bot : control === "handover" ? U.auto : online ? null : U.offline;
  const spokenLabel = [name, isTurn ? U.theirTurn : "", spoken, voids.join(T.sep), status ?? ""].filter(Boolean).join(T.sep);
  return (
    <View
      style={[s.wrap, compact && s.compact, out && s.out]}
      accessible
      accessibilityLabel={spokenLabel}
      accessibilityLiveRegion={isTurn ? "polite" : "none"}
    >
      <View>
        <PlayerAvatar name={name} size={compact ? 30 : 38} turn={isTurn} bot={control !== "human"} />
        {dealer && <View style={[s.dealer, { backgroundColor: t.accent.color }]}><Text style={[s.dealerText, { color: t.accent.on }]}>D</Text></View>}
      </View>
      <View style={[s.plate, { backgroundColor: t.felt.deep, borderColor: isTurn ? t.accent.color : t.accent.line }]}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <View style={[s.count, { borderColor: t.accent.line }, out && s.countSafe]}><Text style={[s.countText, { color: badgeColor ?? onTable.text }, out && s.countSafeText]}>{badge}</Text></View>
      </View>
      {voids.length > 0 && <Text style={[s.voids, scriptText(lang)]}>{voids.join(" ")}</Text>}
      {status && <Text style={[s.status, scriptText(lang)]}>{lang === "en" ? status.toUpperCase() : status}</Text>}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { alignItems: "center", minWidth: 70, gap: 2 },
  compact: { minWidth: 58 },
  out: { opacity: 0.6 },
  ring: { padding: 3, borderWidth: 1.6, borderColor: "transparent" },
  disc: { alignItems: "center", justifyContent: "center", borderWidth: 2 },
  initial: { fontFamily: fonts.display.family },
  dealer: { position: "absolute", right: -4, bottom: -2, borderRadius: 999, width: 17, height: 17, alignItems: "center", justifyContent: "center" },
  dealerText: { fontFamily: fonts.ui.bold, fontSize: 9.5 },
  plate: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 999, paddingLeft: 8, paddingRight: 3, paddingVertical: 1.5 },
  name: { color: onTable.text, fontFamily: fonts.ui.family, fontSize: 11.5, maxWidth: 64 },
  count: { minWidth: 19, minHeight: 19, borderRadius: 10, paddingHorizontal: 4, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  countText: { fontFamily: fonts.ui.semibold, fontSize: 11, fontVariant: ["tabular-nums"] },
  countSafe: { backgroundColor: onTable.success, borderColor: onTable.success },
  countSafeText: { color: "#16181D" },
  voids: { color: onTable.error, fontFamily: fonts.ui.medium, fontSize: 10, letterSpacing: 0.5 },
  status: { color: onTable.muted, fontFamily: fonts.ui.medium, fontSize: 9, letterSpacing: 0.8 },
});
