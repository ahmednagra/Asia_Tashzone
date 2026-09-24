import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redirect, Stack, useRouter } from "expo-router";
import { BOT_NAMES, type SeatMove } from "@tashzone/engine";
import { LocalTable } from "@tashzone/match";
import { GoldButton } from "../../components/ui/GoldButton";
import { Header } from "../../components/ui/Header";
import { Screen } from "../../components/ui/Screen";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { StepRow } from "../../components/ui/StepRow";
import { useTheme } from "../../context/ThemeContext";
import { ERROR_MESSAGES, GENERIC_ERROR } from "../../constants/games";
import { useProfile } from "../../store/profile";
import { useFeel } from "../../utils/feel";
import { PLAY } from "../play/copy";
import { TableScreen } from "../play/table/TableScreen";
import { type Coach, type HandOutcome, START, advance, coachState, dismiss, handOutcome, seatOf, suggestedCall } from "./coach";
import { CoachCard } from "./CoachCard";
import { T } from "./copy";
import { TUTORIAL_BOTS, TUTORIAL_GAME, TUTORIAL_SEED, tutorialRules } from "./deal";

const TOAST_MS = 2500;

type Rules = NonNullable<ReturnType<typeof tutorialRules>>;

export function Tutorial() {
  const router = useRouter();
  const { update } = useProfile();
  const rules = useMemo(tutorialRules, []);
  const [result, setResult] = useState<{ outcome: HandOutcome | null } | null>(null);
  const markDone = useCallback(() => update({ tutorialDone: true }), [update]);
  const home = useCallback(() => {
    markDone();
    router.dismissTo("/");
  }, [markDone, router]);
  const playReal = useCallback(() => {
    router.dismissTo("/");
    router.push({ pathname: "/play/[game]", params: { game: TUTORIAL_GAME } });
  }, [router]);
  const finish = useCallback((outcome: HandOutcome | null) => {
    markDone();
    setResult({ outcome });
  }, [markDone]);

  if (!rules) return <Redirect href="/" />;
  if (result) return <Summary outcome={result.outcome} onPlay={playReal} onHome={home} />;
  return <TutorialTable rules={rules} onSkip={home} onFinish={finish} />;
}

function tipText(tip: Coach["tip"], view: Parameters<typeof coachState>[0], outcome: HandOutcome | null): { title: string; body: string } | null {
  switch (tip) {
    case "welcome": case "follow": case "beat": case "trump":
      return T.tips[tip];
    case "call":
      return { title: T.tips.call.title, body: T.tips.call.body(suggestedCall(view)) };
    case "won": {
      const me = seatOf(view);
      const won = view?.hand?.tricks?.[me] ?? 1;
      const call = view?.hand?.calls?.[me] ?? 1;
      return { title: T.tips.won.title, body: T.tips.won.body(won, call) };
    }
    case "end": {
      if (!outcome) return null;
      const e = outcome.made ? T.end.made : T.end.missed;
      return { title: e.title, body: e.body(outcome.call, outcome.won, outcome.points) };
    }
    default:
      return null;
  }
}

function TutorialTable({ rules, onSkip, onFinish }: { rules: Rules; onSkip: () => void; onFinish: (o: HandOutcome | null) => void }) {
  const { profile } = useProfile();
  useTheme();
  const feel = useFeel();
  const table = useMemo(() => new LocalTable(rules, { randomSeed: () => TUTORIAL_SEED, botLevel: TUTORIAL_BOTS }), [rules]);
  const [view, setView] = useState(() => table.view());
  const [toast, setToast] = useState<string | null>(null);
  const [coach, setCoach] = useState<Coach>(START);
  useEffect(() => {
    const off = table.subscribe((v) => setView(v));
    table.start();
    return () => { off(); table.dispose(); };
  }, [table]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const state = useMemo(() => coachState(view), [view]);
  useEffect(() => { setCoach((c) => advance(state, c)); }, [state]);

  const outcome = useMemo(() => (coach.tip === "end" ? handOutcome(view) : null), [coach.tip, view]);
  const cue = useRef(feel);
  cue.current = feel;
  useEffect(() => {
    if (coach.tip === "end" && outcome?.made) cue.current("win");
  }, [coach.tip, outcome?.made]);

  const names = useMemo(
    () => [profile.name.trim() || PLAY.you, ...Array.from({ length: table.seats - 1 }, (_, i) => BOT_NAMES[i % BOT_NAMES.length]!)],
    [profile.name, table.seats],
  );

  const move = (m: SeatMove) => {
    if (table.play(m)) return;
    const code = table.explain(m);
    setToast(code ? ERROR_MESSAGES[code] ?? GENERIC_ERROR : GENERIC_ERROR);
  };

  const text = tipText(coach.tip, view, outcome);
  const onAction = () => {
    feel("tap");
    if (coach.tip === "end") onFinish(outcome);
    else setCoach((c) => dismiss(state, c));
  };
  const skip = () => {
    feel("tap");
    onSkip();
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <TableScreen
        view={view}
        names={names}
        controls={["human", ...Array.from({ length: table.seats - 1 }, () => "bot" as const)]}
        onMove={move}
        onBlocked={(card) => move({ t: "Play", card })}
        toast={toast}
        hint={() => table.hint()}
        onLeave={onSkip}
        focusTray={coach.tip === "call"}
        coach={
          <CoachCard
            tipKey={text ? coach.tip : null}
            title={text?.title}
            body={text?.body}
            action={coach.tip === "end" ? T.next : T.gotIt}
            onAction={onAction}
            onSkip={skip}
          />
        }
      />
    </>
  );
}

function Summary({ outcome, onPlay, onHome }: { outcome: HandOutcome | null; onPlay: () => void; onHome: () => void }) {
  useTheme();
  const e = outcome ? (outcome.made ? T.end.made : T.end.missed) : null;
  return (
    <Screen
      footer={
        <>
          <GoldButton label={T.summary.play} onPress={onPlay} />
          <GoldButton kind="glass" label={T.summary.home} onPress={onHome} />
        </>
      }
    >
      <Stack.Screen options={{ gestureEnabled: true }} />
      <Header title={T.summary.title} back={false} />
      {outcome && e ? <StatusBanner tone={outcome.made ? "info" : "warn"} title={e.title} body={e.body(outcome.call, outcome.won, outcome.points)} /> : null}
      <SectionLabel>{T.summary.learned}</SectionLabel>
      {T.summary.lessons.map((l, i) => (
        <StepRow key={l.title} n={i + 1} title={l.title} body={l.body} />
      ))}
    </Screen>
  );
}
