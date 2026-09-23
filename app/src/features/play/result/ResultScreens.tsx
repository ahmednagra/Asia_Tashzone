import React from "react";
import { Redirect, useRouter } from "expo-router";
import { GoldButton } from "../../../components/ui/GoldButton";
import { readOutcome } from "../session";
import { ResultLayout, ScoreRows } from "./ResultLayout";

/** After a hand (mockup `V.handresult`): why the score changed, then the next deal or leaving. */
export function HandResultScreen() {
  const router = useRouter();
  const o = readOutcome();
  if (!o || o.kind !== "hand") return <Redirect href="/" />;
  const { data } = o;
  return (
    <ResultLayout header={data.title} headline={data.headline} blurb={data.blurb}
      actions={<>
        <GoldButton label={data.nextLabel} onPress={() => { o.onNext(); if (data.hasNext) router.back(); else router.replace("/result/game"); }} />
        <GoldButton label="Leave the match" kind="glass" onPress={() => { router.back(); o.onLeave(); }} />
      </>}>
      <ScoreRows title={data.rowsTitle} rows={data.rows} />
    </ResultLayout>
  );
}

/** After the match (mockup `V.endgame`): who won, the standings, deal again or back to the games. */
export function GameResultScreen() {
  const router = useRouter();
  const o = readOutcome();
  if (!o || o.kind !== "game") return <Redirect href="/" />;
  const { data } = o;
  return (
    <ResultLayout hero label={data.label} headline={data.head} blurb={data.line}
      actions={<>
        <GoldButton label="Deal again" onPress={() => { o.onAgain(); router.back(); }} />
        <GoldButton label="Back to the table list" kind="glass" onPress={() => { router.back(); o.onLeave(); }} />
      </>}>
      <ScoreRows title={data.rowsTitle} rows={data.rows} />
    </ResultLayout>
  );
}
