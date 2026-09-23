import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SeatMove } from "@tashzone/engine";
import { BOT_NAMES, type BotLevel } from "@tashzone/engine";
import { compile } from "@tashzone/engine";
import { LocalTable } from "@tashzone/match";
import { TableScreen } from "./table/TableScreen";
import { fonts, material, onTable, radius } from "../../design/tokens";
import { ERROR_MESSAGES, GENERIC_ERROR, SETUP } from "./games";
import { randomSeedHex } from "../../platform/random";

interface Choice { preset: string; length: number; players: number; level: BotLevel; handicap: number }

/** Setup sheet (v1 choices: preset, length, players, bot strength, handicap) then the table. */
export function OfflineTable({ profileId, onExit }: { profileId: string; onExit: () => void }) {
  const info = SETUP[profileId]!;
  const [choice, setChoice] = useState<Choice | null>(null);
  const [draft, setDraft] = useState<Choice>({ preset: info.presets[0]!.id, length: info.defaultLength, players: 4, level: "medium", handicap: 0 });
  if (!choice) return <Setup profileId={profileId} draft={draft} setDraft={setDraft} onStart={() => setChoice(draft)} onExit={onExit} />;
  return <Table profileId={profileId} choice={choice} onExit={onExit} onNew={() => setChoice(null)} />;
}

