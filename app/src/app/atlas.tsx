import React from "react";
import { Redirect } from "expo-router";
import { AtlasScreen } from "../features/info/AtlasScreen";

export default function Route() {
  if (!__DEV__) return <Redirect href="/" />;
  return <AtlasScreen />;
}
