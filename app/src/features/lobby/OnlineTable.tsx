/** The live online table: the shared TableScreen fed by the session's MatchClient, with connection banners and a leave confirmation. */
import React, { useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmSheet } from "../../components/ui/ConfirmSheet";
import { GoldButton } from "../../components/ui/GoldButton";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { useTheme } from "../../context/ThemeContext";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { useBackAction } from "../../hooks/useBackAction";
import { TableScreen } from "../play/table/TableScreen";
import { leaveSession, retryConnection, sendMove, type SessionState } from "../multiplayer/session";
import { KeepAwake } from "../multiplayer/KeepAwake";
import { copy } from "../multiplayer/copy";

const STORE_URL = "market://details?id=com.tashzone.app";

function Overlay({ session, onLeave }: { session: SessionState; onLeave: () => void }) {
  const t = copy.table;
  if (session.updateRequired) {
    return (
      <StatusBanner tone="warn" title={copy.update.title} body={copy.update.body}>
        {Platform.OS === "android" ? <GoldButton label={t.openStore} onPress={() => { Linking.openURL(STORE_URL).catch(() => {}); }} /> : null}
        <GoldButton kind="glass" label={t.leaveNow} onPress={onLeave} />
      </StatusBanner>
    );
  }
  if (session.conn === "offline") {
    return (
      <StatusBanner tone="error" title={copy.offline.title} body={copy.offline.body}>
        <GoldButton kind="glass" label={t.tryAgain} onPress={retryConnection} />
      </StatusBanner>
    );
  }
  if (session.conn === "reconnecting") {
    return (
      <StatusBanner busy tone="warn" title={copy.reconnecting.title} body={copy.reconnecting.body}>
        <GoldButton kind="glass" label={t.tryAgain} onPress={retryConnection} />
      </StatusBanner>
    );
  }
  if (session.conn === "connecting") return <StatusBanner busy title={copy.lobby.connecting.title} body={copy.lobby.connecting.body} />;
  if (session.paused) return <StatusBanner tone="info" title={copy.paused.title} body={copy.paused.body} />;
  return null;
}

export function OnlineTable() {
  const { c } = useTheme();
  const router = useRouter();
  const inset = useSafeAreaInsets();
  const session = useOnlineSession();
  const [confirm, setConfirm] = useState(false);
  useBackAction(() => setConfirm(true), session.phase === "playing");

  if (session.phase === "ended") return <Redirect href="/match" />;
  const wifi = session.transport === "wifi";
  if (session.phase === "lobby") return <Redirect href={wifi && session.isHost ? "/wifi/host" : "/wait"} />;
  if (session.phase !== "playing" || !session.view) return <Redirect href={wifi ? "/wifi/join" : "/room"} />;
  const closesTable = wifi && session.isHost; // the host's phone runs the table: leaving ends it for everyone
  const t = copy.table;

  const leave = () => { setConfirm(false); leaveSession(); router.replace("/"); };
  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: inset.top }]}>
      <KeepAwake />
      <View style={s.bar}>
        <GoldButton kind="glass" label={t.leave} onPress={() => setConfirm(true)} style={s.leave} />
      </View>
      <View style={s.stage}>
        <TableScreen view={session.view} names={session.names} controls={session.controls} deadline={session.deadline} onMove={sendMove} />
        <View pointerEvents="box-none" style={s.overlay}>
          <Overlay session={session} onLeave={leave} />
        </View>
      </View>
      <ConfirmSheet visible={confirm} title={closesTable ? copy.hostWifi.ending.title : t.leaveTitle}
        facts={closesTable ? t.hostFacts : t.leaveFacts(wifi)}
        confirmLabel={closesTable ? copy.hostWifi.stop : t.leave} cancelLabel={closesTable ? copy.hostWifi.ending.stay : t.stay}
        onConfirm={leave} onCancel={() => setConfirm(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 12 },
  leave: { alignSelf: "flex-end" },
  stage: { flex: 1 },
  overlay: { position: "absolute", top: 8, left: 12, right: 12 },
});
