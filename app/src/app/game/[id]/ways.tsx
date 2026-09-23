import React from "react";
import { useLocalSearchParams } from "expo-router";
import { WaysScreen } from "../../../features/games/WaysScreen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WaysScreen id={id ?? ""} />;
}
