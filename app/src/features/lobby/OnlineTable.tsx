/** The live online table: the shared TableScreen fed by the session's MatchClient, with connection banners and a leave confirmation. */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoldButton } from "../../components/ui/GoldButton";
import { Sheet } from "../../components/ui/Sheet";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { Caption } from "../../components/ui/Caption";
import { useTheme } from "../../context/ThemeContext";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { useBackAction } from "../../hooks/useBackAction";
import { TableScreen } from "../play/table/TableScreen";
import { leaveSession, retryConnection, sendMove } from "../multiplayer/session";
import { copy } from "../multiplayer/copy";

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

  const leave = () => { setConfirm(false); leaveSession(); router.replace("/"); };
  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: inset.top }]}>
      <View style={s.bar}>
        <GoldButton kind="glass" label="Leave" onPress={() => setConfirm(true)} style={s.leave} />
      </View>
      {session.conn === "reconnecting" ? (
        <StatusBanner busy tone="warn" title={copy.reconnecting.title} body={copy.reconnecting.body}>
          <GoldButton kind="glass" label="Try again" onPress={retryConnection} />
        </StatusBanner>
      ) : null}
      {session.paused ? <StatusBanner tone="info" title={copy.paused.title} body={copy.paused.body} /> : null}
      {session.updateRequired ? <StatusBanner tone="warn" title={copy.update.title} body={copy.update.body} /> : null}
      <TableScreen view={session.view} names={session.names} controls={session.controls} deadline={session.deadline} onMove={sendMove} />
      <Sheet visible={confirm} title={closesTable ? copy.hostWifi.ending.title : "Leave this match?"} onClose={() => setConfirm(false)}
        actions={<><GoldButton label={closesTable ? copy.hostWifi.stop : "Leave"} onPress={leave} /><GoldButton kind="glass" label={closesTable ? copy.hostWifi.ending.stay : "Stay"} onPress={() => setConfirm(false)} /></>}>
        <Caption>{closesTable ? copy.hostWifi.ending.body : `A bot plays your seat for the rest of the match. You can come back while the ${wifi ? "table" : "room"} is live.`}</Caption>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 12 },
  leave: { alignSelf: "flex-end" },
});
