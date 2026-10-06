import React from "react";
import { WifiPinScreen } from "../../features/multiplayer/WifiScreens";
import { RequireParent } from "../../features/multiplayer/WifiNotice";

export default function Route() {
  return <RequireParent kind="wifi"><WifiPinScreen /></RequireParent>;
}
