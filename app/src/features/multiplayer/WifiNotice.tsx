import React from "react";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { GoldButton } from "../../components/ui/GoldButton";
import { useRouter } from "expo-router";
import { copy } from "./copy";

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
