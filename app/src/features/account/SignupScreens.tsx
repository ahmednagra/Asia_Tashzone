/**
 * Guest-to-account prompts: the sheet and the small card on the game result screen, and the gate in front of
 * online tables. The rules live in signupPrompt.ts (unit-tested); this file is only the UI and the sign-in calls.
 * Google is one tap through Credential Manager; email opens the existing create-account screen and comes back.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Caption } from "../../components/ui/Caption";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { Header } from "../../components/ui/Header";
import { Screen } from "../../components/ui/Screen";
import { Sheet } from "../../components/ui/Sheet";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { useSessionKind } from "../../hooks/useSessionKind";
import { SignInError } from "../../services/googleAuth";
import { monoNow, useProfile } from "../../store/profile";
import { S } from "./copy";
import { authMessage } from "./errors";
import { type LinkResult, type SignupContext, confirmAccount, linkProvider, signupContext, switchToLinked } from "./flows";
import { addPlayTime, afterCard, afterSheet, decidePrompt, markSheetShown, savedWins, sheetShownThisSession } from "./signupPrompt";

type Taken = Extract<LinkResult, { kind: "taken" }>;

/** Google one-tap for a guest, including the "this Google account already has a record" case. */
function useGoogleSignIn(onDone: () => void) {
  const { profile, update } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<Taken | null>(null);

  const fail = (e: unknown) => {
    if (e instanceof SignInError) {
      // A cancelled sheet is a decline, not an error: Google's guidance is never to retry it automatically.
      if (e.code === "CANCELLED") return setError(null);
      return setError(e.code === "NO_ACCOUNT" ? S.errNoAccount : e.code === "FAILED" ? S.errFailed : S.errUnavailable);
    }
    setError(authMessage(e));
  };
  const google = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await linkProvider("google", profile);
      if (result.kind === "linked") onDone();
      else if (profile.stats.matches === 0) { update(await switchToLinked(result, profile)); onDone(); }
      else setTaken(result);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const confirmSwitch = async () => {
    const target = taken;
    setTaken(null);
    if (!target) return;
    setBusy(true);
    try {
      update(await switchToLinked(target, profile));
      onDone();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, taken, google, confirmSwitch, cancelSwitch: () => setTaken(null) };
}

/** The sign-in buttons: Google first when this phone and the server offer it, email as the fallback. */
function SignInChoices({ ctx, onDone, beforeLeave, decline }: { ctx: SignupContext; onDone: () => void; beforeLeave?: () => void; decline?: React.ReactNode }) {
  const router = useRouter();
  const g = useGoogleSignIn(onDone);
  const email = () => { beforeLeave?.(); router.push({ pathname: "/account/create", params: { back: "1" } }); };
  return (
    <View style={s.choices}>
      {ctx.google ? <GoldButton label={S.google} onPress={g.google} disabled={g.busy} /> : null}
      {ctx.email ? <GoldButton kind={ctx.google ? "glass" : "gold"} label={S.email} onPress={email} disabled={g.busy} /> : null}
      {decline}
      {g.error ? <Caption tone="error">{g.error}</Caption> : null}
      <Sheet visible={!!g.taken} title={S.switchTitle} onClose={g.cancelSwitch}
        actions={<><GoldButton label={S.switchDo} onPress={g.confirmSwitch} /><GoldButton kind="glass" label={S.cancel} onPress={g.cancelSwitch} /></>}>
        <Caption>{S.switchBody}</Caption>
      </Sheet>
    </View>
  );
}

/**
 * On the game result screen: decides once, when the screen opens, between the sign-up sheet, the small card
 * and nothing. Showing the sheet is recorded at once, so leaving the screen any way counts as a "Not now".
 */
export function ResultSignupPrompt({ won }: { won: boolean }) {
  const { profile, updateWith } = useProfile();
  const kind = useSessionKind();
  const [ctx, setCtx] = useState<SignupContext | null>(null);
  const [card, setCard] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [done, setDone] = useState(false);
  const decided = useRef(false);
  /** set when the player leaves for the email screen, so coming back signed in still shows the confirmation */
  const asked = useRef(false);

  useEffect(() => {
    let live = true;
    signupContext().then((c) => {
      if (!live || decided.current) return;
      decided.current = true;
      setCtx(c);
      const decision = decidePrompt({
        config: c.prompt, signup: profile.signup, matches: profile.stats.matches, won, guest: c.guest, protectedMode: profile.protectedMode,
        canSignUp: c.google || c.email, sheetShownThisSession: sheetShownThisSession(), now: Date.now(),
      });
      if (decision === "sheet") {
        markSheetShown();
        updateWith((p) => ({ signup: afterSheet(p.signup, p.stats.matches, Date.now()) }));
        setSheet(true);
      } else if (decision === "card") {
        updateWith((p) => ({ signup: afterCard(p.signup, "view") }));
        setCard(true);
      }
    }).catch(() => {});
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- decided once per result screen, from the state it opened with

  const finished = useCallback(() => { setSheet(false); setCard(false); setDone(true); }, []);
  useEffect(() => { if (kind === "account" && (sheet || card || asked.current)) finished(); }, [kind, sheet, card, finished]);

  if (done) return <StatusBanner title={S.done} />;
  if (!ctx) return null;
  const wins = savedWins(profile);
  return (
    <>
      {card ? (
        <GlassCard>
          <Caption>{wins > 0 ? S.cardWins(wins) : S.card}</Caption>
          <View style={s.row}>
            <GoldButton style={s.grow} label={S.cardAction} onPress={() => { updateWith((p) => ({ signup: afterCard(p.signup, "tap") })); setSheet(true); }} />
            <GoldButton style={s.grow} kind="glass" label={S.cardOff} onPress={() => { updateWith((p) => ({ signup: afterCard(p.signup, "off") })); setCard(false); }} />
          </View>
        </GlassCard>
      ) : null}
      <Sheet visible={sheet} title={wins >= 2 ? S.titleWins(wins) : S.title} onClose={() => setSheet(false)}>
        <Caption>{S.body}</Caption>
        <SignInChoices ctx={ctx} onDone={finished} beforeLeave={() => { asked.current = true; setSheet(false); }}
          decline={<GoldButton kind="glass" label={S.notNow} onPress={() => setSheet(false)} />} />
      </Sheet>
    </>
  );
}

/**
 * In front of online tables (create, join, Quick Match). Guests see why an account is needed and can sign in
 * without leaving; children in Protected Mode are sent to a parent instead. Offline and Wi-Fi play never pass here.
 */
export function RequireAccount({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile } = useProfile();
  const kind = useSessionKind();
  const [ctx, setCtx] = useState<SignupContext | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([signupContext(true), confirmAccount(profile).catch(() => false)])
      .then(([c]) => { if (live) setCtx(c); })
      .finally(() => { if (live) setChecked(true); });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- checked once per visit

  if (kind === "account") return <>{children}</>;
  if (!checked || !ctx || kind === null) return <Screen><Header title={S.gateTitle} /><StatusBanner busy title={S.gateTitle} /></Screen>;
  if (!ctx.onlineNeedsAccount) return <>{children}</>;

  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const canSignUp = ctx.google || ctx.email;
  return (
    <Screen footer={<GoldButton kind="glass" label={S.gateBack} onPress={back} />}>
      <Header title={S.gateTitle} />
      {profile.protectedMode ? (
        <StatusBanner tone="warn" title={S.parentTitle} body={S.parentBody}>
          <GoldButton kind="glass" label={S.parentAction} onPress={() => router.push("/settings/account")} />
        </StatusBanner>
      ) : canSignUp ? (
        <GlassCard>
          <Caption>{S.gateBody}</Caption>
          <SignInChoices ctx={ctx} onDone={() => {}} />
        </GlassCard>
      ) : (
        <StatusBanner tone="warn" title={S.gateTitle} body={S.gateUnavailable} />
      )}
    </Screen>
  );
}

/** Counts foreground time at a bot table toward the "after 10 minutes of play" prompt. */
export function usePlayClock(active: boolean) {
  const { updateWith } = useProfile();
  useEffect(() => {
    if (!active) return;
    let start: number | null = AppState.currentState === "active" ? monoNow() : null;
    const bank = () => {
      if (start === null) return;
      const ms = monoNow() - start;
      start = null;
      updateWith((p) => ({ signup: addPlayTime(p.signup, ms) }));
    };
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") { if (start === null) start = monoNow(); } else bank();
    });
    return () => { sub.remove(); bank(); };
  }, [active, updateWith]);
}

const s = StyleSheet.create({
  choices: { gap: 8, marginTop: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  grow: { flex: 1 },
});
