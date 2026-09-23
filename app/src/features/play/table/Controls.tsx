import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GoldButton } from "../../../components/ui/GoldButton";
import { ActionPill } from "./chrome";
import { cards, fonts, material, minTouchTarget, onTable, radius } from "../../../theme/tokens";


/** Call picker sheet (Callbreak 1–13 / Call Bridge 2–12). */
export function CallPicker({ min, max, suggestion, onCall }: { min: number; max: number; suggestion?: number; onCall: (n: number) => void }) {
  const nums: number[] = [];
  for (let n = min; n <= max; n++) nums.push(n);
  return (
    <View style={s.sheet} accessibilityLabel="Choose your call">
      <Text style={s.sheetTitle}>Your call</Text>
      <ScrollView horizontal contentContainerStyle={s.row} showsHorizontalScrollIndicator={false}>
        {nums.map((n) => (
          <Pressable key={n} onPress={() => onCall(n)} accessibilityRole="button" accessibilityLabel={`Call ${n}${n === suggestion ? ", suggested" : ""}`}
            style={[s.num, n === suggestion && s.suggested]}>
            <Text style={s.numText}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** W-CB-1 strip: identical for everybody; only eligible seats see the request button. */
export function RedealStrip({ canRequest, requested, onRequest }: { canRequest: boolean; requested: boolean; onRequest: () => void }) {
  return (
    <View style={s.strip} accessibilityLiveRegion="polite">
      <Text style={s.stripText}>{requested ? "Redeal requested. Waiting for the window to close…" : "Redeal window open"}</Text>
      {canRequest && <Pressable onPress={onRequest} style={s.stripBtn} accessibilityRole="button"><Text style={s.stripBtnText}>Request redeal</Text></Pressable>}
    </View>
  );
}

/** Court Piece: the caller sees 5 cards and names trump. */
const SUITS = [{ id: "S", glyph: "♠", name: "Spades", red: false }, { id: "H", glyph: "♥", name: "Hearts", red: true }, { id: "D", glyph: "♦", name: "Diamonds", red: true }, { id: "C", glyph: "♣", name: "Clubs", red: false }] as const;
export function TrumpPicker({ suggestion, onChoose }: { suggestion?: string; onChoose: (suit: "S" | "H" | "D" | "C") => void }) {
  return (
    <View style={s.sheet} accessibilityLabel="Choose trump">
      <Text style={s.sheetTitle}>Choose trump</Text>
      <View style={s.row}>
        {SUITS.map((x) => (
          <Pressable key={x.id} onPress={() => onChoose(x.id)} accessibilityRole="button" accessibilityLabel={`${x.name}${x.id === suggestion ? ", suggested" : ""}`}
            style={[s.suit, x.id === suggestion && s.suggested]}>
            <Text style={[s.suitText, x.red && s.red]}>{x.glyph}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Bhabhi house rule L33: before a trick, take the next player's cards (they get away). */
export function TakeButton({ onTake }: { onTake: () => void }) {
  return (
    <View style={s.strip}>
      <Text style={s.stripText}>You may take the next player's cards. They get away.</Text>
      <Pressable onPress={onTake} style={s.stripBtn} accessibilityRole="button" accessibilityLabel="Take the next player's cards">
        <Text style={s.stripBtnText}>Take cards</Text>
      </Pressable>
    </View>
  );
}

/** Between hands (the table holds the next deal): what just ended and the ways on. Offline only. */
export function HandOverStrip({ title, primaryLabel, onPrimary, secondaryLabel, onSecondary }: {
  title: string; primaryLabel: string; onPrimary: () => void; secondaryLabel: string; onSecondary: () => void;
}) {
  return (
    <View style={s.strip} accessibilityLiveRegion="polite">
      <Text style={s.stripText}>{title}</Text>
      <View style={s.stripBtns}>
        <ActionPill label={secondaryLabel} onPress={onSecondary} />
        <GoldButton label={primaryLabel} onPress={onPrimary} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  stripBtns: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
  suit: { width: 64, height: 64, borderRadius: radius.control, borderWidth: 1.5, borderColor: onTable.gold, alignItems: "center", justifyContent: "center", backgroundColor: cards.face },
  suitText: { fontSize: 34, color: cards.black },
  red: { color: cards.red },
  sheet: { backgroundColor: material.feltDeep, borderWidth: 1, borderColor: material.line, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: 16, gap: 10 },
  sheetTitle: { color: onTable.text, fontFamily: fonts.display.family, fontSize: 20, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 },
  num: { width: 48, height: 48, borderRadius: radius.control, borderWidth: 1.5, borderColor: onTable.gold, alignItems: "center", justifyContent: "center" },
  suggested: { backgroundColor: material.glass, borderWidth: 3 },
  numText: { color: onTable.text, fontSize: 20, fontVariant: ["tabular-nums"], fontWeight: "600" },
  strip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: radius.control, backgroundColor: material.feltRim, borderWidth: 1, borderColor: material.line },
  stripText: { color: onTable.secondary, fontSize: 15, flexShrink: 1 },
  stripBtn: { minHeight: minTouchTarget, justifyContent: "center", paddingHorizontal: 14, borderRadius: radius.control, borderWidth: 1.5, borderColor: onTable.gold },
  stripBtnText: { color: onTable.gold, fontWeight: "600" },
});
