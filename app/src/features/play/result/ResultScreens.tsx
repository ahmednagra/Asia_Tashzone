import React, { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { ConfirmSheet } from "../../../components/ui/ConfirmSheet";
import { GoldButton } from "../../../components/ui/GoldButton";
import { readOutcome } from "../session";
import { ResultLayout, ScoreRows, VictoryPodium } from "./ResultLayout";

export function HandResultScreen() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const o = readOutcome();
  if (!o || o.kind !== "hand") return <Redirect href="/" />;
  const { data } = o;
  return (
    <ResultLayout
      header={data.title}
      headline={data.headline}
      blurb={data.blurb}
      actions={
        <>
          <GoldButton
            label={data.nextLabel}
            onPress={() => {
              o.onNext();
              if (data.hasNext) router.back();
              else router.replace("/result/game");
            }}
          />
          <GoldButton label="Leave the match" kind="glass" onPress={() => setConfirm(true)} />
        </>
      }
    >
      <ScoreRows title={data.rowsTitle} rows={data.rows} />
      <ConfirmSheet
        visible={confirm}
        title="Leave this match?"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          router.back();
          o.onLeave();
        }}
        confirmLabel="Leave the match"
        cancelLabel="Keep playing"
        facts={[
          { mark: "H", title: "This game ends here", body: "A game against bots is not held open: leaving closes the table for good." },
          { mark: "!", title: "The running score is dropped", body: "No match result is recorded for a match you leave." },
        ]}
      />
    </ResultLayout>
  );
}

export function GameResultScreen() {
  const router = useRouter();
  const o = readOutcome();
  if (!o || o.kind !== "game") return <Redirect href="/" />;
  const { data } = o;
  return (
    <ResultLayout
      hero
      won={data.won}
      label={data.label}
      headline={data.head}
      blurb={data.line}
      actions={
        <>
          <GoldButton
            label="Deal again"
            onPress={() => {
              o.onAgain();
              router.back();
            }}
          />
          <GoldButton
            label="Back to the table list"
            kind="glass"
            onPress={() => {
              router.back();
              o.onLeave();
            }}
          />
        </>
      }
    >
      <VictoryPodium rows={data.rows} />
      <ScoreRows title={data.rowsTitle} rows={data.rows} />
    </ResultLayout>
  );
}
