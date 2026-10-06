/** Mockup `room`: create a private room, join one by code, or Quick Match. Everything here talks to the real API. */
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { Sheet } from "../../components/ui/Sheet";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { fonts, minTouchTarget } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { scriptText } from "../../i18n";
import { useProfile } from "../../store/profile";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { createRoom, joinRoom, leaveSession, quickMatch } from "../multiplayer/session";
import { copy, errorMessage } from "../multiplayer/copy";
import { CODE_LENGTH, isCompleteCode, normalizeCode, spellCode } from "../multiplayer/roomCode";
import { TableSetupChips, useTableSetup } from "./TableSetup";

type Mode = "join" | "create" | "quick";
const MODES: readonly Mode[] = ["join", "create", "quick"];
const CODE_EXAMPLE = "BK7Q2M";

export function RoomEntry({ game }: { game?: string }) {
  const { c, t: room, lang } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();
  const session = useOnlineSession();
  const t = copy.room;

  const ts = useTableSetup(game);
  const { entry, setup, preset, players, settings } = ts;
  const [mode, setMode] = useState<Mode>("join");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const displayName = profile.name || copy.defaultName;
  const error = session.phase === "idle" ? session.error : null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (busyRef.current) leaveSession();
    };
  }, []);

  async function run(action: () => Promise<boolean>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ok = await action();
    busyRef.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (ok) router.replace("/wait");
  }

  const join = () => { if (isCompleteCode(code)) void run(() => joinRoom({ name: displayName, code })); };
  const profileId = entry?.profile;
  const summary = setup && entry
    ? t.summary(entry.name, setup.presets.find((p) => p.id === preset)?.label ?? "", t.lengthValue(setup.lengths[ts.length]?.label ?? "", setup.lengthLabel), setup.players ? players : undefined)
    : "";

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Header title={t.title} />
        <View accessibilityRole="radiogroup" accessibilityLabel={t.modesLabel}
          style={[s.segments, { borderRadius: room.shape.radius, borderColor: c.borderControl, backgroundColor: c.surface }]}>
          {MODES.map((m) => {
            const on = m === mode;
            return (
              <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setMode(m)}
                style={[s.segment, { borderRadius: Math.max(0, room.shape.radius - 3), backgroundColor: on ? room.accent.color : "transparent" }]}>
                <Text numberOfLines={1} style={[s.segmentText, { color: on ? room.accent.on : c.text }, scriptText(lang)]}>{t.modes[m]}</Text>
              </Pressable>
            );
          })}
        </View>
        {error ? <StatusBanner tone="error" title={errorMessage(error)} /> : null}

        {mode === "join" ? (
          <>
            <View style={[s.field, { borderColor: c.borderControl, backgroundColor: c.surface, borderRadius: room.shape.radius }]}>
              <TextInput
                value={code} onChangeText={(v) => setCode(normalizeCode(v))} placeholder={CODE_EXAMPLE} placeholderTextColor={c.textMuted}
                autoCapitalize="characters" autoCorrect={false} autoComplete="off" maxLength={CODE_LENGTH} returnKeyType="go"
                accessibilityLabel={code ? t.codeSpoken(spellCode(code)) : t.codeLabel}
                style={[s.input, { color: room.accent.color, fontFamily: room.type.numerals }]}
                onSubmitEditing={join}
              />
            </View>
            <Caption center>{t.codeHint}</Caption>
            <GoldButton label={busy ? t.working : t.join} disabled={busy || !isCompleteCode(code)} onPress={join} />
          </>
        ) : !profileId || !setup ? (
          <Caption>{t.noGames}</Caption>
        ) : (
          <>
            <Caption>{mode === "create" ? t.lead : t.quickHint}</Caption>
            <GlassCard onPress={() => setEditing(true)} label={t.setupLabel(summary)} style={s.summary}>
              <Text numberOfLines={1} style={[s.summaryText, { color: c.text }, scriptText(lang)]}>{summary}</Text>
              <Text style={[s.change, { color: room.accent.color }, scriptText(lang)]}>{t.change}</Text>
            </GlassCard>
            {mode === "create" ? (
              <GoldButton label={busy ? t.working : t.create} disabled={busy} onPress={() => void run(() => createRoom({ name: displayName, profileId, preset, settings }))} />
            ) : (
              <GoldButton label={busy ? t.working : t.quick} disabled={busy} onPress={() => void run(() => quickMatch({ name: displayName, profileId, seats: players }))} />
            )}
          </>
        )}
        {session.phase !== "idle" && !busy ? <GoldButton kind="glass" label={copy.lobby.leave} onPress={leaveSession} /> : null}
        <Sheet visible={editing} title={t.setupTitle} onClose={() => setEditing(false)} actions={<GoldButton label={t.done} onPress={() => setEditing(false)} />}>
          <View style={s.sheetBody}><TableSetupChips ts={ts} /></View>
        </Sheet>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  segments: { flexDirection: "row", borderWidth: 1, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: minTouchTarget, alignItems: "center", justifyContent: "center" },
  segmentText: { fontFamily: fonts.ui.semibold, fontSize: 15 },
  field: { borderWidth: 1, minHeight: 56, justifyContent: "center" },
  input: { textAlign: "center", writingDirection: "ltr", letterSpacing: 8, fontSize: 22, minHeight: 56, paddingHorizontal: 12 },
  summary: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: minTouchTarget, paddingVertical: 10 },
  summaryText: { flex: 1, fontFamily: fonts.ui.medium, fontSize: 15 },
  change: { fontFamily: fonts.ui.semibold, fontSize: 14 },
  sheetBody: { gap: 12 },
});
