import React, { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { ConfirmSheet } from "../../../components/ui/ConfirmSheet";
import { GoldButton } from "../../../components/ui/GoldButton";
import { readOutcome } from "../session";
import { useTheme } from "../../../context/ThemeContext";
import { T } from "../table/copy";
import { ResultLayout, ScoreRows, VictoryPodium } from "./ResultLayout";
import { R } from "./copy";

export function HandResultScreen() {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  useTheme();
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
          <GoldButton label={R.leave} kind="glass" onPress={() => setConfirm(true)} />
        </>
      }
    >
      <ScoreRows title={data.rowsTitle} rows={data.rows} />
      <ConfirmSheet
        visible={confirm}
        title={R.leaveTitle}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          router.back();
          o.onLeave();
        }}
        confirmLabel={R.leave}
        cancelLabel={R.keepPlaying}
        facts={[
          { mark: "H", title: T.screen.endsTitle, body: T.screen.endsBody },
          { mark: "!", title: R.scoreDroppedTitle, body: R.scoreDroppedBody },
        ]}
      />
    </ResultLayout>
  );
}

export function GameResultScreen() {
  const router = useRouter();
  useTheme();
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
            label={R.dealAgain}
            onPress={() => {
              o.onAgain();
              router.back();
            }}
          />
          <GoldButton
            label={R.backToList}
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
