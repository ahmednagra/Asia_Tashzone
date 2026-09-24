/**
 * Same-Wi-Fi screens: host lobby (PIN, QR, seats), join (nearby tables, QR scan), PIN entry and the hotspot help.
 * The connection logic lives in wifiSession.ts; after a table starts, the shared wait/table/summary screens take over.
 * Everything a screen opens (server, advert, scan, sockets) is closed when the screen goes away without a match starting.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { isValidTablePin, parseTableQr } from "@tashzone/match";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { CodeCard } from "../../components/ui/CodeCard";
import { ConfirmSheet } from "../../components/ui/ConfirmSheet";
import { GoldButton } from "../../components/ui/GoldButton";
import { Keypad } from "../../components/ui/Keypad";
import { NavRow } from "../../components/ui/NavRow";
import { QrCode } from "../../components/ui/QrCode";
import { QrScanner } from "../../components/ui/QrScanner";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { StepRow } from "../../components/ui/StepRow";
import { GAMES } from "../../constants/games";
import { fonts, minTouchTarget } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useBackAction } from "../../hooks/useBackAction";
import { useNearbyTables, useWifiSession } from "../../hooks/useWifiSession";
import { useProfile } from "../../store/profile";
import { TableSetupChips, useTableSetup } from "../lobby/TableSetup";
import { copy, errorMessage, ltr } from "./copy";
import { KeepAwake } from "./KeepAwake";
import { isDialable, parseHostAddress } from "./lanLogic";
import { SeatChips, type SeatEntry } from "./SeatList";
import { clearError, getSession, leaveSession, startTable } from "./session";
import { hostTable, joinTable, kickSeat } from "./wifiSession";

const QR_SIZE = 116;
const ADDRESS_EXAMPLE = "192.168.1.20:41234";

/* ───────────── host ───────────── */

