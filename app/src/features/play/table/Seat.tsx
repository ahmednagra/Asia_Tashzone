import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, material, onTable } from "../../../design/tokens";

/** One seat around the rim: disc with initial, name, a game-specific badge ("3/4", "Team A · 5", "9 cards"). */
export function Seat({ name, isTurn, badge, spoken = "", control, dealer, online = true, out = false, compact = false }: {
  name: string; isTurn: boolean; badge: string; spoken?: string; control: "human" | "handover" | "bot"; dealer: boolean;
  online?: boolean; out?: boolean; compact?: boolean;
}) {
  const status = control === "bot" ? "Bot" : control === "handover" ? "Auto-playing" : online ? null : "Offline";
  return (
    <View
      style={[s.wrap, compact && s.compact, out && s.out]}
      accessible
      accessibilityLabel={`${name}${isTurn ? ", their turn" : ""}${spoken ? `, ${spoken}` : ""}${status ? `, ${status}` : ""}`}
      accessibilityLiveRegion={isTurn ? "polite" : "none"}
    >
      <View style={[s.disc, compact && s.discSmall, isTurn && s.turn]}>
        <Text style={s.initial}>{name.slice(0, 1).toUpperCase()}</Text>
        {dealer && <View style={s.dealer}><Text style={s.dealerText}>D</Text></View>}
      </View>
      <Text style={s.name} numberOfLines={1}>{name}</Text>
      <Text style={s.score}>{badge}</Text>
      {status && <Text style={s.status}>{status}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", minWidth: 72, gap: 2 },
  compact: { minWidth: 60 },
  out: { opacity: 0.55 },
  disc: { width: 48, height: 48, borderRadius: 24, backgroundColor: material.walnut, borderWidth: 2, borderColor: material.goldLeafDim, alignItems: "center", justifyContent: "center" },
  discSmall: { width: 40, height: 40, borderRadius: 20 },
  turn: { borderColor: onTable.gold, borderWidth: 3, shadowColor: onTable.gold, shadowOpacity: 0.7, shadowRadius: 10 },
  initial: { color: onTable.text, fontFamily: fonts.display.family, fontSize: 22, fontWeight: "600" },
  dealer: { position: "absolute", right: -6, bottom: -4, backgroundColor: onTable.gold, borderRadius: 999, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  dealerText: { color: "#1B1D21", fontSize: 11, fontWeight: "700" },
  name: { color: onTable.text, fontFamily: fonts.ui.family, fontSize: 13, maxWidth: 96 },
  score: { color: onTable.gold, fontFamily: fonts.ui.family, fontSize: 14, fontVariant: ["tabular-nums"] },
  status: { color: onTable.warning, fontSize: 12 },
});
