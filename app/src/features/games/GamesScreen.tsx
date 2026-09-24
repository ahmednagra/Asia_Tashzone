import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
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
const HAYSTACKS = new Map(GAMES.map((g) => [g.id, haystack(g)]));
const COUNTS = Object.fromEntries(FILTERS.map((f) => [f, GAMES.filter((g) => matches(g, f)).length])) as Record<Filter, number>;
const keyOf = (g: GameEntry) => g.id;

/** Full catalogue (mockup "games"): search, filters, one tile per game. */
export function GamesScreen() {
  const { c, t } = useTheme();
  const { profile } = useProfile();
  const { open, deal } = useGameNav();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => GAMES.filter((g) => (!needle || HAYSTACKS.get(g.id)!.includes(needle)) && matches(g, filter)), [needle, filter]);
  const last = profile.recent[0];
  const renderItem = useCallback(({ item }: { item: GameEntry }) => <GameTile game={item} lastPlayed={item.id === last} onOpen={open} onPlay={deal} />, [last, open, deal]);
  const showAll = useCallback(() => { setQ(""); setFilter("all"); }, []);

  const head = (
    <View style={[s.sticky, { backgroundColor: c.bg }]}>
      <SearchField value={q} onChangeText={setQ} placeholder={T.games.placeholder} label={T.games.search} />
      <View accessibilityRole="radiogroup" style={s.filters}>
        {FILTERS.map((f) => <Chip key={f} label={`${T.games.filters[f]} ${COUNTS[f]}`} on={filter === f} onPress={() => setFilter(f)} />)}
      </View>
    </View>
  );
  const empty = (
    <GlassCard style={s.empty}>
      <Text style={[s.emptyTitle, { color: c.text, fontFamily: t.type.display }]}>{needle ? T.games.emptyTitle(q.trim()) : T.games.emptyFilterTitle}</Text>
      <Text style={[s.emptyHint, { color: c.textMuted }]}>{needle ? T.games.emptyHint : T.games.emptyFilterHint}</Text>
      <GoldButton kind="glass" label={T.games.showAll} onPress={showAll} />
    </GlassCard>
  );
  return (
    <Screen scroll={false}>
      <Header back={false} title={T.games.title} right={<Text style={[s.count, { color: c.textMuted }]}>{T.games.count(shown.length, GAMES.length)}</Text>} />
      <FlatList
        style={s.list}
        data={shown}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={head}
        stickyHeaderIndices={[0]}
        ListEmptyComponent={empty}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        windowSize={5}
      />
    </Screen>
  );
}
const s = StyleSheet.create({
  count: { fontFamily: fonts.ui.family, fontSize: 13 },
  list: { flex: 1, marginHorizontal: -16 },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  sticky: { gap: 12, paddingBottom: 4, marginHorizontal: -16, paddingHorizontal: 16 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  empty: { alignItems: "center", gap: 8, padding: 18 },
  emptyTitle: { fontSize: 20, textAlign: "center" },
  emptyHint: { fontFamily: fonts.ui.family, fontSize: 14, textAlign: "center" },
});
