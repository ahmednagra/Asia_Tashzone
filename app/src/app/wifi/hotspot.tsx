import React from "react";
import { HotspotScreen } from "../../features/multiplayer/WifiScreens";
import { RequireParent } from "../../features/multiplayer/WifiNotice";

export default function Route() {
  return <RequireParent kind="wifi"><HotspotScreen /></RequireParent>;
}
