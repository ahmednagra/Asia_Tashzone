import React from "react";
import { WifiJoinScreen } from "../../features/multiplayer/WifiScreens";
import { RequireParent } from "../../features/multiplayer/WifiNotice";

export default function Route() {
  return <RequireParent kind="wifi"><WifiJoinScreen /></RequireParent>;
}
