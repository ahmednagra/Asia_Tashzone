import React, { useCallback, useState } from "react";
import { Share, StyleSheet, TextInput } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Caption } from "../../components/ui/Caption";
import { GoldButton } from "../../components/ui/GoldButton";
import { NavRow } from "../../components/ui/NavRow";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { SettingsScreen } from "../../components/ui/Settings";
import { Sheet } from "../../components/ui/Sheet";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { DEFAULT_PREFS, usePrefs, useTheme } from "../../context/ThemeContext";
import { usePinGate } from "../../hooks/usePinGate";
import { fonts } from "../../theme/tokens";
import { useProfile } from "../../store/profile";
import { exportProfile, importProfile } from "../../store/profileModel";
import { A } from "../account/copy";
import { authMessage } from "../account/errors";
import { type AccountState, type LinkResult, accountState, linkProvider, signOutEverywhere, signOutHere, switchToLinked, unlinkProvider } from "../account/flows";
import { nick } from "../onboarding/copy";
import { type Provider, SignInError } from "../../services/googleAuth";
import { T } from "./copy";
import { PinEntry } from "./ParentScreens";

type Dialog = "restore" | "wipe" | "pin" | "signOut" | "taken" | null;

export function AccountScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { profile, update, reset } = useProfile();
  const [, setPrefs] = usePrefs();
  const gate = usePinGate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [state, setState] = useState<AccountState | null>(null);
  const [busy, setBusy] = useState(false);
  const [taken, setTaken] = useState<Extract<LinkResult, { kind: "taken" }> | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const t = T.account;

  const refresh = useCallback(() => {
    let live = true;
    accountState(profile).then((s) => { if (live) setState(s); }).catch((e) => { if (live) setMessage(authMessage(e)); });
    return () => { live = false; };
  }, [profile.name]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(refresh);

  const close = () => { setDialog(null); setText(""); setPending(null); };
  const guarded = (action: () => void) => {
    setMessage(null);
    if (!profile.protectedMode) { action(); return; }
    if (!gate.hasPin) { setMessage(t.askParent); return; }
    setPending(() => action);
    setDialog("pin");
  };
  const work = async (job: () => Promise<string | null>) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await job());
      refresh();
    } catch (e) {
      setMessage(e instanceof SignInError ? providerError(e) : authMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const providerError = (e: SignInError) => {
    if (e.code === "CANCELLED") return null;
    if (e.code === "NO_ACCOUNT") return t.errNoAccount;
    if (e.code === "NOT_CONFIGURED" || e.code === "NO_ACTIVITY") return t.errUnavailable;
    return t.errFailed;
  };

  const link = (provider: Provider) => guarded(() => work(async () => {
    const result = await linkProvider(provider, profile);
    if (result.kind === "linked") return t.signedIn;
    if (profile.stats.matches === 0) { update(await switchToLinked(result, profile)); return t.restoredMsg; }
    setTaken(result);
    setDialog("taken");
    return null;
  }));
  const switchProfile = () => {
    const target = taken;
    close();
    if (target) work(async () => { update(await switchToLinked(target, profile)); return t.restoredMsg; });
  };
  const unlink = (provider: Provider) => work(async () => { await unlinkProvider(provider, profile); return null; });
  const signOut = () => {
    close();
    work(async () => {
      await signOutHere();
      update({ name: nick(), avatar: 0, stats: { matches: 0, wins: 0, streak: 0, bhabhi: 0 }, recent: [] });
      return null;
    });
  };
  const everywhere = () => work(async () => { await signOutEverywhere(profile); return t.signOutAllDone; });

  const backup = () => { Share.share({ title: t.shareMsgTitle, message: exportProfile(profile) }).catch(() => {}); };
  const restore = () => {
    const next = importProfile(text, profile);
    if (!next) { setMessage(t.restoreBad); return; }
    update(next);
    close();
  };
  const wipe = () => {
    reset();
    setPrefs(DEFAULT_PREFS);
    close();
  };

  const email = state?.email ?? null;
  const providerLabel = (p: Provider) => (p === "google" ? t.google : t.playGames);

  return (
    <SettingsScreen title={t.title}>
      {email ? <StatusBanner title={t.signedInAs(email)} /> : <StatusBanner title={t.noAccountTitle} body={t.noAccountBody} />}

      {email ? (
        <>
          <NavRow icon="✎" title={A.changeTitle} caption={t.passwordHint} onPress={() => router.push("/account/password")} disabled={busy} />
          <NavRow icon="⇄" title={t.signOutAll} caption={t.signOutAllHint} onPress={everywhere} disabled={busy} />
          <NavRow icon="⎋" title={t.signOut} caption={t.signOutHint} onPress={() => setDialog("signOut")} disabled={busy} />
        </>
      ) : state?.emailAccounts ? (
        <>
          <NavRow icon="→" title={A.signInTitle} onPress={() => guarded(() => router.push("/account/sign-in"))} disabled={busy} />
          <NavRow icon="+" title={A.createTitle} onPress={() => guarded(() => router.push("/account/create"))} disabled={busy} />
        </>
      ) : null}

      {state && state.providers.length > 0 ? (
        <>
          <SectionLabel>{t.signInTitle}</SectionLabel>
          {state.providers.map((p) => state.linked.includes(p)
            ? <NavRow key={p} icon="✓" title={providerLabel(p)} caption={t.linked} badge={t.unlink} onPress={() => unlink(p)} disabled={busy} />
            : <NavRow key={p} icon={p === "google" ? "G" : "▶"} title={providerLabel(p)} onPress={() => link(p)} disabled={busy} />)}
        </>
      ) : null}

      {message ? <Caption>{message}</Caption> : null}

      <SectionLabel>{t.title}</SectionLabel>
      <NavRow icon="↥" title={t.backup} caption={t.backupHint} onPress={backup} />
      <NavRow icon="↧" title={t.restore} caption={t.restoreHint} onPress={() => setDialog("restore")} />
      <NavRow icon="✕" title={t.wipe} caption={t.wipeHint} onPress={() => setDialog("wipe")} />
      <Caption tone="muted">{profile.protectedMode ? t.protectedOn : t.protectedOff}</Caption>

      <Sheet visible={dialog === "pin"} title={t.pinToSignIn} onClose={close}>
        <PinEntry prompt={t.pinToSignIn} gate={gate} onComplete={async (pin) => {
          if (!(await gate.verify(pin))) return;
          const action = pending;
          close();
          action?.();
        }} />
      </Sheet>

      <Sheet visible={dialog === "taken"} title={t.takenTitle} onClose={close}
        actions={<><GoldButton label={t.switchDo} onPress={switchProfile} /><GoldButton kind="glass" label={t.cancel} onPress={close} /></>}>
        <Caption>{t.takenBody}</Caption>
      </Sheet>

      <Sheet visible={dialog === "signOut"} title={t.signOutTitle} onClose={close}
        actions={<><GoldButton label={t.signOutDo} onPress={signOut} /><GoldButton kind="glass" label={t.cancel} onPress={close} /></>}>
        <Caption>{t.signOutBody}</Caption>
      </Sheet>

      <Sheet visible={dialog === "restore"} title={t.restoreTitle} onClose={close}
        actions={<><GoldButton label={t.restoreDo} onPress={restore} disabled={!text.trim()} /><GoldButton kind="glass" label={t.cancel} onPress={close} /></>}>
        <Caption>{t.restoreBody}</Caption>
        <TextInput value={text} onChangeText={(v) => { setText(v); setMessage(null); }} multiline placeholder={t.restorePlaceholder} placeholderTextColor={c.textMuted}
          accessibilityLabel={t.restoreTitle} autoCapitalize="none" autoCorrect={false} style={[s.input, { color: c.text, borderColor: c.borderControl }]} />
        {message ? <Caption tone="error">{message}</Caption> : null}
      </Sheet>

      <Sheet visible={dialog === "wipe"} title={t.wipeTitle} onClose={close}
        actions={<><GoldButton label={t.cancel} onPress={close} />{gate.hasPin ? null : <GoldButton kind="glass" label={t.wipeDo} onPress={wipe} />}</>}>
        <Caption>{t.wipeBody}</Caption>
        {gate.hasPin ? <PinEntry prompt={t.wipePin} gate={gate} onComplete={async (pin) => { if (await gate.verify(pin)) wipe(); }} /> : null}
      </Sheet>
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  input: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10, fontFamily: fonts.ui.family, fontSize: 14, textAlignVertical: "top" },
});
