import React from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Sheet } from "../../components/ui/Sheet";
import { GoldButton } from "../../components/ui/GoldButton";
import { fonts, material, onTable, radius } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";

export function AboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const version = Constants.expoConfig?.version ?? "0.1.0";

  const onShare = async () => {
    try {
      await Share.share({
        message: "Play 16 authentic South Asian card games on TashZone! Fair deals, offline-first mehfil table.",
        title: "TashZone — The Mehfil Table",
      });
    } catch {}
  };

  return (
    <Sheet
      visible={visible}
      title="About TashZone"
      onClose={onClose}
      actions={
        <View style={s.actions}>
          <GoldButton label="Share TashZone" onPress={onShare} />
          <GoldButton kind="glass" label="Close" onPress={onClose} />
        </View>
      }
    >
      <View style={s.content}>
        <View style={s.hero}>
          <View style={s.crest}>
            <Text style={s.crestGlyph}>♠</Text>
          </View>
          <Text style={[s.brandName, { color: onTable.gold }]}>TASHZONE</Text>
          <Text style={[s.tagline, { color: c.textMuted }]}>
            Sixteen South Asian Card Games · The Living Mehfil
          </Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>VERSION {version} · STABLE</Text>
          </View>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardIcon}>⚖</Text>
            <Text style={[s.cardTitle, { color: c.text }]}>Cryptographic Fair Play</Text>
          </View>
          <Text style={[s.cardBody, { color: c.textMuted }]}>
            Every deck is shuffled using cryptographically secure randomness (CSPRNG). There is no dynamic difficulty adjustment, no card manipulation, and zero house advantage.
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardIcon}>🛡</Text>
            <Text style={[s.cardTitle, { color: c.text }]}>100% Privacy & Offline-First</Text>
          </View>
          <Text style={[s.cardBody, { color: c.textMuted }]}>
            No account required, no third-party trackers, and no ad networks. Your player profile, game stats, and local network sessions remain strictly on your device.
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardIcon}>✦</Text>
            <Text style={[s.cardTitle, { color: c.text }]}>Regional Card Heritage</Text>
          </View>
          <Text style={[s.cardBody, { color: c.textMuted }]}>
            Honoring time-tested folk traditions: Court Piece (Rang/Rung), Callbreak, Bhabhi Thulla, Mendikot, 28, Kachuful, Teen Do Paanch, and 16 classics played across Pakistan, India, Nepal, and Bangladesh.
          </Text>
        </View>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  content: { gap: 14, paddingBottom: 12 },
  hero: { alignItems: "center", gap: 6, paddingVertical: 8 },
  crest: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: material.walnut,
    borderWidth: 2,
    borderColor: onTable.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: onTable.gold,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  crestGlyph: {
    color: onTable.gold,
    fontSize: 28,
    lineHeight: 34,
  },
  brandName: {
    fontFamily: fonts.display.family,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 13,
    textAlign: "center",
  },
  badge: {
    backgroundColor: material.glass,
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 2,
  },
  badgeText: {
    color: onTable.gold,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
  },
  card: {
    backgroundColor: material.glass,
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: radius.card,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardIcon: {
    fontSize: 18,
    color: onTable.gold,
  },
  cardTitle: {
    fontFamily: fonts.ui.family,
    fontWeight: "600",
    fontSize: 14.5,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: 8,
    paddingTop: 8,
  },
});
