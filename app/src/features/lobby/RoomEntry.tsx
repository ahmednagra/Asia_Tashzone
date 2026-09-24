/** Mockup `room`: create a private room, join one by code, or Quick Match. Everything here talks to the real API. */
import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { GoldButton } from "../../components/ui/GoldButton";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { useParentGate } from "../../hooks/useParentGate";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { createRoom, joinRoom, leaveSession, quickMatch } from "../multiplayer/session";
import { copy, errorMessage } from "../multiplayer/copy";
import { isCompleteCode, normalizeCode, spellCode } from "../multiplayer/roomCode";
import { ParentLocked } from "../multiplayer/WifiNotice";
import { TableSetupChips, useTableSetup } from "./TableSetup";

export function RoomEntry({ game }: { game?: string }) {
  const { c, t: room } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();
  const { allowed } = useParentGate("online");
  const session = useOnlineSession();
  const t = copy.room;

  const ts = useTableSetup(game);
  const { entry, setup, preset, players, settings } = ts;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const displayName = profile.name || "Player";
  const error = session.phase === "idle" ? session.error : null;

  async function run(action: () => Promise<boolean>) {
    if (busy) return;
    setBusy(true);
    const ok = await action();
    setBusy(false);
    if (ok) router.replace("/wait");
  }

  if (!allowed) {
    return <Screen><Header title={t.title} /><ParentLocked kind="online" /></Screen>;
  }
  if (!entry?.profile || !setup) {
    return <Screen><Header title={t.title} /><Caption>{t.noGames}</Caption></Screen>;
  }
  const profileId = entry.profile;

  return (
    <Screen>
      <Header title={t.title} />
      <Caption>{t.lead}</Caption>
      {error ? <StatusBanner tone="error" title={errorMessage(error)} /> : null}
      <TableSetupChips ts={ts} />
      <GoldButton label={busy ? t.working : t.create} disabled={busy} onPress={() => run(() => createRoom({ name: displayName, profileId, preset, settings }))} />
      <GoldButton kind="glass" label={t.quick} disabled={busy} onPress={() => run(() => quickMatch({ name: displayName, profileId, seats: players }))} />
      <Caption>{t.quickHint}</Caption>

      <SectionLabel>{t.or}</SectionLabel>
      <View style={[s.field, { borderColor: c.borderControl, backgroundColor: c.surface, borderRadius: room.shape.radius }]}>
        <TextInput
          value={code} onChangeText={(v) => setCode(normalizeCode(v))} placeholder={t.codePlaceholder} placeholderTextColor={c.textMuted}
          autoCapitalize="characters" autoCorrect={false} maxLength={12} returnKeyType="go"
          accessibilityLabel={code ? `${t.codeLabel}: ${spellCode(code)}` : t.codeLabel}
          style={[s.input, { color: room.accent.color }]}
          onSubmitEditing={() => isCompleteCode(code) && run(() => joinRoom({ name: displayName, code }))}
        />
      </View>
      <Caption center>{t.codeHint}</Caption>
      <GoldButton kind="glass" label={t.join} disabled={busy || !isCompleteCode(code)} onPress={() => run(() => joinRoom({ name: displayName, code }))} />
      {session.phase !== "idle" ? <GoldButton kind="glass" label={copy.lobby.leave} onPress={leaveSession} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  field: { borderWidth: 1, borderRadius: 14, minHeight: 56, justifyContent: "center" },
  input: { textAlign: "center", letterSpacing: 8, fontSize: 22, fontFamily: fonts.display.family, minHeight: 56, paddingHorizontal: 12 },
});
