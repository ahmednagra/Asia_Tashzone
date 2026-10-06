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
import { U } from "../../components/ui/copy";
import { T } from "./copy";

const PLAYABLE = GAMES.filter(playable).length;

export function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c, t, lang } = useTheme();
  const a = T.about;
  const more = GAMES.length - PLAYABLE;
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const onShare = () => {
    Share.share({ title: "TashZone", message: a.shareMsg(PLAYABLE, more) }).catch(() => {});
  };
  const items = [
    { icon: "⚖", title: a.fairT, body: a.fairB },
    { icon: "⛨", title: a.privateT, body: a.privateB },
    { icon: "✦", title: a.gamesT, body: a.gamesB(PLAYABLE, GAMES.filter(playable).map((g) => g.name).join(a.sep), more) },
    { icon: "Aa", title: a.creditsT, body: a.creditsB },
  ];
  return (
    <Sheet visible={visible} title={T.settings.about} onClose={onClose}
      actions={<><GoldButton label={a.share} onPress={onShare} /><GoldButton kind="glass" label={U.close} onPress={onClose} /></>}>
      <View style={s.content}>
        <Text style={[s.version, { color: c.textMuted }]}>{a.version(version, t.label[lang])}</Text>
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
  version: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 19 },
  card: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 12 },
  icon: { fontFamily: fonts.ui.bold, fontSize: 16, width: 22, textAlign: "center", marginTop: 1 },
  grow: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.ui.semibold, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: fonts.ui.family, fontSize: 13, lineHeight: 19 },
});
