import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { cards, fonts, type ThemeSpec } from "../../theme/tokens";
import { ButtonFace, buttonText } from "../../components/ui/GoldButton";
import { surfaceStyle } from "../../components/ui/GlassCard";
import { CardBack } from "../play/table/CardBack";

const FACES = [["A", "♠", "S"], ["K", "♥", "H"], ["Q", "♦", "D"]] as const;

export function RoomPreview({ t, on, fourColor, onPress }: { t: ThemeSpec; on: boolean; fourColor: boolean; onPress: () => void }) {
  const suits = fourColor ? cards.fourColor : cards.twoColor;
  const caps = t.type.titleCase === "uppercase";
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${t.label.en}. ${t.story}`} onPress={onPress}
      style={({ pressed }) => [s.room, { backgroundColor: t.c.bg, borderColor: on ? t.accent.color : t.c.borderSubtle, borderWidth: on ? 2 : 1, borderRadius: Math.max(8, t.shape.radius) }, pressed && { opacity: 0.9 }]}>
      <Text numberOfLines={1} style={[s.name, { color: t.accent.color, fontFamily: t.type.display, fontSize: caps ? 15 : 20, letterSpacing: t.type.tracking * 0.6, textTransform: t.type.titleCase }]}>{t.label.en}</Text>
      <View style={[s.feltRim, { borderRadius: t.shape.felt, backgroundColor: t.felt.rimStyle === "double" ? t.felt.deep : t.felt.rim, borderColor: t.felt.rim, borderWidth: t.felt.rimStyle === "double" ? 2 : 0 }]}>
        <LinearGradient colors={[t.felt.lit, t.felt.base, t.felt.deep]} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={[s.felt, { borderRadius: Math.max(3, t.shape.felt - 3) }]}>
          {t.felt.bands.map((b, i) => <View key={b} style={[s.band, { backgroundColor: b, top: `${18 + i * 44}%` }]} />)}
          <CardBack t={t} width={22} />
          {FACES.map(([r, g, k]) => (
            <View key={k} style={s.card}><Text style={[s.face, { color: suits[k] }]}>{r}{g}</Text></View>
          ))}
        </LinearGradient>
      </View>
      <View style={[s.panel, surfaceStyle(t)]}>
        <Text style={[s.num, { color: t.value.points, fontFamily: t.type.numerals }]}>27</Text>
        <Text style={[s.num, { color: t.value.bid, fontFamily: t.type.numerals }]}>4</Text>
        <Text style={[s.num, { color: t.value.coins, fontFamily: t.type.numerals }]}>85</Text>
      </View>
      <ButtonFace t={t} style={s.btn}><Text style={[s.btnText, buttonText(t)]}>Play</Text></ButtonFace>
      <Text style={[s.check, { color: on ? t.accent.color : "transparent" }]}>●</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  room: { flex: 1, padding: 8, gap: 6, minWidth: 0 },
  name: { textAlign: "center" },
  feltRim: { padding: 3 },
  felt: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, overflow: "hidden" },
  band: { position: "absolute", left: "-20%", right: "-20%", height: "18%", transform: [{ rotate: "-22deg" }] },
  card: { width: 20, height: 28, borderRadius: 3, backgroundColor: cards.face, alignItems: "center", justifyContent: "center" },
  face: { fontFamily: fonts.cardIndex.family, fontSize: 9 },
  panel: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 4 },
  num: { fontSize: 14 },
  btn: { minHeight: 30, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  btnText: { fontFamily: fonts.ui.semibold, fontSize: 12 },
  check: { textAlign: "center", fontSize: 10, marginTop: -2 },
});
