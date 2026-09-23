import React from "react";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { GoldButton } from "../../components/ui/GoldButton";
import { useParentGate } from "../../hooks/useParentGate";
import { useRouter } from "expo-router";
import { copy } from "./copy";

/** Same-Wi-Fi/hotspot tables need a local socket and discovery module that this build does not ship (see README). */
export const WIFI_TABLES_SUPPORTED = false;

/** Banner shown on every Wi-Fi screen: the parent lock if Parent Settings turned Wi-Fi off, otherwise the honest "not available yet". */
export function WifiNotice() {
  const { allowed } = useParentGate("wifi");
  if (allowed && WIFI_TABLES_SUPPORTED) return null;
  return allowed ? <StatusBanner tone="info" title={copy.wifiUnavailable.title} body={copy.wifiUnavailable.body} /> : <ParentLocked kind="wifi" />;
}

/** The mockup's locked state for a mode Parent Settings turned off, with a way to the parent controls. */
export function ParentLocked({ kind }: { kind: "online" | "wifi" }) {
  const router = useRouter();
  const t = copy.locked[kind];
  return (
    <StatusBanner tone="warn" title={t.title} body={t.body}>
      <GoldButton kind="glass" label={t.action} onPress={() => router.push("/settings/parent")} />
    </StatusBanner>
  );
}
