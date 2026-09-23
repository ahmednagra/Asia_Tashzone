/** Mockup `room`: create a private room, join one by code, or Quick Match. Everything here talks to the real API. */
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { ChipGroup } from "../../components/ui/ChipGroup";
import { GoldButton } from "../../components/ui/GoldButton";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { GAMES, SETUP } from "../../constants/games";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { useParentGate } from "../../hooks/useParentGate";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { createRoom, joinRoom, leaveSession, quickMatch } from "../multiplayer/session";
import { copy, errorMessage } from "../multiplayer/copy";
import { isCompleteCode, normalizeCode, spellCode } from "../multiplayer/roomCode";
import { ParentLocked } from "../multiplayer/WifiNotice";

const ONLINE_GAMES = GAMES.filter((g) => g.profile && g.status === "play");

export function RoomEntry({ game }: { game?: string }) {
  const { c, name: theme } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();
  const { allowed } = useParentGate("online");
  const session = useOnlineSession();
  const t = copy.room;

  const [gameId, setGameId] = useState(ONLINE_GAMES.find((g) => g.id === game)?.id ?? ONLINE_GAMES[0]?.id ?? "");
  const entry = ONLINE_GAMES.find((g) => g.id === gameId);
  const setup = entry?.profile ? SETUP[entry.profile] : undefined;
  const [preset, setPreset] = useState<string>("");
  const [length, setLength] = useState(0);
  const [players, setPlayers] = useState(4);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!setup) return;
    setPreset(setup.presets[0]?.id ?? "standard");
    setLength(setup.defaultLength);
    setPlayers(setup.players?.includes(4) ? 4 : setup.players?.[0] ?? 4);
  }, [setup]);

  const settings = useMemo(() => ({ ...(setup?.lengths[length]?.settings ?? {}), ...(setup?.players ? { players } : {}) }), [setup, length, players]);
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
  const hint = setup.presets.find((p) => p.id === preset)?.hint;

  return (
    <Screen>
      <Header title={t.title} />
      <Caption>{t.lead}</Caption>
      {error ? <StatusBanner tone="error" title={errorMessage(error)} /> : null}
      <ChipGroup label={t.game} value={gameId} onChange={setGameId} options={ONLINE_GAMES.map((g) => ({ value: g.id, label: g.name }))} />
      <ChipGroup label={t.preset} value={preset} onChange={setPreset} hint={hint} options={setup.presets.map((p) => ({ value: p.id, label: p.label }))} />
      <ChipGroup label={setup.lengthLabel} value={length} onChange={setLength} options={setup.lengths.map((l, i) => ({ value: i, label: l.label }))} />
      {setup.players ? <ChipGroup label="Players" value={players} onChange={setPlayers} options={setup.players.map((p) => ({ value: p, label: String(p) }))} /> : null}
      <GoldButton label={busy ? t.working : t.create} disabled={busy} onPress={() => run(() => createRoom({ name: displayName, profileId, preset, settings }))} />
      <GoldButton kind="glass" label={t.quick} disabled={busy} onPress={() => run(() => quickMatch({ name: displayName, profileId, seats: players }))} />
      <Caption>{t.quickHint}</Caption>

      <SectionLabel>{t.or}</SectionLabel>
      <View style={[s.field, { borderColor: theme === "dark" ? material.line : c.borderControl, backgroundColor: theme === "dark" ? material.glass : c.surface }]}>
        <TextInput
          value={code} onChangeText={(v) => setCode(normalizeCode(v))} placeholder={t.codePlaceholder} placeholderTextColor={c.textMuted}
          autoCapitalize="characters" autoCorrect={false} maxLength={12} returnKeyType="go"
          accessibilityLabel={code ? `${t.codeLabel}: ${spellCode(code)}` : t.codeLabel}
          style={[s.input, { color: theme === "dark" ? material.goldLeafHot : c.primary }]}
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
  input: { textAlign: "center", letterSpacing: 8, fontSize: 22, fontFamily: fonts.display.family, fontWeight: "600", minHeight: 56, paddingHorizontal: 12 },
});
