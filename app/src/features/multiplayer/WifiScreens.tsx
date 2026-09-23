/** Same-Wi-Fi and hotspot screens. The layout is final; the connection itself is unavailable in this build (WIFI_TABLES_SUPPORTED). */
import React, { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { CodeCard } from "../../components/ui/CodeCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { Keypad } from "../../components/ui/Keypad";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { StepRow } from "../../components/ui/StepRow";
import { GAMES } from "../../constants/games";
import { useParentGate } from "../../hooks/useParentGate";
import { copy } from "./copy";
import { SeatList } from "./SeatList";
import { WIFI_TABLES_SUPPORTED, WifiNotice } from "./WifiNotice";
import { useProfile } from "../../store/profile";

/** True when nothing about a Wi-Fi table can be started: Parent Settings off, or no local transport in this build. */
function useWifiOff(): boolean {
  const { allowed } = useParentGate("wifi");
  return !allowed || !WIFI_TABLES_SUPPORTED;
}

export function WifiHostScreen() {
  const router = useRouter();
  const off = useWifiOff();
  const { profile } = useProfile();
  const { game } = useLocalSearchParams<{ game?: string }>();
  const entry = GAMES.find((g) => g.id === game && g.profile) ?? GAMES.find((g) => g.profile);
  const seatCount = entry?.seats?.[1] ?? 4;
  const t = copy.hostWifi;
  const seats = Array.from({ length: seatCount }, (_, i) => i === 0 ? { name: profile.name || t.you, status: "Ready", ok: true } : { name: null, status: "Waiting" });
  return (
    <Screen footer={<><GoldButton label={t.start} disabled={off} onPress={() => {}} /><GoldButton kind="glass" label={t.stop} onPress={() => router.back()} /></>}>
      <Header title={t.title} />
      <WifiNotice />
      <CodeCard label={t.pin} code="····" placeholder hint={t.pinHint} />
      {entry ? <Caption>{`${entry.name} · up to ${seatCount} seats`}</Caption> : null}
      <SeatList seats={seats} openName={t.open} />
      <Caption>{t.seatsNote}</Caption>
    </Screen>
  );
}

export function WifiJoinScreen() {
  const router = useRouter();
  const off = useWifiOff();
  const t = copy.joinWifi;
  return (
    <Screen footer={<><GoldButton kind="glass" label={t.scan} disabled onPress={() => {}} /><GoldButton kind="glass" label={t.enterPin} disabled={off} onPress={() => router.push("/wifi/pin")} /></>}>
      <Header title={t.title} />
      <WifiNotice />
      <Caption>{t.looking}</Caption>
      <Caption>{t.scanOff}</Caption>
      <Caption>{t.notListed}</Caption>
    </Screen>
  );
}

export function WifiPinScreen() {
  const off = useWifiOff();
  const [tries, setTries] = useState(0);
  const t = copy.pin;
  return (
    <Screen footer={<GoldButton label={t.join} disabled onPress={() => {}} />}>
      <Header title={t.title} />
      <WifiNotice />
      <Caption>{t.lead}</Caption>
      <Keypad digits={4} label={t.label} disabled={off} onComplete={() => setTries((n) => n + 1)} />
      {tries > 0 && !off ? <StatusBanner tone="info" title={t.entered} /> : null}
      <Caption center>{t.lockout}</Caption>
    </Screen>
  );
}

export function HotspotScreen() {
  const router = useRouter();
  const t = copy.hotspot;
  return (
    <Screen footer={<><GoldButton label={t.host} onPress={() => router.push("/wifi/host")} /><GoldButton kind="glass" label={t.join} onPress={() => router.push("/wifi/join")} /></>}>
      <Header title={t.title} />
      <Caption>{t.lead}</Caption>
      {t.steps.map((s, i) => <StepRow key={i} n={i + 1} title={s.t} body={s.b} />)}
      <WifiNotice />
      <Caption>{t.privacy}</Caption>
    </Screen>
  );
}
