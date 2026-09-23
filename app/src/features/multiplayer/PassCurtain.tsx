/** Mockup `pass`: hand-over curtain between pass-and-play players. Hides the hand until the next player taps. */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, material } from "../../theme/tokens";
import { GoldButton } from "../../components/ui/GoldButton";
import { useBackAction } from "../../hooks/useBackAction";
import { copy } from "./copy";

/** Full-screen curtain. Always dark (it hides cards), so it uses material tokens rather than the theme. Back is swallowed: only the named player can lift it. */
export function PassCurtain({ name, onReady }: { name: string; onReady: () => void }) {
  const inset = useSafeAreaInsets();
  const t = copy.pass;
  const who = name.trim() || t.fallbackName;
  useBackAction(() => {}, true);
  return (
    <LinearGradient colors={[material.feltDeep, material.obsidian]} style={[s.root, { paddingTop: inset.top + 24, paddingBottom: inset.bottom + 24 }]}>
      <View style={s.center} accessible accessibilityLabel={`${t.lead} ${who}. ${t.body(who)}`} accessibilityLiveRegion="assertive">
        <Text style={s.lab}>{t.lead.toUpperCase()}</Text>
        <Text style={s.name} numberOfLines={2} adjustsFontSizeToFit>{who}</Text>
        <Text style={s.body}>{t.body(who)}</Text>
      </View>
      <GoldButton label={t.ready(who)} onPress={onReady} />
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  lab: { fontFamily: fonts.ui.family, fontSize: 12, letterSpacing: 1.6, fontWeight: "600", color: material.goldLeafDim },
  body: { fontFamily: fonts.ui.family, fontSize: 15, lineHeight: 21, textAlign: "center", color: material.paper2, maxWidth: 300 },
  name: { fontFamily: fonts.display.family, fontSize: 48, fontWeight: "700", color: material.goldLeafHot, textAlign: "center" },
});
