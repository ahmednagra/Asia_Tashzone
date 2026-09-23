import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, material, onTable } from "../../../theme/tokens";
import { AvatarView, avatarBg } from "../../onboarding/AvatarView";

/**
 * A player's avatar on the rim (mockup `.ring` + `.mono`): the human wears the avatar chosen in the profile,
 * bots a dashed monogram (never a person). A gold ring marks whose turn it is.
 */
export function PlayerAvatar({ name, size, turn, bot, avatar }: { name: string; size: number; turn: boolean; bot: boolean; avatar?: number }) {
  const human = !bot && avatar !== undefined;
  return (
    <View style={[s.ring, turn && s.ringTurn, { borderRadius: (size + 8) / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.disc, { width: size, height: size, borderRadius: size / 2, backgroundColor: human ? avatarBg(avatar!) : material.walnut }, bot && s.bot]}>
        {human ? <AvatarView index={avatar!} size={Math.round(size * 0.68)} /> : <Text style={[s.initial, { fontSize: size * 0.46 }]}>{name.slice(0, 1).toUpperCase()}</Text>}
      </View>
    </View>
  );
}

/** One seat around the rim: avatar, name plate with a game-specific badge ("3/4", "Team A · 5", "9 cards"), shown voids. */
export function Seat({ name, isTurn, badge, spoken = "", control, dealer, online = true, out = false, compact = false, voids = [] }: {
  name: string; isTurn: boolean; badge: string; spoken?: string; control: "human" | "handover" | "bot"; dealer: boolean;
  online?: boolean; out?: boolean; compact?: boolean; voids?: readonly string[];
}) {
  const status = control === "bot" ? "Bot" : control === "handover" ? "Auto-playing" : online ? null : "Offline";
  return (
    <View
      style={[s.wrap, compact && s.compact, out && s.out]}
      accessible
      accessibilityLabel={`${name}${isTurn ? ", their turn" : ""}${spoken ? `, ${spoken}` : ""}${voids.length ? `, ${voids.join(", ")}` : ""}${status ? `, ${status}` : ""}`}
      accessibilityLiveRegion={isTurn ? "polite" : "none"}
    >
      <View>
        <PlayerAvatar name={name} size={compact ? 32 : 40} turn={isTurn} bot={control !== "human"} />
        {dealer && <View style={s.dealer}><Text style={s.dealerText}>D</Text></View>}
      </View>
      <View style={[s.plate, isTurn && s.plateTurn]}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <View style={[s.count, out && s.countSafe]}><Text style={[s.countText, out && s.countSafeText]}>{badge}</Text></View>
      </View>
      {voids.length > 0 && <Text style={s.voids}>{voids.join(" ")}</Text>}
      {status && <Text style={s.status}>{status.toUpperCase()}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", minWidth: 76, gap: 3 },
  compact: { minWidth: 62 },
  out: { opacity: 0.6 },
  ring: { padding: 3, borderWidth: 1.6, borderColor: "transparent" },
  ringTurn: { borderColor: onTable.gold, shadowColor: onTable.gold, shadowOpacity: 0.7, shadowRadius: 10, elevation: 6 },
  disc: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: material.goldLeafDim },
  bot: { borderStyle: "dashed", borderColor: material.goldLeafHot },
  initial: { color: material.goldLeafHot, fontFamily: fonts.display.family, fontWeight: "700" },
  dealer: { position: "absolute", right: -4, bottom: -2, backgroundColor: onTable.gold, borderRadius: 999, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  dealerText: { color: material.btnInk, fontSize: 10, fontWeight: "700" },
  plate: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: material.line, borderRadius: 999, paddingLeft: 9, paddingRight: 3, paddingVertical: 2, backgroundColor: material.feltRim },
  plateTurn: { borderColor: onTable.gold },
  name: { color: onTable.text, fontFamily: fonts.ui.family, fontSize: 12.5, maxWidth: 70 },
  count: { minWidth: 21, height: 21, borderRadius: 11, paddingHorizontal: 5, backgroundColor: material.glass, borderWidth: 1, borderColor: material.line, alignItems: "center", justifyContent: "center" },
  countText: { color: onTable.gold, fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  countSafe: { backgroundColor: onTable.success, borderColor: onTable.success },
  countSafeText: { color: material.btnInk },
  voids: { color: onTable.error, fontSize: 10, letterSpacing: 0.6 },
  status: { color: onTable.gold, fontSize: 9, letterSpacing: 1 },
});
