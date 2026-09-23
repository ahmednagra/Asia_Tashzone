import React from "react";
import { useLocalSearchParams } from "expo-router";
import { DetailScreen } from "../../../features/games/DetailScreen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DetailScreen id={id ?? ""} />;
}
