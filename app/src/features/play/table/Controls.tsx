import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GoldButton } from "../../../components/ui/GoldButton";
import { ActionPill } from "./chrome";
import { cards, fonts, material, minTouchTarget, onTable, radius } from "../../../theme/tokens";

export function CallPicker({ min, max, suggestion, onCall }: { min: number; max: number; suggestion?: number; onCall: (n: number) => void }) {
  const nums: number[] = [];
  for (let n = min; n <= max; n++) nums.push(n);
  return (
    <View style={s.floatingTray} accessibilityLabel="Choose your call">
      <View style={s.trayHeader}>
        <Text style={s.trayTitle}>Make Your Call (Tricks)</Text>
        {suggestion !== undefined && (
          <View style={s.suggestedTag}>
            <Text style={s.suggestedTagText}>Suggested: {suggestion}</Text>
          </View>
        )}
      </View>
      <ScrollView horizontal contentContainerStyle={s.numRow} showsHorizontalScrollIndicator={false}>
        {nums.map((n) => (
          <Pressable
            key={n}
            onPress={() => onCall(n)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${n}${n === suggestion ? ", suggested" : ""}`}
            style={[s.numBtn, n === suggestion && s.numBtnSuggested]}
          >
            <Text style={[s.numText, n === suggestion && s.numTextSuggested]}>{n}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function RedealStrip({ canRequest, requested, onRequest }: { canRequest: boolean; requested: boolean; onRequest: () => void }) {
  return (
    <View style={s.strip} accessibilityLiveRegion="polite">
      <Text style={s.stripText}>{requested ? "Redeal requested. Waiting for the window to close…" : "Redeal window open"}</Text>
      {canRequest && (
        <Pressable onPress={onRequest} style={s.stripBtn} accessibilityRole="button">
          <Text style={s.stripBtnText}>Request redeal</Text>
        </Pressable>
      )}
    </View>
  );
}

const SUITS = [
  { id: "S", glyph: "♠", name: "Spades", red: false },
  { id: "H", glyph: "♥", name: "Hearts", red: true },
  { id: "D", glyph: "♦", name: "Diamonds", red: true },
  { id: "C", glyph: "♣", name: "Clubs", red: false },
] as const;

export function TrumpPicker({ suggestion, onChoose }: { suggestion?: string; onChoose: (suit: "S" | "H" | "D" | "C") => void }) {
  return (
    <View style={s.floatingTray} accessibilityLabel="Choose trump">
      <View style={s.trayHeader}>
        <Text style={s.trayTitle}>Choose Trump Suit</Text>
        {suggestion && (
          <View style={s.suggestedTag}>
            <Text style={s.suggestedTagText}>Suggested: {SUITS.find((s) => s.id === suggestion)?.name ?? suggestion}</Text>
          </View>
        )}
      </View>
      <View style={s.suitRow}>
        {SUITS.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => onChoose(x.id)}
            accessibilityRole="button"
            accessibilityLabel={`${x.name}${x.id === suggestion ? ", suggested" : ""}`}
            style={[s.suitBtn, x.id === suggestion && s.suitBtnSuggested]}
          >
            <Text style={[s.suitText, x.red && s.red]}>{x.glyph}</Text>
            <Text style={[s.suitName, x.id === suggestion && s.suitNameSuggested]}>{x.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

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

export function HandOverStrip({
  title,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
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
  floatingTray: {
    backgroundColor: "rgba(13, 25, 21, 0.94)",
    borderWidth: 1.5,
    borderColor: onTable.gold,
    borderRadius: radius.card,
    padding: 10,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
  },
  trayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  trayTitle: {
    color: onTable.gold,
    fontFamily: fonts.display.family,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  suggestedTag: {
    backgroundColor: "rgba(227, 189, 110, 0.15)",
    borderWidth: 1,
    borderColor: onTable.gold,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  suggestedTagText: {
    color: onTable.gold,
    fontSize: 11,
    fontWeight: "600",
  },
  numRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  numBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: material.line,
    backgroundColor: material.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  numBtnSuggested: {
    borderColor: onTable.gold,
    backgroundColor: "rgba(227, 189, 110, 0.25)",
    transform: [{ scale: 1.05 }],
  },
  numText: {
    color: onTable.text,
    fontSize: 17,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  numTextSuggested: {
    color: onTable.gold,
  },
  suitRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-around",
    paddingVertical: 4,
  },
  suitBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: material.line,
    backgroundColor: material.glass,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 2,
  },
  suitBtnSuggested: {
    borderColor: onTable.gold,
    backgroundColor: "rgba(227, 189, 110, 0.2)",
    transform: [{ scale: 1.04 }],
  },
  suitText: {
    fontSize: 26,
    color: cards.black,
  },
  suitName: {
    fontSize: 10.5,
    color: onTable.secondary,
    fontWeight: "600",
  },
  suitNameSuggested: {
    color: onTable.gold,
  },
  red: {
    color: cards.red,
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.control,
    backgroundColor: "rgba(13, 25, 21, 0.9)",
    borderWidth: 1,
    borderColor: material.line,
  },
  stripText: {
    color: onTable.secondary,
    fontSize: 13,
    flexShrink: 1,
  },
  stripBtn: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: onTable.gold,
  },
  stripBtnText: {
    color: onTable.gold,
    fontWeight: "600",
    fontSize: 12.5,
  },
  stripBtns: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
});
