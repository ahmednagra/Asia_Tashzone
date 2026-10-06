import React from "react";
import { useLocalSearchParams } from "expo-router";
import { RoomEntry } from "../features/lobby/RoomEntry";
import { RequireParent } from "../features/multiplayer/WifiNotice";

export default function Route() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  return <RequireParent kind="online"><RoomEntry game={game} /></RequireParent>;
}
