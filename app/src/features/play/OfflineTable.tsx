import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import type { SeatMove } from "@tashzone/engine";
import { BOT_NAMES, compile } from "@tashzone/engine";
import { LocalTable } from "@tashzone/match";
import { ChipGroup } from "../../components/ui/ChipGroup";
import { Caption } from "../../components/ui/Caption";
import { GoldButton } from "../../components/ui/GoldButton";
import { Header } from "../../components/ui/Header";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { Screen } from "../../components/ui/Screen";
import { useProfile } from "../../store/profile";
import { useTheme } from "../../context/ThemeContext";
import { PLAY } from "./copy";
import { ERROR_MESSAGES, GAMES, GENERIC_ERROR, SETUP } from "../../constants/games";
import { randomSeedHex } from "../../utils/random";
import { type Outcome, clearOutcome, publishOutcome } from "./session";
import { gameResult, handResult } from "./result/model";
import type { SetupInfo } from "../../types/game";
import { BOT_LEVELS, type Choice, defaultChoice, describeChoice, settingsFor } from "./setup";
import { TableScreen } from "./table/TableScreen";

/** Marks the between-hands wait: the shell asks to schedule the next deal after this many ms; we hold it until the player asks. */
const HOLD_MS = 2_147_000_000;
const RESULT_DELAY_MS = 1100;
const TOAST_MS = 2500;

