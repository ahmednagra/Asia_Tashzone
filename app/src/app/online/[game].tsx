import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { OnlineTable } from "../../features/lobby/OnlineTable";
import { RequireParent } from "../../features/multiplayer/WifiNotice";

/** /online/<gameId>: the live table when this device has an online session, otherwise the room screen for that game. */
export default function OnlineRoute() {
  const { game } = useLocalSearchParams<{ game: string }>();
  const session = useOnlineSession();
  const kind = session.transport === "wifi" ? "wifi" : "online";
  if (session.phase === "idle") return session.transport === "wifi" ? <Redirect href="/wifi/join" /> : <Redirect href={{ pathname: "/room", params: { game } }} />;
  return <RequireParent kind={kind}><OnlineTable /></RequireParent>;
}
