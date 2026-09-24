import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { Header } from "../../components/ui/Header";
import { Chip } from "../../components/ui/Chip";
import { GoldButton } from "../../components/ui/GoldButton";
import { GlassCard } from "../../components/ui/GlassCard";
import { SearchField } from "../../components/ui/SearchField";
import { fonts } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { useGameNav } from "../../hooks/useGameNav";
import { GAMES } from "../../constants/games";
import type { GameEntry } from "../../types/game";
import { GameTile } from "./GameTile";
import { T, playable } from "./copy";

type Filter = "all" | "play" | "soon";
const FILTERS: Filter[] = ["all", "play", "soon"];

const haystack = (g: GameEntry) => [g.name, g.alias, g.region, g.description, ...(g.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
const matches = (g: GameEntry, f: Filter) => f === "all" || (f === "play") === playable(g);

/** Full catalogue (mockup "games"): search, filters, one tile per game. */
export function GamesScreen() {
  const { c } = useTheme();
  const { profile } = useProfile();
  const nav = useGameNav();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GAMES.filter((g) => (!needle || haystack(g).includes(needle)) && matches(g, filter));
  }, [q, filter]);
  return (
    <Screen>
      <Header back={false} title={T.games.title} right={<Text style={[s.count, { color: c.textMuted }]}>{T.games.count(shown.length, GAMES.length)}</Text>} />
      <SearchField value={q} onChangeText={setQ} placeholder={T.games.placeholder} label={T.games.search} />
      <View accessibilityRole="radiogroup" style={s.filters}>
        {FILTERS.map((f) => <Chip key={f} label={`${T.games.filters[f]} ${GAMES.filter((g) => matches(g, f)).length}`} on={filter === f} onPress={() => setFilter(f)} />)}
      </View>
      {shown.map((g) => <GameTile key={g.id} game={g} lastPlayed={g.id === profile.recent[0]} onOpen={() => nav.open(g)} onPlay={() => nav.deal(g)} />)}
      {shown.length === 0 && (
        <GlassCard style={s.empty}>
          <Text style={[s.emptyTitle, { color: c.text }]}>{T.games.emptyTitle(q.trim())}</Text>
          <Text style={[s.emptyHint, { color: c.textMuted }]}>{T.games.emptyHint}</Text>
          <GoldButton kind="glass" label={T.games.showAll} onPress={() => { setQ(""); setFilter("all"); }} />
        </GlassCard>
      )}
    </Screen>
  );
}
const s = StyleSheet.create({
  count: { fontFamily: fonts.ui.family, fontSize: 13 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  empty: { alignItems: "center", gap: 8, padding: 18 },
  emptyTitle: { fontFamily: fonts.display.family, fontSize: 20, textAlign: "center" },
  emptyHint: { fontFamily: fonts.ui.family, fontSize: 14, textAlign: "center" },
});