export function WifiHostScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const { game } = useLocalSearchParams<{ game?: string }>();
  const session = useWifiSession();
  const ts = useTableSetup(game);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removed, setRemoved] = useState<string | null>(null);
  const t = copy.hostWifi;
  const wifi = session.active && session.wifi?.role === "host" ? session.wifi : null;
  const hosting = !!wifi && (session.phase === "lobby" || session.phase === "playing");

  useEffect(() => { clearError(); }, []);
  // Leaving this screen while the table is still a lobby closes it (server, advert, sockets). Starting the match moves on to the table.
  useEffect(() => () => {
    const s = getSession();
    if (s.transport === "wifi" && s.wifi?.role === "host" && (s.phase === "lobby" || s.phase === "connecting")) leaveSession();
  }, []);
  const close = useCallback(() => { setConfirm(false); leaveSession(); router.replace("/"); }, [router]);
  useBackAction(() => (hosting ? setConfirm(true) : close()), hosting || busy);

  if (hosting && session.phase === "playing") return <Redirect href={{ pathname: "/online/[game]", params: { game: GAMES.find((g) => g.profile === session.profileId)?.id ?? "" } }} />;
  if (session.active && session.phase === "ended") return <Redirect href="/match" />;

  if (!hosting || !wifi) {
    const error = session.active && session.phase === "idle" ? session.error : null;
    const open = async () => {
      if (busy || !ts.entry?.profile) return;
      setBusy(true);
      await hostTable({ name: profile.name || copy.defaultName, profileId: ts.entry.profile, gameName: ts.entry.name, preset: ts.preset, settings: ts.settings, protectedMode: profile.protectedMode });
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
    const remove = { removeLabel: t.remove(r.name), onRemove: () => { kickSeat(r.seat); setRemoved(r.name); } };
    return r.online ? { name: r.name, status: copy.lobby.ready, ok: true, ...remove } : { name: r.name, status: t.away, ...remove };
  });
  const canStart = session.conn === "open";

  return (
    <Screen footer={<>
      <GoldButton label={t.start} disabled={!canStart} onPress={startTable} />
      <GoldButton kind="glass" label={t.stop} onPress={() => setConfirm(true)} />
    </>}>
      <KeepAwake />
      <Header title={t.title} back={false} />
      {wifi.locked ? <StatusBanner tone="warn" title={t.locked.title} body={t.locked.body} /> : null}
      {session.error ? <StatusBanner tone="error" title={errorMessage(session.error)} /> : null}
      {removed ? <StatusBanner tone="info" title={t.removed(removed)} /> : null}
      <View style={s.pinRow}>
        <View style={s.pinCard}><CodeCard label={t.pin} code={wifi.pin ?? "····"} hint={t.pinHint} /></View>
        {wifi.qr ? <QrCode value={wifi.qr} size={QR_SIZE} label={t.qrLabel} /> : null}
      </View>
      {wifi.address ? <Caption>{t.addressLine(ltr(wifi.address))}</Caption> : null}
      <SectionLabel>{t.seats}</SectionLabel>
      <SeatChips seats={seats} openName={t.openSeat} />
      <Caption>{t.seatsNote}</Caption>
      <ConfirmSheet visible={confirm} title={t.ending.title} facts={copy.table.hostFacts} confirmLabel={t.stop} cancelLabel={t.ending.stay}
        onConfirm={close} onCancel={() => setConfirm(false)} />
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
    busyRef.current = true; setBusy(true); setError(null); clearError();
    const r = await joinTable({ name: profile.name || copy.defaultName, host, port, pin });
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

function DroppedBanner() {
  const session = useWifiSession();
  const code = session.active && session.phase === "idle" ? session.error : null;
  if (!code) return null;
  const d = copy.joinWifi.dropped[code];
  return (
    <StatusBanner tone={code === "KICKED" ? "warn" : "error"} title={d?.title ?? errorMessage(code)} body={d?.body}>
      <GoldButton kind="glass" label={copy.joinWifi.dismiss} onPress={clearError} />
    </StatusBanner>
  );
}

export function WifiJoinScreen() {
  const router = useRouter();
  const t = copy.joinWifi;
  const { busy, message, join, clear } = useJoin();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const { tables, error: discoveryError, rescan } = useNearbyTables(!scanning && !busy);

  const scanned = (data: string) => {
    setScanning(false);
    const q = parseTableQr(data);
    if (!q) { setScanError(t.scanBad); return; }
    setScanError(null);
    void join(q.host, q.port, q.pin);
  };

  return (
    <Screen footer={scanning ? undefined : <>
      <GoldButton kind="glass" label={t.scan} disabled={busy} onPress={() => { clear(); clearError(); setScanError(null); setScanning(true); }} />
      <GoldButton kind="glass" label={t.enterPin} disabled={busy} onPress={() => { clearError(); router.push("/wifi/pin"); }} />
    </>}>
      <Header title={t.title} />
      <DroppedBanner />
      {busy ? <StatusBanner busy title={copy.pin.joining} /> : null}
      {message ? <StatusBanner tone="error" title={message} /> : null}
      {scanError ? <StatusBanner tone="error" title={scanError} /> : null}
      {scanning ? <QrScanner onScanned={scanned} onCancel={() => setScanning(false)} /> : (
        <>
          {discoveryError ? <StatusBanner tone="warn" title={errorMessage(discoveryError)} /> : null}
          <SectionLabel>{t.nearby}</SectionLabel>
          {tables.length === 0 && !discoveryError ? <Caption>{`${t.looking} ${t.none}`}</Caption> : null}
          {tables.map((tb) => (
            <NavRow key={tb.name} icon="⌁" title={tb.hostNickname ? t.hostTable(tb.hostNickname) : tb.name} caption={tb.game || undefined}
              onPress={() => {
                if (!isDialable(tb.host, tb.port)) return;
                clearError();
                router.push({ pathname: "/wifi/pin", params: { host: tb.host, port: String(tb.port) } });
              }} />
          ))}
          <GoldButton kind="glass" label={t.rescan} onPress={() => { clearError(); rescan(); }} />
          <Caption>{t.notListed}</Caption>
          <NavRow icon="≋" title={t.hotspot} onPress={() => router.push("/wifi/hotspot")} />
        </>
      )}
    </Screen>
  );
}

export function WifiPinScreen() {
  const { c, t: room } = useTheme();
  const params = useLocalSearchParams<{ host?: string; port?: string; pin?: string }>();
  const t = copy.pin;
  const { busy, message, join, clear } = useJoin();
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState(false);

  // A table picked from the nearby list arrives with its address; otherwise the player types the one on the host's screen.
  const picked = params.host && params.port && /^\d{1,5}$/.test(params.port) && isDialable(params.host, Number(params.port))
    ? { host: params.host, port: Number(params.port) } : null;
  const linkedPin = picked && typeof params.pin === "string" && isValidTablePin(params.pin) ? params.pin : null;
  const target = picked ?? parseHostAddress(address);

  const checkAddress = () => { if (!picked) setAddressError(address.trim() !== "" && !target); };
  const onPin = (pin: string) => {
    if (!target) { setAddressError(true); return; }
    setAddressError(false);
    clear();
    void join(target.host, target.port, pin);
  };

  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <Header title={t.title} />
        <Caption>{t.lead}</Caption>
        {!picked ? (
          <>
            <SectionLabel>{t.addressLabel}</SectionLabel>
            <View style={[s.field, { borderRadius: room.shape.radius, borderColor: addressError ? c.error : c.borderControl, backgroundColor: c.surface }]}>
              <TextInput value={address} placeholder={ADDRESS_EXAMPLE} placeholderTextColor={c.textMuted} accessibilityLabel={t.addressLabel}
                onChangeText={(v) => { setAddress(v.replace(/[^0-9.:]/g, "")); setAddressError(false); }}
                onBlur={checkAddress} onSubmitEditing={checkAddress}
                keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "visible-password"}
                autoCorrect={false} autoCapitalize="none" autoComplete="off" returnKeyType="done" maxLength={21}
                style={[s.input, { color: c.text }]} />
            </View>
            <Caption>{target ? t.addressHint : t.addressFirst}</Caption>
          </>
        ) : null}
        {addressError ? <StatusBanner tone="error" title={errorMessage("ADDRESS_INVALID")} /> : null}
        {busy ? <StatusBanner busy title={t.joining} /> : null}
        {message ? <StatusBanner tone="error" title={message} /> : null}
        {linkedPin && picked ? <GoldButton label={t.join} disabled={busy} onPress={() => { clear(); void join(picked.host, picked.port, linkedPin); }} /> : null}
        <Keypad digits={4} label={t.label} disabled={busy || !target} onComplete={onPin} />
        <Caption center>{t.lockout}</Caption>
      </Screen>
    </KeyboardAvoidingView>
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
      {t.steps.map((step, i) => <StepRow key={i} n={i + 1} title={step.t} body={step.b} />)}
      <Caption>{t.hostNote}</Caption>
      <Caption>{t.privacy}</Caption>
    </Screen>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  pinRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pinCard: { flex: 1 },
  field: { borderWidth: 1, minHeight: minTouchTarget, justifyContent: "center", paddingHorizontal: 14 },
  input: { fontFamily: fonts.ui.family, fontSize: 18, minHeight: minTouchTarget, letterSpacing: 1, writingDirection: "ltr", textAlign: "left" },
});
