import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { GoldButton } from "../../components/ui/GoldButton";
import { cards, fonts, material } from "../../theme/tokens";
import { useProfile } from "../../store/profile";
import { Caption } from "../../components/ui/Caption";
import { T } from "./copy";

const FAN = [["A", "♠", cards.black], ["K", "♥", cards.red], ["Q", "♦", cards.red], ["J", "♣", cards.black], ["10", "♠", cards.black], ["9", "♥", cards.red]] as const;

export function WelcomeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  return (
    <Screen scroll={false} style={{ justifyContent: "center", alignItems: "center" }}>
      <View style={s.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {FAN.map(([r, su, col], i) => (
          <View key={i} style={[s.card, { transform: [{ translateY: 40 }, { rotate: `${(i - 2.5) * 14}deg` }, { translateY: -40 }] }]}>
            <Text style={[s.rank, { color: col }]}>{r}</Text>
            <Text style={[s.suit, { color: col }]}>{su}</Text>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={s.word}>TashZone</Text>
      <View style={{ maxWidth: 260, marginTop: 8 }}><Caption size={14} center>{T.tagline}</Caption></View>
      <View style={s.btns}>
        <GoldButton label={T.start} onPress={() => router.push("/onboarding/language")} />
        {profile.name ? <GoldButton kind="glass" label={T.continueAs(profile.name)} onPress={() => router.replace("/")} /> : null}
      </View>
      <View style={{ marginTop: 10 }}><Caption size={12}>{T.privacy}</Caption></View>
    </Screen>
  );
}
const s = StyleSheet.create({
  fan: { width: 200, height: 150, alignItems: "center", justifyContent: "flex-end" },
  card: { position: "absolute", bottom: 0, width: 58, height: 84, borderRadius: 8, backgroundColor: cards.face, padding: 5, borderWidth: 1, borderColor: "rgba(0,0,0,0.15)" },
  rank: { fontFamily: fonts.cardIndex.family, fontWeight: "700", fontSize: 18 },
  suit: { fontSize: 20, marginTop: -2 },
  word: { fontFamily: fonts.display.family, fontWeight: "700", fontSize: 44, color: material.goldLeaf, marginTop: 18 },
  btns: { alignSelf: "stretch", gap: 10, marginTop: 24 },
});
