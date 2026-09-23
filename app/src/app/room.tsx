import React from "react";
import { useLocalSearchParams } from "expo-router";
import { RoomEntry } from "../features/lobby/RoomEntry";

export default function Route() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  return <RoomEntry game={game} />;
}
