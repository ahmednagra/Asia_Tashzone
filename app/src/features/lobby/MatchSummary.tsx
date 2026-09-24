/** Mockup `match`: online match over / interrupted, standings from the server's MatchEnded result. */
import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Caption } from "../../components/ui/Caption";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { GAMES } from "../../constants/games";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { useOnlineSession } from "../../hooks/useOnlineSession";
import { leaveSession } from "../multiplayer/session";
import { standings } from "../multiplayer/standings";
import { copy } from "../multiplayer/copy";

export function MatchSummary() {
  const { c, t: room } = useTheme();
  const router = useRouter();
  const { recordResult } = useProfile();
  const session = useOnlineSession();
  const ended = session.ended;
  const rows = standings(ended?.result ?? null, session.names, session.seat);
  const game = GAMES.find((g) => g.profile === session.profileId);
  const me = rows.find((r) => r.you);
  const recorded = useRef(false);

  // A completed match is counted once; an interrupted one counts as neither win nor loss.
  useEffect(() => {
    if (!ended || ended.outcome !== "completed" || recorded.current || !game) return;
    recorded.current = true;
    recordResult(game.id, me?.place === 1, game.id === "bhabhi" && me?.place === rows.length && rows.length > 1);
  }, [ended, game, me, rows.length, recordResult]);

  if (!ended) return <Redirect href="/" />;
  const t = copy.match;
  const interrupted = ended.outcome === "interrupted";
  const winner = rows.find((r) => r.place === 1);
  const back = () => { leaveSession(); router.replace("/"); };

  return (
    <Screen footer={<GoldButton label={t.back} onPress={back} />}>
      <Header title={interrupted ? t.interrupted : t.over} back={false} />
      {interrupted ? (
        <StatusBanner tone="warn" title={t.interruptedTitle} body={t.interruptedBody} />
      ) : winner ? (
        <GlassCard style={s.winner}>
          <Caption>{t.winner.toUpperCase()}</Caption>
          <Text style={[s.name, { color: room.accent.color, fontFamily: room.type.display }]}>{winner.you ? t.you : winner.name}</Text>
          {me?.place ? <Caption>{t.placed(me.place, rows.length)}</Caption> : null}
        </GlassCard>
      ) : null}
      {rows.length > 0 ? (
        <>
          <SectionLabel>{t.standings}</SectionLabel>
          <GlassCard style={s.table}>
            {rows.map((r) => (
              <View key={r.seat} style={s.row} accessible accessibilityLabel={`${r.place ? `Place ${r.place}, ` : ""}${r.you ? t.you : r.name}, ${r.score}`}>
                <Text style={[s.place, { color: c.textMuted }]}>{r.place ?? "–"}</Text>
                <Text style={[s.who, { color: c.text }]} numberOfLines={1}>{r.you ? t.you : r.name}</Text>
                <Text style={[s.score, { color: c.textSecondary }]}>{r.score}</Text>
              </View>
            ))}
          </GlassCard>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  winner: { alignItems: "center", gap: 4 },
  name: { fontFamily: fonts.display.family, fontSize: 32 },
  table: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  place: { width: 22, fontFamily: fonts.ui.family, fontSize: 15 },
  who: { flex: 1, fontFamily: fonts.ui.family, fontSize: 16 },
  score: { fontFamily: fonts.ui.family, fontSize: 16, fontVariant: ["tabular-nums"] },
});
