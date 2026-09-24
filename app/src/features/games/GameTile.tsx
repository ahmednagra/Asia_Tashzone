import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fonts, type ThemeSpec } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { GlassCard } from "../../components/ui/GlassCard";
import { TagPill } from "../../components/ui/TagPill";
import { SuitBadge } from "../../components/ui/SuitBadge";
import { ButtonFace } from "../../components/ui/GoldButton";
import type { GameEntry } from "../../types/game";
import { T, difficultyText, playable, playersText } from "./copy";

type TileProps = { game: GameEntry; lastPlayed?: boolean; compact?: boolean; onOpen: (g: GameEntry) => void; onPlay: (g: GameEntry) => void };

const titleStyle = (t: ThemeSpec, size: number) => ({
  fontFamily: t.type.display, letterSpacing: t.type.tracking, textTransform: t.type.titleCase,
  fontSize: t.type.titleCase === "uppercase" ? size - 3 : size,
});

function PlayButton({ game, onPlay }: { game: GameEntry; onPlay: (g: GameEntry) => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={T.tile.play(game.name)} onPress={() => onPlay(game)}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <ButtonFace t={t} style={s.play}>
        <Text style={[s.playGlyph, { color: t.button.ink }]}>▶</Text>
      </ButtonFace>
    </Pressable>
  );
}

/** Home tile (mockup `.tile`): suit badge, name + badges, meta, description, feature chips, difficulty, play button. */
function GameTileView({ game, lastPlayed, compact, onOpen, onPlay }: TileProps) {
  const { c, t } = useTheme();
  const ready = playable(game);
  const meta = `${T.tile.players(playersText(game))} · ${game.teams ?? T.tile.solo} · ${game.alias ?? game.region}`;
  if (compact) {
    return (
      <GlassCard style={s.compact}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${T.tile.open(game.name)}${lastPlayed ? `, ${T.tile.last}` : ""}`} onPress={() => onOpen(game)} style={s.open}>
          <SuitBadge suit={game.suit ?? "D"} size={36} />
          <View style={s.text}>
            <View style={s.nameRow}>
              <Text style={[s.nameCompact, titleStyle(t, 19), { color: c.text }]} numberOfLines={1}>{game.name}</Text>
              {lastPlayed ? <Text style={[s.star, { color: t.accent.color }]} importantForAccessibility="no" accessibilityElementsHidden>★</Text> : null}
            </View>
            <Text style={[s.meta, { color: c.textMuted }]} numberOfLines={1}>{meta}</Text>
          </View>
        </Pressable>
        {ready ? <PlayButton game={game} onPlay={onPlay} /> : <Text style={[s.soon, { color: c.textMuted }]}>{T.tile.soon}</Text>}
      </GlassCard>
    );
  }
  return (
    <GlassCard style={s.card}>
      <View style={s.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${T.tile.open(game.name)}${lastPlayed ? `, ${T.tile.last}` : ""}`} onPress={() => onOpen(game)} style={s.open}>
          <SuitBadge suit={game.suit ?? "D"} />
          <View style={s.text}>
            <View style={s.nameRow}>
              <Text style={[titleStyle(t, 22), { color: c.text }]} numberOfLines={1}>{game.name}</Text>
              {lastPlayed ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><TagPill gold text={T.tile.last} /></View> : null}
            </View>
            <Text style={[s.meta, { color: c.textMuted }]}>{meta}</Text>
          </View>
        </Pressable>
        {ready ? <PlayButton game={game} onPlay={onPlay} /> : <Text style={[s.soon, { color: c.textMuted }]}>{T.tile.soon}</Text>}
      </View>
      {game.description ? <Text style={[s.desc, { color: c.textSecondary }]}>{game.description}</Text> : null}
      <View style={s.tags}>
        {(game.tags ?? []).slice(0, 3).map((tag) => <TagPill key={tag} text={tag} />)}
        {game.difficulty ? <Text style={[s.diff, { color: c.textSecondary }]}>{difficultyText(game)}</Text> : null}
      </View>
    </GlassCard>
  );
}

export const GameTile = memo(GameTileView);

const s = StyleSheet.create({
  card: { gap: 8 },
  compact: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, minHeight: 64 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  open: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  nameCompact: { flexShrink: 1 },
  star: { fontSize: 14 },
  meta: { fontFamily: fonts.ui.family, fontSize: 13 },
  play: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  playGlyph: { fontSize: 16 },
  soon: { fontFamily: fonts.ui.family, fontSize: 13 },
  desc: { fontFamily: fonts.ui.family, fontSize: 14, lineHeight: 19 },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  diff: { marginStart: "auto", fontFamily: fonts.ui.semibold, fontSize: 13 },
});
