/**
 * Same-Wi-Fi screens: host lobby (PIN, QR, seats), join (nearby tables, QR scan), PIN entry and the hotspot help.
 * The connection logic lives in wifiSession.ts; after a table starts, the shared wait/table/summary screens take over.
 * Everything a screen opens (server, advert, scan, sockets) is closed when the screen goes away without a match starting.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { parseTableQr } from "@tashzone/match";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { CodeCard } from "../../components/ui/CodeCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { Keypad } from "../../components/ui/Keypad";
import { NavRow } from "../../components/ui/NavRow";
import { QrCode } from "../../components/ui/QrCode";
import { QrScanner } from "../../components/ui/QrScanner";
import { SearchField } from "../../components/ui/SearchField";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { StepRow } from "../../components/ui/StepRow";
import { GAMES } from "../../constants/games";
import { useBackAction } from "../../hooks/useBackAction";
import { useParentGate } from "../../hooks/useParentGate";
import { useNearbyTables, useWifiSession } from "../../hooks/useWifiSession";
import { useProfile } from "../../store/profile";
import { TableSetupChips, useTableSetup } from "../lobby/TableSetup";
import { copy, errorMessage } from "./copy";
import { isDialable, parseHostAddress } from "./lanLogic";
import { SeatList, type SeatEntry } from "./SeatList";
import { clearError, getSession, leaveSession, startTable } from "./session";
import { ParentLocked } from "./WifiNotice";
import { hostTable, joinTable, kickSeat } from "./wifiSession";

/** Locked screen shown in place of a Wi-Fi screen when Parent Settings turned Wi-Fi tables off. */
function WifiLocked({ title }: { title: string }) {
  return <Screen><Header title={title} /><ParentLocked kind="wifi" /></Screen>;
}

/* ───────────── host ───────────── */

export function WifiHostScreen() {
  const router = useRouter();
  const { allowed } = useParentGate("wifi");
  const { profile } = useProfile();
  const { game } = useLocalSearchParams<{ game?: string }>();
  const session = useWifiSession();
  const ts = useTableSetup(game);
  const [busy, setBusy] = useState(false);
  const t = copy.hostWifi;
  const wifi = session.active && session.wifi?.role === "host" ? session.wifi : null;
  const hosting = !!wifi && (session.phase === "lobby" || session.phase === "playing");

  useEffect(() => { clearError(); }, []);
  // Leaving this screen while the table is still a lobby closes it (server, advert, sockets). Starting the match moves on to the table.
  useEffect(() => () => {
    const s = getSession();
    if (s.transport === "wifi" && s.wifi?.role === "host" && (s.phase === "lobby" || s.phase === "connecting")) leaveSession();
  }, []);
  const close = useCallback(() => { leaveSession(); router.replace("/"); }, [router]);
  useBackAction(close, hosting || busy);

  if (!allowed) return <WifiLocked title={t.title} />;
  if (hosting && session.phase === "playing") return <Redirect href={{ pathname: "/online/[game]", params: { game: GAMES.find((g) => g.profile === session.profileId)?.id ?? "" } }} />;
  if (session.active && session.phase === "ended") return <Redirect href="/match" />;

  if (!hosting || !wifi) {
    const error = session.active && session.phase === "idle" ? session.error : null;
    const open = async () => {
      if (busy || !ts.entry?.profile) return;
      setBusy(true);
      await hostTable({ name: profile.name || "Player", profileId: ts.entry.profile, gameName: ts.entry.name, preset: ts.preset, settings: ts.settings, protectedMode: profile.protectedMode });
      setBusy(false);
    };
    return (
      <Screen footer={<GoldButton label={busy ? t.opening : t.open} disabled={busy || !ts.entry} onPress={open} />}>
        <Header title={t.title} />
        <Caption>{t.lead}</Caption>
        {error ? <StatusBanner tone="error" title={errorMessage(error)} /> : null}
        {ts.entry ? <TableSetupChips ts={ts} /> : <Caption>{copy.room.noGames}</Caption>}
      </Screen>
    );
  }

  const seats: SeatEntry[] = Array.from({ length: session.seatCount }, (_, i) => {
    const r = wifi.roster[i];
    if (!r || r.kind === "bot") return { name: null, status: copy.lobby.openState };
    if (r.host) return { name: profile.name || t.you, status: copy.lobby.hostState, ok: true };
    return r.online ? { name: r.name, status: copy.lobby.ready, ok: true } : { name: r.name, status: t.away };
  });
  const canStart = session.conn === "open";
  const away = wifi.roster.filter((r) => !r.host && r.kind === "human" && !r.online);

  return (
    <Screen footer={<>
      <GoldButton label={t.start} disabled={!canStart} onPress={startTable} />
      <GoldButton kind="glass" label={t.stop} onPress={close} />
    </>}>
      <Header title={t.title} back={false} />
      {wifi.locked ? <StatusBanner tone="warn" title={t.locked.title} body={t.locked.body} /> : null}
      {session.error ? <StatusBanner tone="error" title={errorMessage(session.error)} /> : null}
      <CodeCard label={t.pin} code={wifi.pin ?? "····"} hint={t.pinHint} />
      {wifi.qr ? <QrCode value={wifi.qr} label={t.qrLabel} /> : null}
      {wifi.address ? <Caption>{`${t.address}: ${wifi.address}. ${t.addressHint}`}</Caption> : null}
      <SeatList seats={seats} openName={t.openSeat} />
      {away.map((r) => <GoldButton key={r.seat} kind="glass" label={t.remove(r.name)} onPress={() => kickSeat(r.seat)} />)}
      <Caption>{t.seatsNote}</Caption>
    </Screen>
  );
}

