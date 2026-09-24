import React from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { CodeCard } from "../../components/ui/CodeCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { GAMES } from "../../constants/games";
import { useProfile } from "../../store/profile";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { useBackAction } from "../../hooks/useBackAction";
import { leaveSession, retryConnection, startTable } from "../multiplayer/session";
import { copy, errorMessage } from "../multiplayer/copy";
import { SeatList, type SeatEntry } from "../multiplayer/SeatList";
import { material, onTable, radius } from "../../theme/tokens";

export function WaitRoom() {
  const router = useRouter();
  const { profile } = useProfile();
  const session = useOnlineSession();
  const leave = () => { leaveSession(); router.replace("/"); };
  useBackAction(leave, session.phase === "lobby" || session.phase === "queued");

  const game = GAMES.find((g) => g.profile === session.profileId);
  const wifi = session.transport === "wifi";
  if (wifi && session.isHost && session.phase !== "idle") return <Redirect href="/wifi/host" />;
  if (session.phase === "playing") return <Redirect href={{ pathname: "/online/[game]", params: { game: game?.id ?? "" } }} />;
  if (session.phase === "ended") return <Redirect href="/match" />;
  if (session.phase === "idle") return wifi ? <Redirect href="/wifi/join" /> : <Redirect href={{ pathname: "/room", params: { game: game?.id ?? "" } }} />;

  if (!wifi && (session.phase === "queued" || (session.phase === "connecting" && !session.roomCode))) {
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
  const canStart = session.isHost && session.conn === "open" && !session.updateRequired;

  return (
    <Screen footer={<>
      {session.isHost ? <GoldButton label={t.startBots} disabled={!canStart} onPress={startTable} /> : <Caption center>{t.guestWaiting}</Caption>}
      <GoldButton kind="glass" label={wifi ? t.wifiLeave : t.leave} onPress={leave} />
    </>}>
      <Header title={wifi ? t.wifiTitle : `${t.titlePrefix}${code}`} back={false} />
      {session.updateRequired ? <StatusBanner tone="warn" title={copy.update.title} body={copy.update.body} /> : null}
      {session.conn === "reconnecting" ? <StatusBanner busy tone="warn" title={copy.reconnecting.title} body={copy.reconnecting.body}>
        <GoldButton kind="glass" label="Try again" onPress={retryConnection} /></StatusBanner> : null}
      {session.error ? <StatusBanner tone="error" title={errorMessage(session.error)} /> : null}
      {wifi ? null : <CodeCard label={t.shareLabel} code={code} actionLabel={t.share}
        onAction={() => { Share.share({ message: t.shareMessage(code, game?.name ?? "card") }).catch(() => {}); }} />}

      <View style={s.miniStageContainer}>
        <View style={s.miniWalnutRail}>
          <View style={s.miniFeltCloth}>
            <Text style={s.gameBadge}>{game?.name ?? "TashZone"}</Text>
            <View style={s.miniSeatsRow}>
              {seats.map((seat, i) => (
                <View key={i} style={[s.miniSeatBubble, seat.ok && s.miniSeatBubbleFilled]}>
                  <Text style={[s.miniSeatText, seat.ok && s.miniSeatTextFilled]}>
                    {seat.ok ? (seat.name ? seat.name.slice(0, 1).toUpperCase() : `${i + 1}`) : "?"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      <SeatList seats={seats} openName={t.openName} />
      <Caption>{wifi ? t.wifiGuestChat : profile.protectedMode || !profile.parent.text ? t.chatOff : t.chat}</Caption>
    </Screen>
  );
}

const s = StyleSheet.create({
  miniStageContainer: {
    height: 94,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  miniWalnutRail: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: material.walnut,
    borderWidth: 1.5,
    borderColor: material.walnutLit,
    padding: 5,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  miniFeltCloth: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: material.felt,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  gameBadge: {
    color: onTable.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  miniSeatsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  miniSeatBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(227, 189, 110, 0.4)",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniSeatBubbleFilled: {
    borderStyle: "solid",
    borderColor: onTable.gold,
    backgroundColor: onTable.gold,
    shadowColor: onTable.gold,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  miniSeatText: {
    fontSize: 10,
    fontWeight: "700",
    color: onTable.secondary,
  },
  miniSeatTextFilled: {
    color: material.btnInk,
  },
});
