/** Mockup `pass`: hand-over curtain between pass-and-play players. Hides the hand until the next player taps. */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "../../components/ui/GoldButton";
import { useBackAction } from "../../hooks/useBackAction";
import { displayFace, scriptText } from "../../i18n";
import { copy } from "./copy";

/** Full-screen curtain in the room's dark felt (it hides cards). Back is swallowed: only the named player can lift it. */
export function PassCurtain({ name, onReady }: { name: string; onReady: () => void }) {
  const inset = useSafeAreaInsets();
  const { t: room, c, lang } = useTheme();
  const t = copy.pass;
  const who = name.trim() || t.fallbackName;
  useBackAction(() => {}, true);
  return (
    <LinearGradient colors={[room.felt.deep, c.bg]} style={[s.root, { paddingTop: inset.top + 24, paddingBottom: inset.bottom + 24 }]}>
      <View style={s.center} accessible accessibilityLabel={`${t.lead} ${who}. ${t.body(who)}`} accessibilityLiveRegion="assertive">
        <Text style={[s.lab, { color: c.textMuted }, scriptText(lang)]}>{lang === "en" ? t.lead.toUpperCase() : t.lead}</Text>
        <Text style={[s.name, { color: room.accent.color }, displayFace(room.type.display, 48, lang)]} numberOfLines={2} adjustsFontSizeToFit>{who}</Text>
        <Text style={[s.body, { color: c.textSecondary }, lang === "en" ? null : s.bodyScript]}>{t.body(who)}</Text>
      </View>
      <GoldButton label={t.ready(who)} onPress={onReady} />
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  lab: { fontFamily: fonts.ui.semibold, fontSize: 13, letterSpacing: 1.6 },
  body: { fontFamily: fonts.ui.family, fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  bodyScript: { lineHeight: 26 },
  name: { fontSize: 48, textAlign: "center" },
});