function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.group}>
      <Text style={s.groupLabel}>{label}</Text>
      <View style={s.chips}>
        {options.map((o) => (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" accessibilityState={{ selected: o.value === value }}
            style={[s.chip, o.value === value && s.chipOn]}>
            <Text style={[s.chipText, o.value === value && s.chipTextOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Setup({ profileId, draft, setDraft, onStart, onExit }: { profileId: string; draft: Choice; setDraft: (c: Choice) => void; onStart: () => void; onExit: () => void }) {
  const info = SETUP[profileId]!;
  const preset = info.presets.find((p) => p.id === draft.preset)!;
  return (
    <ScrollView style={{ backgroundColor: material.feltRim }} contentContainerStyle={s.setup}>
      <Text style={s.title}>New table</Text>
      <Chips label="Rules" options={info.presets.map((p) => ({ value: p.id, label: p.label }))} value={draft.preset} onChange={(v) => setDraft({ ...draft, preset: v })} />
      <Text style={s.hint}>{preset.hint}</Text>
      <Chips label={info.lengthLabel} options={info.lengths.map((l, i) => ({ value: i, label: l.label }))} value={draft.length} onChange={(v) => setDraft({ ...draft, length: v })} />
      {info.players && <Chips label="Players" options={info.players.map((n) => ({ value: n, label: String(n) }))} value={draft.players} onChange={(v) => setDraft({ ...draft, players: v })} />}
      <Chips label="Bots" options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} value={draft.level} onChange={(v) => setDraft({ ...draft, level: v as BotLevel })} />
      {info.handicaps && <Chips label="Deal" options={info.handicaps.map((h) => ({ value: h.value, label: h.label }))} value={draft.handicap} onChange={(v) => setDraft({ ...draft, handicap: v })} />}
      <View style={s.row}>
        <Pressable onPress={onExit} accessibilityRole="button" style={s.quiet}><Text style={s.quietText}>Back</Text></Pressable>
        <Pressable onPress={onStart} accessibilityRole="button" style={s.primary}><Text style={s.primaryText}>Deal</Text></Pressable>
      </View>
    </ScrollView>
  );
}

function Table({ profileId, choice, onExit, onNew }: { profileId: string; choice: Choice; onExit: () => void; onNew: () => void }) {
  const info = SETUP[profileId]!;
  const table = useMemo(() => {
    const settings: Record<string, unknown> = { ...info.lengths[choice.length]!.settings };
    if (info.players) settings.players = choice.players;
    if (info.handicaps) settings.handicap = choice.handicap;
    const c = compile(profileId, settings, choice.preset);
    if (!c.ok) throw new Error(c.error);
    return new LocalTable(c.rules, {
      randomSeed: randomSeedHex, botLevel: choice.level,
      asyncBots: { now: () => Date.now(), yieldToHost: () => new Promise((r) => setTimeout(r, 0)), maxMs: 1500, sliceMs: 12 },
    });
  }, [profileId, choice, info]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [view, setView] = useState<any>(table.view());
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { const off = table.subscribe((v) => setView(v)); table.start(); return () => { off(); table.dispose(); }; }, [table]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }, [toast]);
  const names = ["You", ...Array.from({ length: table.seats - 1 }, (_, i) => BOT_NAMES[i % BOT_NAMES.length]!)];
  const move = (m: SeatMove) => {
    if (table.play(m)) return;
    const code = table.explain(m);
    setToast(code ? ERROR_MESSAGES[code] ?? GENERIC_ERROR : GENERIC_ERROR);
  };
  const hint = () => {
    const h = table.hint();
    setToast(!h ? "Nothing to play right now" : h.t === "Play" ? `Try ${h.card}` : h.t === "Call" ? `Try calling ${h.n}` : h.t === "ChooseTrump" ? `Try ${h.suit} as trump` : "Wait for the window");
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={s.bar}>
        <Pressable onPress={onExit} accessibilityRole="button" style={s.barBtn}><Text style={s.barText}>Leave</Text></Pressable>
        <Pressable onPress={hint} accessibilityRole="button" accessibilityLabel="Hint" style={s.barBtn}><Text style={s.barText}>Hint</Text></Pressable>
        <Pressable onPress={() => table.undo()} disabled={!table.canUndo()} accessibilityRole="button" accessibilityLabel="Undo last move (offline only)" style={s.barBtn}>
          <Text style={[s.barText, !table.canUndo() && { opacity: 0.5 }]}>Undo</Text>
        </Pressable>
        {view.match.over && <Pressable onPress={onNew} accessibilityRole="button" style={s.barBtn}><Text style={s.barText}>New table</Text></Pressable>}
      </View>
      <TableScreen view={view} names={names} onMove={move} />
      {toast && <View style={s.toast} accessibilityLiveRegion="assertive"><Text style={s.toastText}>{toast}</Text></View>}
    </View>
  );
}

const s = StyleSheet.create({
  setup: { padding: 20, paddingTop: 56, gap: 16 },
  title: { color: onTable.gold, fontFamily: fonts.display.family, fontSize: 32, fontWeight: "600" },
  group: { gap: 8 },
  groupLabel: { color: onTable.secondary, fontFamily: fonts.ui.family, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: radius.control, borderWidth: 1.5, borderColor: material.goldLeafDim },
  chipOn: { borderColor: onTable.gold, backgroundColor: "rgba(232,195,106,0.18)" },
  chipText: { color: onTable.text, fontFamily: fonts.ui.family, fontSize: 15 },
  chipTextOn: { color: onTable.gold, fontWeight: "600" },
  hint: { color: onTable.secondary, fontSize: 14, marginTop: -8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  primary: { minHeight: 48, paddingHorizontal: 28, borderRadius: radius.control, backgroundColor: onTable.gold, justifyContent: "center" },
  primaryText: { color: "#1B1D21", fontSize: 17, fontWeight: "700" },
  quiet: { minHeight: 48, paddingHorizontal: 20, justifyContent: "center" },
  quietText: { color: onTable.gold, fontSize: 17 },
  bar: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#03110d", paddingHorizontal: 12, paddingTop: 44 },
  barBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  barText: { color: onTable.gold, fontSize: 17, fontWeight: "600" },
  toast: { position: "absolute", bottom: 120, alignSelf: "center", backgroundColor: "rgba(3,17,13,0.95)", borderRadius: radius.control, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: onTable.gold },
  toastText: { color: onTable.text, fontSize: 16 },
});