/** Setup sheet (choices: preset, length, players, bot strength, deal) then the table. `initial` skips the sheet (deep link). */
export function OfflineTable({ gameId, profileId, initial, onExit }: { gameId: string; profileId: string; initial?: Choice | null; onExit: () => void }) {
  const info = SETUP[profileId];
  const [choice, setChoice] = useState<Choice | null>(initial ?? null);
  const [draft, setDraft] = useState<Choice | null>(() => (info ? initial ?? defaultChoice(info) : null));
  const [error, setError] = useState<string | null>(null);
  const compiled = useMemo(() => {
    if (!info || !choice) return null;
    try {
      return compile(profileId, settingsFor(info, choice), choice.preset);
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [info, choice, profileId]);
  useEffect(() => {
    if (compiled && !compiled.ok) {
      setError("setup");
      setChoice(null);
    }
  }, [compiled]);
  if (!info || !draft) return <Redirect href="/" />;
  if (!choice || !compiled?.ok) {
    return <Setup info={info} draft={draft} setDraft={setDraft} error={error} onStart={() => { setError(null); setChoice(draft); }} />;
  }
  return <Table gameId={gameId} info={info} rules={compiled.rules} choice={choice} onExit={onExit} onNew={() => setChoice(null)} />;
}

function Setup({ info, draft, setDraft, error, onStart }: { info: SetupInfo; draft: Choice; setDraft: (c: Choice) => void; error: string | null; onStart: () => void }) {
  useTheme();
  const preset = info.presets.find((p) => p.id === draft.preset) ?? info.presets[0]!;
  return (
    <Screen footer={<GoldButton label={PLAY.deal} onPress={onStart} />}>
      <Stack.Screen options={{ gestureEnabled: true }} />
      <Header title={PLAY.newTable} />
      {error ? <StatusBanner tone="warn" title={PLAY.couldNotStart} body={PLAY.couldNotSetUp} /> : null}
      <ChipGroup label={PLAY.rules} value={draft.preset} onChange={(v) => setDraft({ ...draft, preset: v })} options={info.presets.map((p) => ({ value: p.id, label: p.label }))} />
      <Caption>{preset.hint}</Caption>
      <ChipGroup label={info.lengthLabel} value={draft.length} onChange={(v) => setDraft({ ...draft, length: v })} options={info.lengths.map((l, i) => ({ value: i, label: l.label }))} />
      {info.players ? <ChipGroup label={PLAY.players} value={draft.players} onChange={(v) => setDraft({ ...draft, players: v })} options={info.players.map((n) => ({ value: n, label: String(n) }))} /> : null}
      <ChipGroup label={PLAY.bots} value={draft.level} onChange={(v) => setDraft({ ...draft, level: v })} options={BOT_LEVELS.map((l) => ({ value: l.value, label: l.label }))} />
      {info.handicaps ? <ChipGroup label={PLAY.dealRow} value={draft.handicap} onChange={(v) => setDraft({ ...draft, handicap: v })} options={info.handicaps.map((h) => ({ value: h.value, label: h.label }))} /> : null}
    </Screen>
  );
}

type Rules = Extract<ReturnType<typeof compile>, { ok: true }>["rules"];

function Table({ gameId, info, rules, choice, onExit, onNew }: { gameId: string; info: SetupInfo; rules: Rules; choice: Choice; onExit: () => void; onNew: () => void }) {
  const router = useRouter();
  const { profile, recordResult } = useProfile();
  useTheme();
  const [run, setRun] = useState(0);
  const held = useRef<(() => void) | null>(null);

  const table = useMemo(() => {
    held.current = null;
    return new LocalTable(rules, {
      randomSeed: randomSeedHex, botLevel: choice.level, interHandMs: HOLD_MS,
      schedule: (fn, ms) => {
        if (ms === HOLD_MS) { held.current = fn; return () => { if (held.current === fn) held.current = null; }; }
        const t = setTimeout(fn, ms);
        return () => clearTimeout(t);
      },
      asyncBots: { now: () => Date.now(), yieldToHost: () => new Promise((r) => setTimeout(r, 0)), maxMs: 1500, sliceMs: 12 },
    });
    // `run` rebuilds the table for "Deal again"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, choice, run]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [view, setView] = useState<any>(table.view());
  const viewRef = useRef(view);
  viewRef.current = view;
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { const off = table.subscribe((v) => setView(v)); table.start(); return () => { off(); table.dispose(); }; }, [table]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), TOAST_MS); return () => clearTimeout(t); }, [toast]);

  const you = PLAY.you;
  const names = useMemo(() => [profile.name.trim() || you, ...Array.from({ length: table.seats - 1 }, (_, i) => BOT_NAMES[i % BOT_NAMES.length]!)], [profile.name, table.seats, you]);
  const gameName = GAMES.find((g) => g.id === gameId)?.name ?? gameId;

  const move = (m: SeatMove) => {
    if (table.play(m)) return;
    const code = table.explain(m);
    setToast(code ? ERROR_MESSAGES[code] ?? GENERIC_ERROR : GENERIC_ERROR);
  };
  const autoplay = () => {
    const legal: readonly SeatMove[] = viewRef.current.legal ?? [];
    let m: SeatMove | null = null;
    try { m = table.hint(); } catch { m = null; }
    m = m ?? legal.find((x) => x.t === "Play") ?? legal[0] ?? null;
    if (m && table.play(m)) setToast(PLAY.autoPlayed);
  };
  const release = useCallback(() => { const f = held.current; held.current = null; f?.(); }, []);

  /* ── the deal is held between hands; an annulled hand is simply dealt again ── */
  const h = view.hand;
  const between = view.waiting.mode === "AUTO" && h?.phase === "DONE" && !h.annulled && !view.match.over;
  useEffect(() => {
    if (view.waiting.mode !== "AUTO" || !h?.annulled) return;
    const t = setTimeout(release, 1500);
    return () => clearTimeout(t);
  }, [view.waiting.mode, h?.annulled, h?.hand_id, release]);

  /* ── results: recorded once when the match ends; screens are pushed a beat after a hand ends ── */
  const recorded = useRef(false);
  useEffect(() => { recorded.current = false; }, [table]);
  useEffect(() => {
    if (!view.match.over || recorded.current) return;
    recorded.current = true;
    const g = gameResult(view, names);
    if (g) recordResult(gameId, g.won, g.lostBhabhi);
  }, [view, names, gameId, recordResult]);

  const published = useRef<Outcome | null>(null);
  const publish = (o: Outcome) => { if (published.current) clearOutcome(published.current); published.current = o; publishOutcome(o); };
  useEffect(() => () => { if (published.current) clearOutcome(published.current); }, []);

  const showGame = useCallback(() => {
    const g = gameResult(viewRef.current, names);
    if (g) publish({ kind: "game", data: g, onAgain: () => setRun((r) => r + 1), onLeave: onExit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, onExit]);
  const showResult = useCallback(() => {
    const v = viewRef.current;
    const data = handResult(v, names);
    if (!data) { showGame(); router.push("/result/game"); return; }
    publish({ kind: "hand", data, onNext: () => (v.match.over ? showGame() : release()), onLeave: onExit });
    router.push("/result/hand");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, onExit, release, showGame, router]);

  const doneId = h?.phase === "DONE" && !h.annulled ? h.hand_id : null;
  useEffect(() => {
    if (!doneId) return;
    const t = setTimeout(showResult, RESULT_DELAY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneId]);

  const nextLabel = handResult(view, names)?.nextLabel;
  const betweenHands = between
    ? { title: PLAY.handOver, primaryLabel: nextLabel ?? PLAY.dealNext, onPrimary: release, secondaryLabel: PLAY.results, onSecondary: showResult }
    : view.match.over
      ? { title: PLAY.matchOver, primaryLabel: PLAY.results, onPrimary: showResult, secondaryLabel: PLAY.newTable, onSecondary: onNew }
      : null;

  return (
    <>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <TableScreen
      view={view} names={names} controls={["human", ...Array.from({ length: table.seats - 1 }, () => "bot" as const)]}
      onMove={move} onBlocked={(card) => move({ t: "Play", card })} toast={toast}
      hint={() => table.hint()} clock={{ onExpire: autoplay }}
      undo={{ can: table.canUndo(), run: () => { table.undo(); } }}
      onLeave={onExit} betweenHands={betweenHands}
      info={[[PLAY.game, gameName], ...describeChoice(info, choice)]}
    />
    </>
  );
}
