import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GoldButton } from "../../../components/ui/GoldButton";
import { ActionPill } from "./chrome";
import { cards, fonts, minTouchTarget, onTable, radius } from "../../../theme/tokens";
import { useTheme } from "../../../context/ThemeContext";
import { displayFace } from "../../../i18n";
import { suitName } from "./logic";
import { T } from "./copy";

function useTray() {
  const { t, lang } = useTheme();
  return {
    t,
    tray: { backgroundColor: t.sheet.bg, borderColor: t.accent.color, borderRadius: Math.max(radius.card, t.shape.sheet - 6), borderWidth: t.surface.kind === "slab" ? 2 : 1.5 },
    title: [{ color: t.accent.color, letterSpacing: t.type.tracking, textTransform: t.type.titleCase }, displayFace(t.type.display, 17, lang)],
    tag: { borderColor: t.accent.color, backgroundColor: t.accent.line },
  };
}

export function CallPicker({ min, max, suggestion, onCall }: { min: number; max: number; suggestion?: number; onCall: (n: number) => void }) {
  const { t, tray, title, tag } = useTray();
  const nums: number[] = [];
  for (let n = min; n <= max; n++) nums.push(n);
  return (
    <View style={[s.floatingTray, tray]} accessibilityLabel={T.controls.chooseCall}>
      <View style={s.trayHeader}>
        <Text style={[s.trayTitle, title]}>{T.controls.makeCall}</Text>
        {suggestion !== undefined && (
          <View style={[s.suggestedTag, tag]}>
            <Text style={[s.suggestedTagText, { color: t.accent.color }]}>{T.controls.suggested(String(suggestion))}</Text>
          </View>
        )}
      </View>
      <View style={s.numGrid}>
        {nums.map((n) => {
          const on = n === suggestion;
          return (
            <Pressable
              key={n}
              onPress={() => onCall(n)}
              accessibilityRole="button"
              accessibilityLabel={T.controls.callN(n, on)}
              style={({ pressed }) => [s.numBtn, { borderColor: on ? t.accent.color : t.c.borderControl, backgroundColor: on ? t.accent.color : t.surface.bg, borderRadius: t.shape.button === 999 ? minTouchTarget / 2 : t.shape.button }, pressed && { opacity: 0.8 }]}
            >
              <Text style={[s.numText, { color: on ? t.accent.on : t.value.bid }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function RedealStrip({ canRequest, requested, onRequest }: { canRequest: boolean; requested: boolean; onRequest: () => void }) {
  const { t } = useTheme();
  return (
    <View style={[s.strip, { backgroundColor: t.sheet.bg, borderColor: t.accent.line }]} accessibilityLiveRegion="polite">
      <Text style={s.stripText}>{requested ? T.controls.redealRequested : T.controls.redealOpen}</Text>
      {canRequest && (
        <Pressable onPress={onRequest} style={[s.stripBtn, { borderColor: t.accent.color }]} accessibilityRole="button">
          <Text style={[s.stripBtnText, { color: t.accent.color }]}>{T.controls.requestRedeal}</Text>
        </Pressable>
      )}
    </View>
  );
}

const SUITS = [
  { id: "S", glyph: "♠" },
  { id: "H", glyph: "♥" },
  { id: "D", glyph: "♦" },
  { id: "C", glyph: "♣" },
] as const;

export function TrumpPicker({ suggestion, onChoose }: { suggestion?: string; onChoose: (suit: "S" | "H" | "D" | "C") => void }) {
  const { t, tray, title, tag } = useTray();
  const { fourColor } = useTheme();
  const ink = fourColor ? cards.fourColor : cards.twoColor;
  return (
    <View style={[s.floatingTray, tray]} accessibilityLabel={T.controls.chooseTrump}>
      <View style={s.trayHeader}>
        <Text style={[s.trayTitle, title]}>{T.controls.chooseTrump}</Text>
        {suggestion && (
          <View style={[s.suggestedTag, tag]}>
            <Text style={[s.suggestedTagText, { color: t.accent.color }]}>{T.controls.suggested(suitName(suggestion))}</Text>
          </View>
        )}
      </View>
      <View style={s.suitRow}>
        {SUITS.map((x) => {
          const on = x.id === suggestion;
          return (
            <Pressable
              key={x.id}
              onPress={() => onChoose(x.id)}
              accessibilityRole="button"
              accessibilityLabel={T.controls.suitSuggested(`${x.glyph} ${suitName(x.id)}`, on)}
              style={({ pressed }) => [s.suitBtn, { borderColor: on ? t.accent.color : t.c.borderControl, backgroundColor: t.surface.bg, borderWidth: on ? 2 : 1.5 }, pressed && { opacity: 0.8 }]}
            >
              <View style={s.suitChip}>
                <Text style={[s.suitText, { color: ink[x.id] }]}>{x.glyph}</Text>
              </View>
              <Text style={[s.suitName, { color: on ? t.accent.color : onTable.secondary }]} numberOfLines={1} adjustsFontSizeToFit>{suitName(x.id)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function TakeButton({ onTake }: { onTake: () => void }) {
  const { t } = useTheme();
  return (
    <View style={[s.strip, { backgroundColor: t.sheet.bg, borderColor: t.accent.line }]}>
      <Text style={s.stripText}>{T.controls.takeLine}</Text>
      <Pressable onPress={onTake} style={[s.stripBtn, { borderColor: t.accent.color }]} accessibilityRole="button" accessibilityLabel={T.controls.takeSpoken}>
        <Text style={[s.stripBtnText, { color: t.accent.color }]}>{T.controls.takeCards}</Text>
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
  const { t } = useTheme();
  return (
    <View style={[s.strip, { backgroundColor: t.sheet.bg, borderColor: t.accent.line }]} accessibilityLiveRegion="polite">
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
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 4,
  },
  trayTitle: {
    fontSize: 17,
    flexShrink: 1,
  },
  suggestedTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  suggestedTagText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
  },
  numGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 2,
  },
  numBtn: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: {
    fontFamily: fonts.ui.bold,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  suitRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-around",
    paddingVertical: 2,
  },
  suitBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 3,
  },
  suitChip: {
    width: 36,
    height: 36,
    borderRadius: radius.card,
    backgroundColor: cards.face,
    alignItems: "center",
    justifyContent: "center",
  },
  suitText: {
    fontSize: 24,
    lineHeight: 30,
  },
  suitName: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  stripText: {
    color: onTable.secondary,
    fontFamily: fonts.ui.family,
    fontSize: 13,
    flexShrink: 1,
  },
  stripBtn: {
    minHeight: minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.control,
    borderWidth: 1.5,
  },
  stripBtnText: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
  },
  stripBtns: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
});
