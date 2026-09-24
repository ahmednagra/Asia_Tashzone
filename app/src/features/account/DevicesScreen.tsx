import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Caption } from "../../components/ui/Caption";
import { GoldButton } from "../../components/ui/GoldButton";
import { NavRow } from "../../components/ui/NavRow";
import { SettingsScreen } from "../../components/ui/Settings";
import { Sheet } from "../../components/ui/Sheet";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import type { DeviceSession } from "../../types/api";
import { T } from "../settings/copy";
import { A } from "./copy";
import { authMessage } from "./errors";
import { listDevices, signOutDevice, signOutEverywhere } from "./flows";

const LOCALES = { en: "en-GB", ur: "ur-PK", hi: "hi-IN", ne: "ne-NP", bn: "bn-BD" } as const;

function activity(iso: string, lang: keyof typeof LOCALES): string {
  const when = new Date(iso);
  if (when.toDateString() === new Date().toDateString()) return A.activeToday;
  try {
    return A.lastActive(when.toLocaleDateString(LOCALES[lang], { day: "numeric", month: "short", year: "numeric" }));
  } catch {
    return A.lastActive(when.toISOString().slice(0, 10));
  }
}

export function DevicesScreen() {
  const { lang } = useTheme();
  const { profile } = useProfile();
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);
  const [target, setTarget] = useState<DeviceSession | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let live = true;
    listDevices(profile).then((d) => { if (live) setDevices(d); }).catch((e) => { if (live) setMessage(authMessage(e)); });
    return () => { live = false; };
  }, [profile.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(load);

  const work = async (job: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await job());
      setDevices(await listDevices(profile));
    } catch (e) {
      setMessage(authMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const endOne = () => {
    const d = target;
    setTarget(null);
    if (d) work(async () => { await signOutDevice(d.id, profile); return A.deviceSignedOut; });
  };
  const endOthers = () => work(async () => { await signOutEverywhere(profile); return T.account.signOutAllDone; });

  const others = devices?.filter((d) => !d.current) ?? [];
  const label = (d: DeviceSession) => d.device_name || A.unknownDevice;

  return (
    <SettingsScreen title={A.devicesTitle}>
      {devices?.map((d) => (
        <NavRow key={d.id} icon={d.current ? "●" : "○"} title={label(d)} badge={d.current ? A.thisPhone : undefined}
          caption={activity(d.last_seen_at, lang)} onPress={d.current ? undefined : () => setTarget(d)} disabled={busy} />
      ))}
      {devices && others.length === 0 ? <Caption tone="muted">{A.noOthers}</Caption> : null}
      {message ? <Caption>{message}</Caption> : null}
      {others.length > 0 ? (
        <View>
          <GoldButton kind="glass" label={T.account.signOutAll} onPress={endOthers} disabled={busy} />
        </View>
      ) : null}

      <Sheet visible={target !== null} title={A.signOutDeviceTitle} onClose={() => setTarget(null)}
        actions={<><GoldButton label={A.signOutDeviceDo} onPress={endOne} /><GoldButton kind="glass" label={T.account.cancel} onPress={() => setTarget(null)} /></>}>
        <Caption>{target ? label(target) : ""}</Caption>
        <Caption>{A.signOutDeviceBody}</Caption>
      </Sheet>
    </SettingsScreen>
  );
}
