import React, { useState } from "react";
import { Linking, Platform, Share } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { CodeCard } from "../../components/ui/CodeCard";
import { ConfirmSheet } from "../../components/ui/ConfirmSheet";
import { GoldButton } from "../../components/ui/GoldButton";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { GAMES } from "../../constants/games";
import { useProfile } from "../../store/profile";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { useBackAction } from "../../hooks/useBackAction";
import { leaveSession, retryConnection, startTable } from "../multiplayer/session";
import { copy, errorMessage } from "../multiplayer/copy";
import { KeepAwake } from "../multiplayer/KeepAwake";
import { SeatList, type SeatEntry } from "../multiplayer/SeatList";

const STORE_URL = "market://details?id=com.tashzone.app";

export function WaitRoom() {
  const router = useRouter();
  const { profile } = useProfile();
  const session = useOnlineSession();
  const [confirm, setConfirm] = useState(false);
  const leave = () => { setConfirm(false); leaveSession(); router.replace("/"); };
  const queued = session.transport === "online" && (session.phase === "queued" || (session.phase === "connecting" && !session.roomCode));
  useBackAction(() => (queued ? leave() : setConfirm(true)), session.phase === "lobby" || session.phase === "queued" || session.phase === "connecting");

  const game = GAMES.find((g) => g.profile === session.profileId);
  const wifi = session.transport === "wifi";
  if (wifi && session.isHost && session.phase !== "idle") return <Redirect href="/wifi/host" />;
  if (session.phase === "playing") return <Redirect href={{ pathname: "/online/[game]", params: { game: game?.id ?? "" } }} />;
  if (session.phase === "ended") return <Redirect href="/match" />;
  if (session.phase === "idle") return wifi ? <Redirect href="/wifi/join" /> : <Redirect href={{ pathname: "/room", params: { game: game?.id ?? "" } }} />;

  if (queued) {
    const q = copy.queue;
    return (
      <Screen footer={<GoldButton kind="glass" label={q.cancel} onPress={leave} />}>
        <Header title={q.title} back={false} />
        <StatusBanner busy title={q.finding} body={session.queue ? [session.queue.position ? q.position(session.queue.position) : "", q.backfill(session.queue.backfillIn)].join(" ").trim() : undefined} />
      </Screen>
    );
  }

  const code = session.roomCode ?? "";
  const t = copy.lobby;
  const mySeat = session.seat;
  const hostSeat = session.isHost ? mySeat : null;
  const seats: SeatEntry[] = Array.from({ length: session.seatCount }, (_, i) => {
    const name = session.members[i] ?? null;
    if (name === null) return { name: null, status: t.openState };
    return { name: i === mySeat ? profile.name || name : name, status: i === hostSeat ? t.hostState : t.ready, ok: true };
  });
  const connecting = session.phase === "connecting" || session.conn === "connecting" || session.conn === null;
  const canStart = session.isHost && session.conn === "open" && !session.updateRequired;

  return (
    <Screen footer={<>
      {session.isHost ? <GoldButton label={t.startBots} disabled={!canStart} onPress={startTable} /> : <Caption center>{t.guestWaiting}</Caption>}
      <GoldButton kind="glass" label={wifi ? t.wifiLeave : t.leave} onPress={() => setConfirm(true)} />
    </>}>
      <KeepAwake />
      <Header title={wifi ? t.wifiTitle : t.title(code)} back={false} />
      {session.updateRequired ? (
        <StatusBanner tone="warn" title={copy.update.title} body={copy.update.body}>
          {Platform.OS === "android" ? <GoldButton label={copy.table.openStore} onPress={() => { Linking.openURL(STORE_URL).catch(() => {}); }} /> : null}
        </StatusBanner>
      ) : session.conn === "offline" ? (
        <StatusBanner tone="error" title={copy.offline.title} body={copy.offline.body}>
          <GoldButton kind="glass" label={copy.table.tryAgain} onPress={retryConnection} />
        </StatusBanner>
      ) : session.conn === "reconnecting" ? (
        <StatusBanner busy tone="warn" title={copy.reconnecting.title} body={copy.reconnecting.body}>
          <GoldButton kind="glass" label={copy.table.tryAgain} onPress={retryConnection} />
        </StatusBanner>
      ) : connecting ? <StatusBanner busy title={t.connecting.title} body={t.connecting.body} /> : null}
      {session.error ? <StatusBanner tone="error" title={errorMessage(session.error)} /> : null}
      {wifi ? null : <CodeCard label={t.shareLabel} code={code} actionLabel={t.share}
        onAction={() => { Share.share({ message: t.shareMessage(code, game?.name ?? "") }).catch(() => {}); }} />}
      <SeatList seats={seats} openName={t.openName} />
      <Caption>{wifi ? t.wifiGuestChat : profile.protectedMode || !profile.parent.text ? t.chatOff : t.chat}</Caption>
      <ConfirmSheet visible={confirm} title={t.leaveTitle} facts={t.leaveFacts(wifi)} confirmLabel={wifi ? t.wifiLeave : t.leave} cancelLabel={t.stay}
        onConfirm={leave} onCancel={() => setConfirm(false)} />
    </Screen>
  );
}