/* ───────────── guest ───────────── */

/** Join a table and go to the wait room; the join is abandoned if the screen goes away first. */
function useJoin() {
  const router = useRouter();
  const { profile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => () => { if (busyRef.current) leaveSession(); }, []);

  const join = useCallback(async (host: string, port: number, pin: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null);
    const r = await joinTable({ name: profile.name || "Player", host, port, pin });
    if (r.ok) { busyRef.current = false; setBusy(false); router.replace("/wait"); return; }
    busyRef.current = false; setBusy(false);
    if (r.code === "CANCELLED") return;
    clearError();
    setError(r.code);
    if (r.code === "WRONG_PIN") setFails((n) => n + 1);
  }, [profile.name, router]);

  const message = error === "WRONG_PIN" ? (fails >= 3 ? `${copy.pin.tryAgain} ${copy.pin.tryLocked}` : copy.pin.tryAgain) : error ? errorMessage(error) : null;
  return { busy, error, message, join, clear: () => setError(null) };
}

export function WifiJoinScreen() {
  const router = useRouter();
  const { allowed } = useParentGate("wifi");
  const t = copy.joinWifi;
  const { busy, message, join, clear } = useJoin();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const { tables, error: discoveryError, rescan } = useNearbyTables(allowed && !scanning && !busy);

  const scanned = (data: string) => {
    setScanning(false);
    const q = parseTableQr(data);
    if (!q) { setScanError(t.scanBad); return; }
    setScanError(null);
    void join(q.host, q.port, q.pin);
  };

  if (!allowed) return <WifiLocked title={t.title} />;

  return (
    <Screen footer={scanning ? undefined : <>
      <GoldButton kind="glass" label={t.scan} disabled={busy} onPress={() => { clear(); setScanError(null); setScanning(true); }} />
      <GoldButton kind="glass" label={t.enterPin} disabled={busy} onPress={() => router.push("/wifi/pin")} />
    </>}>
      <Header title={t.title} />
      {busy ? <StatusBanner busy title={copy.pin.joining} /> : null}
      {message ? <StatusBanner tone="error" title={message} /> : null}
      {scanError ? <StatusBanner tone="error" title={scanError} /> : null}
      {scanning ? <QrScanner onScanned={scanned} onCancel={() => setScanning(false)} /> : (
        <>
          {discoveryError ? <StatusBanner tone="warn" title={errorMessage(discoveryError)} /> : null}
          <SectionLabel>{t.nearby}</SectionLabel>
          {tables.length === 0 ? <Caption>{discoveryError ? t.notListed : `${t.looking} ${t.none}`}</Caption> : null}
          {tables.map((tb) => (
            <NavRow key={tb.name} icon="⌁" title={tb.hostNickname ? `${tb.hostNickname}'s table` : tb.name} caption={tb.game || undefined}
              onPress={() => isDialable(tb.host, tb.port) && router.push({ pathname: "/wifi/pin", params: { host: tb.host, port: String(tb.port) } })} />
          ))}
          <GoldButton kind="glass" label={t.rescan} onPress={rescan} />
          <Caption>{t.notListed}</Caption>
          <NavRow icon="≋" title={t.hotspot} onPress={() => router.push("/wifi/hotspot")} />
        </>
      )}
    </Screen>
  );
}

export function WifiPinScreen() {
  const { allowed } = useParentGate("wifi");
  const params = useLocalSearchParams<{ host?: string; port?: string }>();
  const t = copy.pin;
  const { busy, message, join, clear } = useJoin();
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);

  // A table picked from the nearby list arrives with its address; otherwise the player types the one on the host's screen.
  const picked = params.host && params.port && /^\d{1,5}$/.test(params.port) && isDialable(params.host, Number(params.port))
    ? { host: params.host, port: Number(params.port) } : null;

  if (!allowed) return <WifiLocked title={t.title} />;

  const onPin = (pin: string) => {
    const target = picked ?? parseHostAddress(address);
    if (!target) { setAddressError(true); return; }
    setAddressError(false);
    clear();
    void join(target.host, target.port, pin);
  };

  return (
    <Screen>
      <Header title={t.title} />
      <Caption>{t.lead}</Caption>
      {!picked ? (
        <>
          <SectionLabel>{t.addressLabel}</SectionLabel>
          <SearchField value={address} onChangeText={(v) => { setAddress(v); setAddressError(false); }} placeholder={t.addressPlaceholder} label={t.addressLabel} />
          <Caption>{t.addressHint}</Caption>
        </>
      ) : null}
      {addressError ? <StatusBanner tone="error" title={errorMessage("ADDRESS_INVALID")} /> : null}
      {busy ? <StatusBanner busy title={t.joining} /> : null}
      {message ? <StatusBanner tone="error" title={message} /> : null}
      <Keypad digits={4} label={t.label} disabled={busy} onComplete={onPin} />
      <Caption center>{t.lockout}</Caption>
    </Screen>
  );
}

/* ───────────── hotspot help ───────────── */

export function HotspotScreen() {
  const router = useRouter();
  const t = copy.hotspot;
  return (
    <Screen footer={<><GoldButton label={t.host} onPress={() => router.push("/wifi/host")} /><GoldButton kind="glass" label={t.join} onPress={() => router.push("/wifi/join")} /></>}>
      <Header title={t.title} />
      <Caption>{t.lead}</Caption>
      {t.steps.map((s, i) => <StepRow key={i} n={i + 1} title={s.t} body={s.b} />)}
      <Caption>{t.hostNote}</Caption>
      <Caption>{t.privacy}</Caption>
    </Screen>
  );
}
