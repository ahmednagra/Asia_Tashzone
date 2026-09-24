import React from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Sheet } from "../../components/ui/Sheet";
import { GoldButton } from "../../components/ui/GoldButton";
import { GlassCard } from "../../components/ui/GlassCard";
import { GAMES } from "../../constants/games";
import { playable } from "../games/copy";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

const PLAYABLE = GAMES.filter(playable).length;

export function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c, t } = useTheme();
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const onShare = () => {
    Share.share({ title: "TashZone", message: `Play South Asian card games on TashZone: ${PLAYABLE} ready now, ${GAMES.length - PLAYABLE} more on the way. Fair deals, offline-first.` }).catch(() => {});
  };
  const items = [
    { icon: "⚖", title: "Fair deals", body: "Every deck is shuffled with secure randomness. There is no difficulty tuning, no card steering and no house edge." },
    { icon: "⛨", title: "Private by design", body: "No account, no trackers, no ads. Your profile, stats and settings stay on this phone." },
    { icon: "✦", title: "Regional games", body: `${PLAYABLE} games you can play today: ${GAMES.filter(playable).map((g) => g.name).join(", ")}. ${GAMES.length - PLAYABLE} more are being built.` },
    { icon: "Aa", title: "Credits", body: "Typefaces Jost, Cormorant Garamond, Bodoni Moda and Noto Nastaliq Urdu are used under the SIL Open Font License 1.1." },
  ];
  return (
    <Sheet visible={visible} title="About TashZone" onClose={onClose}
      actions={<><GoldButton label="Share TashZone" onPress={onShare} /><GoldButton kind="glass" label="Close" onPress={onClose} /></>}>
      <View style={s.content}>
        <Text style={[s.version, { color: c.textMuted }]}>Version {version} · {t.label.en} room</Text>
        {items.map((i) => (
          <GlassCard key={i.title} style={s.card}>
            <Text style={[s.icon, { color: t.accent.color }]}>{i.icon}</Text>
            <View style={s.grow}>
              <Text style={[s.title, { color: c.text }]}>{i.title}</Text>
              <Text style={[s.body, { color: c.textSecondary }]}>{i.body}</Text>
            </View>
          </GlassCard>
        ))}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  content: { gap: 8, paddingBottom: 4 },
  version: { fontFamily: fonts.ui.family, fontSize: 13 },
  card: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 12 },
  icon: { fontFamily: fonts.ui.bold, fontSize: 16, width: 22, textAlign: "center", marginTop: 1 },
  grow: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.ui.semibold, fontSize: 15 },
  body: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 18 },
});
