import React from "react";
import { WifiHostScreen } from "../../features/multiplayer/WifiScreens";
import { RequireParent } from "../../features/multiplayer/WifiNotice";

export default function Route() {
  return <RequireParent kind="wifi"><WifiHostScreen /></RequireParent>;
}
