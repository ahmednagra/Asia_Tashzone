import React, { useEffect } from "react";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { GoldButton } from "../../components/ui/GoldButton";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { useRouter } from "expo-router";
import { useProfile } from "../../store/profile";
import { getSession, leaveSession } from "./session";
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

function ParentBlockedScreen({ kind }: { kind: "online" | "wifi" }) {
  const router = useRouter();
  useEffect(() => {
    const s = getSession();
    if (s.phase !== "idle" && s.transport === kind) leaveSession();
  }, [kind]);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <Screen footer={<GoldButton label={copy.locked.back} onPress={back} />}>
      <Header title={copy.locked.header} />
      <ParentLocked kind={kind} />
    </Screen>
  );
}

export function RequireParent({ kind, children }: { kind: "online" | "wifi"; children: React.ReactNode }) {
  const { profile } = useProfile();
  if (profile.parent[kind] === false) return <ParentBlockedScreen kind={kind} />;
  return <>{children}</>;
}
