import React from "react";
import { useLocalSearchParams } from "expo-router";
import { SetupScreen } from "../../../features/games/SetupScreen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SetupScreen id={id ?? ""} />;
}
