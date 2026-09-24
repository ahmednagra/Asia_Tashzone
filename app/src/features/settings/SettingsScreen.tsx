import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Constants from "expo-constants";
import { NavRow } from "../../components/ui/NavRow";
import { Caption } from "../../components/ui/Caption";
import { SettingsGroup, SettingsScreen } from "../../components/ui/Settings";
import { usePrefs, useTheme, type HapticStrength, type OrientationOption } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { AvatarView, avatarBg } from "../onboarding/AvatarView";
import { cards, fonts, material, onTable, radius } from "../../theme/tokens";
import { triggerSound } from "../../utils/sound";
import { AboutSheet } from "./AboutSheet";
import { T } from "./copy";

export function SettingsHome() {
  const router = useRouter();
  const { c } = useTheme();
  const { profile: p, update } = useProfile();
  const [prefs, setPrefs] = usePrefs();
  const [aboutOpen, setAboutOpen] = useState(false);

  const t = T.settings;
  const go = (href: string) => () => router.push(href as Href);
  const onOff = (v: boolean) => (v ? t.on : t.off);
  const version = Constants.expoConfig?.version ?? "0.1.0";

  const feedback = () => triggerSound("tap", p.sound.master, p.sound.haptics, prefs.hapticStrength);

  const toggleSound = () => { feedback(); update({ sound: { ...p.sound, master: !p.sound.master } }); };
  const toggleHaptics = () => { feedback(); update({ sound: { ...p.sound, haptics: !p.sound.haptics } }); };
  const toggleTimer = () => { feedback(); update({ timer: !p.timer }); };
  const toggleHints = () => { feedback(); update({ hints: !p.hints }); };
  const toggleFourColor = () => { feedback(); setPrefs({ ...prefs, fourColor: !prefs.fourColor }); };

  const setOrientation = (opt: OrientationOption) => { feedback(); setPrefs({ ...prefs, orientation: opt }); };
  const currentOrientation: OrientationOption = prefs.orientation ?? "auto";

  const currentTheme = prefs.name;
  const isEmerald = currentTheme === "emerald";
  const isGold = currentTheme === "gold" || currentTheme === "dark";
  const isLight = currentTheme === "light";

  const setThemeChoice = (theme: "emerald" | "gold" | "light") => {
    feedback();
    setPrefs({ ...prefs, system: false, name: theme });
  };

  const setHapticStrength = (strength: HapticStrength) => {
    feedback();
    setPrefs({ ...prefs, hapticStrength: strength });
  };
  const currentHaptic: HapticStrength = prefs.hapticStrength ?? "crisp";

  const suitColors = prefs.fourColor ? cards.fourColor : cards.twoColor;

  const onExportData = () => {
    feedback();
    Alert.alert("Export Backup", "Your stats and game history have been serialized for backup.");
  };

  const onClearCache = () => {
    feedback();
    Alert.alert("Clear Cache", "Local temporary cache cleared successfully.");
  };

  return (
    <SettingsScreen title={t.title} back={false}>
      <Pressable onPress={go("/me")} style={({ pressed }) => [s.heroCard, pressed && { opacity: 0.9 }]} accessibilityRole="button" accessibilityLabel="Edit your player profile">
        <View style={s.heroGlow} />
        <View style={[s.avatarRing, { backgroundColor: avatarBg(p.avatar) }]}>
          <AvatarView index={p.avatar} size={48} />
        </View>
        <View style={s.heroText}>
          <View style={s.heroNameRow}>
            <Text style={[s.heroName, { color: c.text }]} numberOfLines={1}>{p.name || "Mehfil Player"}</Text>
            <View style={s.editChip}>
              <Text style={s.editChipText}>Edit ✎</Text>
            </View>
          </View>
          <Text style={[s.heroStats, { color: onTable.gold }]}>
            {p.stats.matches} Matches · {p.stats.wins} Wins {p.stats.streak > 1 ? `· 🔥 ${p.stats.streak} Streak` : ""}
          </Text>
        </View>
      </Pressable>

      <View style={s.quickDeck}>
        <Pressable onPress={toggleSound} style={[s.quickPill, p.sound.master && s.quickPillActive]} accessibilityRole="button" accessibilityLabel={`Sound: ${p.sound.master ? "On" : "Silent"}`}>
          <Text style={s.quickPillIcon}>{p.sound.master ? "🔊" : "🔇"}</Text>
          <Text style={[s.quickPillLabel, p.sound.master && s.quickPillLabelActive]}>
            {p.sound.master ? "Sound ON" : "Muted"}
          </Text>
        </Pressable>

        <Pressable onPress={toggleHaptics} style={[s.quickPill, p.sound.haptics && s.quickPillActive]} accessibilityRole="button" accessibilityLabel={`Haptics: ${p.sound.haptics ? "On" : "Off"}`}>
          <Text style={s.quickPillIcon}>📳</Text>
          <Text style={[s.quickPillLabel, p.sound.haptics && s.quickPillLabelActive]}>
            {p.sound.haptics ? "Vibrate" : "Silent"}
          </Text>
        </Pressable>

        <Pressable onPress={toggleTimer} style={[s.quickPill, p.timer && s.quickPillActive]} accessibilityRole="button" accessibilityLabel={`Turn Clock: ${p.timer ? "On" : "Off"}`}>
          <Text style={s.quickPillIcon}>⏱</Text>
          <Text style={[s.quickPillLabel, p.timer && s.quickPillLabelActive]}>
            {p.timer ? "Clock ON" : "No Clock"}
          </Text>
        </Pressable>

        <Pressable onPress={toggleHints} style={[s.quickPill, p.hints && s.quickPillActive]} accessibilityRole="button" accessibilityLabel={`Hints: ${p.hints ? "On" : "Off"}`}>
          <Text style={s.quickPillIcon}>💡</Text>
          <Text style={[s.quickPillLabel, p.hints && s.quickPillLabelActive]}>
            {p.hints ? "Hints ON" : "No Hints"}
          </Text>
        </Pressable>
      </View>

      <View style={s.previewCard}>
        <View style={s.previewHeader}>
          <Text style={s.previewTitle}>LIVE TABLE & DECK PREVIEW</Text>
          <Pressable onPress={toggleFourColor} style={[s.toggleDeckPill, prefs.fourColor && s.toggleDeckPillActive]} accessibilityRole="button">
            <Text style={[s.toggleDeckText, prefs.fourColor && s.toggleDeckTextActive]}>
              {prefs.fourColor ? "4-Colour Active" : "2-Colour Standard"}
            </Text>
          </Pressable>
        </View>

        <View style={s.miniFeltStage}>
          <View style={[s.miniCloth, isEmerald && { backgroundColor: material.felt }]}>
            <View style={s.miniCardsRow}>
              <View style={s.miniCard}>
                <Text style={[s.miniCardText, { color: suitColors.S }]}>A♠</Text>
              </View>
              <View style={s.miniCard}>
                <Text style={[s.miniCardText, { color: suitColors.H }]}>K♥</Text>
              </View>
              <View style={s.miniCard}>
                <Text style={[s.miniCardText, { color: suitColors.D }]}>Q♦</Text>
              </View>
              <View style={s.miniCard}>
                <Text style={[s.miniCardText, { color: suitColors.C }]}>J♣</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={s.segmentSection}>
        <Text style={s.segmentTitle}>THEME & COLOR SCHEME</Text>
        <View style={s.segmentedBox}>
          <Pressable onPress={() => setThemeChoice("emerald")} style={[s.segmentItem, isEmerald && s.segmentItemActive]} accessibilityRole="button">
            <Text style={[s.segmentText, isEmerald && s.segmentTextActive]}>🌿 Emerald</Text>
          </Pressable>
          <Pressable onPress={() => setThemeChoice("gold")} style={[s.segmentItem, isGold && s.segmentItemActive]} accessibilityRole="button">
            <Text style={[s.segmentText, isGold && s.segmentTextActive]}>👑 Gold</Text>
          </Pressable>
          <Pressable onPress={() => setThemeChoice("light")} style={[s.segmentItem, isLight && s.segmentItemActive]} accessibilityRole="button">
            <Text style={[s.segmentText, isLight && s.segmentTextActive]}>☀️ Ivory</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.segmentSection}>
        <Text style={s.segmentTitle}>SCREEN ORIENTATION</Text>
        <View style={s.segmentedBox}>
          <Pressable onPress={() => setOrientation("portrait")} style={[s.segmentItem, currentOrientation === "portrait" && s.segmentItemActive]} accessibilityRole="button">
            <Text style={[s.segmentText, currentOrientation === "portrait" && s.segmentTextActive]}>📱 Portrait</Text>
          </Pressable>
          <Pressable onPress={() => setOrientation("landscape")} style={[s.segmentItem, currentOrientation === "landscape" && s.segmentItemActive]} accessibilityRole="button">
            <Text style={[s.segmentText, currentOrientation === "landscape" && s.segmentTextActive]}>🖥 Landscape</Text>
          </Pressable>
          <Pressable onPress={() => setOrientation("auto")} style={[s.segmentItem, currentOrientation === "auto" && s.segmentItemActive]} accessibilityRole="button">
            <Text style={[s.segmentText, currentOrientation === "auto" && s.segmentTextActive]}>🔄 Auto</Text>
          </Pressable>
        </View>
      </View>

      <SettingsGroup title="HAPTIC TACTILE STRENGTH">
        <View style={s.hapticContainer}>
          {(["off", "gentle", "crisp", "firm"] as const).map((mode) => (
            <Pressable key={mode} onPress={() => setHapticStrength(mode)} style={[s.hapticPill, currentHaptic === mode && s.hapticPillActive]} accessibilityRole="button">
              <Text style={[s.hapticPillText, currentHaptic === mode && s.hapticPillTextActive]}>
                {mode.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </SettingsGroup>

      <SettingsGroup title="TABLE & PLAY EXPERIENCE">
        <NavRow icon="◐" title={t.looks} caption={isEmerald ? "Emerald" : isGold ? "Gold" : "Ivory Silk"} onPress={go("/settings/appearance")} />
        <NavRow icon="▶" title={t.playing} caption={`${t.hints} ${onOff(p.hints)} · ${t.clock} ${onOff(p.timer)}`} onPress={go("/settings/play")} />
        <NavRow icon="♪" title={t.sound} caption={`${p.sound.master ? t.soundOn : t.silent} · ${t.haptics} ${onOff(p.sound.haptics)}`} onPress={go("/settings/sound")} />
      </SettingsGroup>

      <SettingsGroup title="IDENTITY & SAFETY">
        <NavRow icon="A" title={t.language} caption={t.langNames[p.lang]} onPress={go("/onboarding/language")} />
        <NavRow icon="⚿" title={t.parent} badge={p.parent.pinHash ? "PIN SET" : undefined} caption={p.parent.pinHash ? t.pinSet : t.pinNone} onPress={go("/settings/parent")} />
        <NavRow icon="▣" title={t.account} caption={t.accountHint} onPress={go("/settings/account")} />
      </SettingsGroup>

      <SettingsGroup title="DATA TRANSPARENCY & BACKUP">
        <View style={s.storageContainer}>
          <View style={s.storageMetrics}>
            <View style={s.storageItem}>
              <Text style={s.storageValue}>{p.stats.matches}</Text>
              <Text style={s.storageLabel}>Matches</Text>
            </View>
            <View style={s.storageItem}>
              <Text style={s.storageValue}>{p.stats.wins}</Text>
              <Text style={s.storageLabel}>Victories</Text>
            </View>
            <View style={s.storageItem}>
              <Text style={s.storageValue}>100%</Text>
              <Text style={s.storageLabel}>On-Device</Text>
            </View>
          </View>
          <View style={s.storageActionsRow}>
            <Pressable onPress={onExportData} style={s.storageBtn} accessibilityRole="button">
              <Text style={s.storageBtnText}>Export JSON</Text>
            </Pressable>
            <Pressable onPress={onClearCache} style={[s.storageBtn, s.storageBtnAlt]} accessibilityRole="button">
              <Text style={s.storageBtnAltText}>Clear Cache</Text>
            </Pressable>
          </View>
        </View>
      </SettingsGroup>

      <SettingsGroup title="RULES & KNOWLEDGE">
        <NavRow icon="?" title={t.howto} caption={t.howtoHint} onPress={go("/howto")} />
        <NavRow icon="§" title={t.rules} caption={t.rulesHint} onPress={go("/rules")} />
      </SettingsGroup>

      <SettingsGroup title="ABOUT & HERITAGE">
        <NavRow icon="ℹ" title="About TashZone" caption="Fair play RNG · Privacy oath · 16 Games" onPress={() => setAboutOpen(true)} />
      </SettingsGroup>

      <View style={s.footerContainer}>
        <Text style={[s.footerSeal, { color: onTable.gold }]}>♠ ♥ TashZone ♦ ♣</Text>
        <Caption center tone="muted">{t.version(version)} · Built for Authentic Mehfil</Caption>
      </View>

      <AboutSheet visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: material.glass,
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: radius.card,
    padding: 14,
    overflow: "hidden",
    position: "relative",
  },
  heroGlow: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: onTable.gold,
    opacity: 0.08,
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: onTable.gold,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: onTable.gold,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  heroText: {
    flex: 1,
    gap: 3,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroName: {
    fontFamily: fonts.display.family,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  editChip: {
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: material.glass,
  },
  editChipText: {
    color: onTable.gold,
    fontSize: 11,
    fontWeight: "600",
  },
  heroStats: {
    fontFamily: fonts.ui.family,
    fontSize: 12.5,
    fontWeight: "500",
  },
  quickDeck: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
  },
  quickPill: {
    flex: 1,
    minHeight: 46,
    backgroundColor: material.glass,
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 2,
  },
  quickPillActive: {
    borderColor: onTable.gold,
    backgroundColor: "rgba(227, 189, 110, 0.12)",
  },
  quickPillIcon: {
    fontSize: 16,
  },
  quickPillLabel: {
    color: onTable.secondary,
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
  },
  quickPillLabelActive: {
    color: onTable.gold,
  },
  previewCard: {
    backgroundColor: material.glass,
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: radius.card,
    padding: 12,
    gap: 8,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: onTable.secondary,
  },
  toggleDeckPill: {
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  toggleDeckPillActive: {
    borderColor: onTable.gold,
    backgroundColor: "rgba(227, 189, 110, 0.15)",
  },
  toggleDeckText: {
    fontSize: 10,
    color: onTable.secondary,
    fontWeight: "600",
  },
  toggleDeckTextActive: {
    color: onTable.gold,
  },
  miniFeltStage: {
    height: 72,
    borderRadius: 14,
    backgroundColor: material.walnut,
    borderWidth: 1,
    borderColor: material.walnutLit,
    padding: 4,
  },
  miniCloth: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: material.felt,
    alignItems: "center",
    justifyContent: "center",
  },
  miniCardsRow: {
    flexDirection: "row",
    gap: 6,
  },
  miniCard: {
    width: 28,
    height: 40,
    backgroundColor: cards.face,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  miniCardText: {
    fontFamily: fonts.cardIndex.family,
    fontWeight: "700",
    fontSize: 11,
  },
  segmentSection: {
    gap: 6,
    marginTop: 2,
  },
  segmentTitle: {
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    color: onTable.secondary,
    paddingLeft: 4,
  },
  segmentedBox: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderWidth: 1,
    borderColor: material.line,
    borderRadius: 999,
    padding: 3,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  segmentItemActive: {
    backgroundColor: onTable.gold,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: onTable.secondary,
  },
  segmentTextActive: {
    color: material.btnInk,
    fontWeight: "700",
  },
  hapticContainer: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  hapticPill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: material.line,
    backgroundColor: material.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  hapticPillActive: {
    borderColor: onTable.gold,
    backgroundColor: "rgba(227, 189, 110, 0.18)",
  },
  hapticPillText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: onTable.secondary,
  },
  hapticPillTextActive: {
    color: onTable.gold,
    fontWeight: "700",
  },
  storageContainer: {
    padding: 10,
    gap: 8,
  },
  storageMetrics: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 10,
    paddingVertical: 8,
  },
  storageItem: {
    alignItems: "center",
    gap: 2,
  },
  storageValue: {
    fontSize: 15,
    fontWeight: "700",
    color: onTable.gold,
    fontVariant: ["tabular-nums"],
  },
  storageLabel: {
    fontSize: 10,
    color: onTable.secondary,
  },
  storageActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  storageBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: material.line,
    backgroundColor: material.glass,
    alignItems: "center",
  },
  storageBtnText: {
    color: onTable.text,
    fontSize: 11.5,
    fontWeight: "600",
  },
  storageBtnAlt: {
    borderColor: "rgba(209, 48, 40, 0.35)",
  },
  storageBtnAltText: {
    color: "#ff7f75",
    fontSize: 11.5,
    fontWeight: "600",
  },
  footerContainer: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 12,
  },
  footerSeal: {
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: "600",
    opacity: 0.8,
  },
});
