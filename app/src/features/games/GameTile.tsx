import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, material } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "../../components/ui/GlassCard";
import { TagPill } from "../../components/ui/TagPill";
import { SuitBadge } from "../../components/ui/SuitBadge";
import type { GameEntry } from "../../types/game";
import { T, playable, playersText } from "./copy";

/** Home tile (mockup `.tile`): suit badge, name + badges, meta, description, feature chips, difficulty, play button. */
export function GameTile({ game, lastPlayed, onOpen, onPlay }: { game: GameEntry; lastPlayed?: boolean; onOpen: () => void; onPlay: () => void }) {
  const { c } = useTheme();
  const ready = playable(game);
  return (
    <GlassCard style={s.card}>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${game.name}, open game page`} onPress={onOpen} style={s.open}>
          <SuitBadge suit={game.suit ?? "D"} />
          <View style={s.text}>
            <View style={s.nameRow}>
              <Text style={[s.name, { color: c.text }]} numberOfLines={1}>{game.name}</Text>
              {lastPlayed && <Text style={{ color: material.goldLeaf }} accessibilityLabel={T.tile.last}>★</Text>}
              {lastPlayed && <TagPill text={T.tile.last} />}
            </View>
            <Text style={[s.meta, { color: c.textMuted }]}>
              {playersText(game)} {T.tile.players} · {game.teams ?? "Solo"} · {game.alias ?? game.region}
            </Text>
          </View>
        </Pressable>
        {ready ? (
          <Pressable accessibilityRole="button" accessibilityLabel={T.tile.play(game.name)} onPress={onPlay} style={s.play}>
            <Text style={s.playGlyph}>▶</Text>
          </Pressable>
        ) : (
          <Text style={[s.soon, { color: c.textMuted }]}>{T.tile.soon}</Text>
        )}
      </View>
      {game.description ? <Text style={[s.desc, { color: c.textSecondary }]}>{game.description}</Text> : null}
      <View style={s.tags}>
        {(game.tags ?? []).slice(0, 3).map((t) => <TagPill key={t} text={t} />)}
        {game.difficulty ? <Text style={[s.diff, { color: material.goldLeaf }]}>{game.difficulty}</Text> : null}
      </View>
    </GlassCard>
  );
}

const s = StyleSheet.create({
  card: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  open: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontFamily: fonts.display.family, fontSize: 22, fontWeight: "600" },
  meta: { fontFamily: fonts.ui.family, fontSize: 13 },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: material.btn2, alignItems: "center", justifyContent: "center" },
  playGlyph: { color: material.btnInk, fontSize: 16 },
  soon: { fontFamily: fonts.ui.family, fontSize: 13 },
  desc: { fontFamily: fonts.ui.family, fontSize: 14, lineHeight: 19 },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  diff: { marginLeft: "auto", fontFamily: fonts.ui.family, fontSize: 13, fontWeight: "600" },
});
