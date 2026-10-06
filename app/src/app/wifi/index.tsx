import React from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { isValidTablePin } from "@tashzone/match";
import { isDialable } from "../../features/multiplayer/lanLogic";
import { RequireParent } from "../../features/multiplayer/WifiNotice";

export default function WifiLinkRoute() {
  const { h, p, k } = useLocalSearchParams<{ h?: string; p?: string; k?: string }>();
  const port = typeof p === "string" && /^\d{1,5}$/.test(p) ? Number(p) : NaN;
  const ok = typeof h === "string" && isDialable(h, port);
  const pin = typeof k === "string" && isValidTablePin(k) ? k : undefined;
  return (
    <RequireParent kind="wifi">
      {ok ? <Redirect href={{ pathname: "/wifi/pin", params: { host: h, port: String(port), ...(pin ? { pin } : {}) } }} /> : <Redirect href="/wifi/join" />}
    </RequireParent>
  );
}
