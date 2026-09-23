import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../ui/theme";
import { Button } from "../../ui/Button";
import { MatchClient, type SocketLike } from "@tashzone/match";
import { TableScreen } from "../play/table/TableScreen";
import { api } from "../../platform/api";
import { VERSION_CODE } from "../../platform/env";
import { randomSeedHex } from "../../platform/random";
import { SETUP } from "../play/games";

const rnSocket = (url: string): SocketLike => new WebSocket(url) as unknown as SocketLike;

export function OnlineRoom({ profileId, onExit }: { profileId: string; onExit: () => void }) {
  const { c } = useTheme();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string>("idle");
  const [view, setView] = useState<any>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>(["", "", "", ""]);
  const client = useRef<MatchClient | null>(null);
  useEffect(() => () => client.current?.leave(), []);

  async function go(join: boolean) {
    try {
      setStatus("connecting");
      const cfg = await api.appConfig();
      const me = await api.register("Player");
      const r = join ? await api.joinRoom(me.token, code.trim().toUpperCase()) : await api.createRoom(me.token, profileId, SETUP[profileId]!.lengths[SETUP[profileId]!.defaultLength]!.settings, SETUP[profileId]!.presets[0]!.id);
      setRoom(r.room_code);
      const m = new MatchClient({
        url: r.match_url, joinToken: r.join_token, engineBuildHash: cfg.engine_build_hash ?? "",
        behaviourDigest: cfg.behaviour_digests[profileId] ?? "", versionCode: VERSION_CODE, socket: rnSocket, randomSeed: randomSeedHex,
        onState: (st) => { setStatus(st.status); setView(st.view); },
        onMessage: (msg) => { if (msg.type === "TableSnapshot") setNames(msg.table_meta.seats.map((x: { name: string }) => x.name)); },
      });
      client.current = m;
      m.connect();
    } catch {
      setStatus("error");
    }
  }

  if (status === "update_required") return <Center><Text style={{ color: c.text }}>Please update TashZone to play online.</Text><Button label="Back" onPress={onExit} /></Center>;
  if (view) {
    return (
      <View style={{ flex: 1 }}>
        {!view.hand && (
          <View style={[s.lobby, { backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontSize: 20 }} accessibilityLabel={`Room code ${room?.split("").join(" ")}`}>Room {room}</Text>
            <Button label="Start with bots in empty seats" onPress={() => client.current?.start()} />
          </View>
        )}
        {status === "reconnecting" && <Text style={[s.banner, { color: c.warning }]} accessibilityLiveRegion="polite">Reconnecting…</Text>}
        <TableScreen view={view} names={names} onMove={(mv) => client.current?.intent(mv)} />
      </View>
    );
  }
  return (
    <Center>
      {status === "connecting" ? <ActivityIndicator /> : null}
      {status === "error" && <Text style={{ color: c.error }}>Could not reach the server.</Text>}
      <Button label="Create a private room" onPress={() => go(false)} />
      <TextInput value={code} onChangeText={setCode} placeholder="Room code" autoCapitalize="characters" maxLength={6}
        placeholderTextColor={c.textMuted} style={[s.input, { color: c.text, borderColor: c.borderControl }]} accessibilityLabel="Room code" />
      <Button label="Join room" kind="quiet" disabled={code.trim().length !== 6} onPress={() => go(true)} />
      <Button label="Back" kind="quiet" onPress={onExit} />
    </Center>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <View style={[s.center, { backgroundColor: c.bg }]}>{children}</View>;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "stretch", justifyContent: "center", padding: 24, gap: 12 },
  input: { minHeight: 48, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, fontSize: 20, letterSpacing: 4 },
  lobby: { padding: 16, gap: 12, paddingTop: 48 },
  banner: { textAlign: "center", padding: 6 },
});
