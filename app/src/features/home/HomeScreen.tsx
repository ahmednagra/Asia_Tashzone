import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fonts, material, radius } from "../../design/tokens";
import { useTheme } from "../../ui/theme";
import { GAMES, type GameEntry } from "../play/games";

export function Home({ onPlay, onOnline, onSettings }: { onPlay: (g: GameEntry) => void; onOnline: (g: GameEntry) => void; onSettings: () => void }) {
  const { c } = useTheme();
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={s.page}>
      <Text style={[s.title, { color: c.text }]}>TashZone</Text>
      <Text style={[s.sub, { color: c.textSecondary }]}>A table for the games you grew up with.</Text>
      {GAMES.map((g) => (
        <View key={g.id} style={[s.tile, { backgroundColor: c.surface, borderColor: c.borderSubtle }]}>
          <View style={s.tileText}>
            <Text style={[s.game, { color: c.text }]}>{g.name}</Text>
            <Text style={[s.meta, { color: c.textMuted }]}>{g.alias ? `${g.alias}, ` : ""}{g.region}</Text>
          </View>
          {g.status === "play" ? (
            <View style={s.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Play ${g.name} with bots`} onPress={() => onPlay(g)} style={[s.btn, { backgroundColor: c.primary }]}>
                <Text style={[s.btnText, { color: c.onPrimary }]}>Bots</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Play ${g.name} online`} onPress={() => onOnline(g)} style={[s.btn, { borderColor: c.borderControl, borderWidth: 1.5 }]}>
                <Text style={[s.btnText, { color: c.text }]}>Online</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[s.soon, { color: c.textMuted }]}>Coming soon</Text>
          )}
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={onSettings} style={s.settings}>
        <Text style={{ color: c.textSecondary, fontSize: 17 }}>Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 20, gap: 12, paddingBottom: 48 },
  title: { fontFamily: fonts.display.family, fontSize: 40, fontWeight: "600", marginTop: 24 },
  sub: { fontFamily: fonts.ui.family, fontSize: 17, marginBottom: 12 },
  tile: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: radius.sheet, borderWidth: 1, borderLeftWidth: 4, borderLeftColor: material.goldLeafDim, gap: 12 },
  tileText: { flex: 1, gap: 2 },
  game: { fontFamily: fonts.display.family, fontSize: 24, fontWeight: "600" },
  meta: { fontFamily: fonts.ui.family, fontSize: 13 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { minHeight: 44, minWidth: 64, paddingHorizontal: 14, borderRadius: radius.control, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: fonts.ui.family, fontWeight: "600", fontSize: 15 },
  soon: { fontFamily: fonts.ui.family, fontSize: 13 },
  settings: { minHeight: 44, justifyContent: "center", alignSelf: "center", marginTop: 12 },
});
