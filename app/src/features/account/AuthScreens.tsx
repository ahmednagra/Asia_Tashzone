import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Caption } from "../../components/ui/Caption";
import { GlassCard } from "../../components/ui/GlassCard";
import { GoldButton } from "../../components/ui/GoldButton";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { SettingsScreen } from "../../components/ui/Settings";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/tokens";
import { useProfile } from "../../store/profile";
import { A } from "./copy";
import { authMessage } from "./errors";
import { changePassword, createAccount, requestCode, resetPassword, signInWithCode, signInWithPassword } from "./flows";
import { codeOk, digitsOnly, emailOk, passwordOk } from "./validate";

type FieldKind = "email" | "password" | "newPassword" | "code";

function Field({ label, value, onChange, kind }: { label: string; value: string; onChange: (v: string) => void; kind: FieldKind }) {
  const { c } = useTheme();
  const [shown, setShown] = useState(false);
  const secret = kind === "password" || kind === "newPassword";
  const input = {
    email: { keyboardType: "email-address" as const, autoComplete: "email" as const, textContentType: "emailAddress" as const, placeholder: A.emailPh },
    password: { autoComplete: "current-password" as const, textContentType: "password" as const },
    newPassword: { autoComplete: "new-password" as const, textContentType: "newPassword" as const },
    code: { keyboardType: "number-pad" as const, autoComplete: "one-time-code" as const, textContentType: "oneTimeCode" as const, maxLength: 6 },
  }[kind];
  return (
    <View style={s.field}>
      <SectionLabel>{label}</SectionLabel>
      <View style={s.inputRow}>
        <TextInput value={value} onChangeText={(v) => onChange(kind === "code" ? digitsOnly(v) : v)} accessibilityLabel={label}
          autoCapitalize="none" autoCorrect={false} secureTextEntry={secret && !shown} placeholderTextColor={c.textMuted} {...input}
          style={[s.input, { color: c.text, borderColor: c.borderControl }]} />
        {secret ? (
          <Pressable accessibilityRole="button" onPress={() => setShown((v) => !v)} hitSlop={8}>
            <Text style={[s.toggle, { color: c.textSecondary }]}>{shown ? A.hide : A.show}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Frame({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SettingsScreen title={title} footer={footer}>{children}</SettingsScreen>
    </KeyboardAvoidingView>
  );
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (work: () => Promise<void>, changingPassword = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(authMessage(e, changingPassword));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

const home = "/settings/account" as const;

export function SignInScreen() {
  const router = useRouter();
  const { lang } = useTheme();
  const { profile, update } = useProfile();
  const [mode, setMode] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  const checkEmail = () => { if (emailOk(email)) return true; setError(A.errEmail); return false; };
  const byPassword = () => { if (checkEmail()) run(async () => { update(await signInWithPassword(email, password, profile)); router.dismissTo(home); }); };
  const send = () => { if (checkEmail()) run(async () => { await requestCode(email, "login", lang); setSent(true); }); };
  const byCode = () => {
    if (!codeOk(code)) { setError(A.errCode); return; }
    run(async () => { update(await signInWithCode(email, code, profile)); router.dismissTo(home); });
  };
  const switchMode = () => { setMode(mode === "password" ? "code" : "password"); setSent(false); setCode(""); setError(null); };

  return (
    <Frame title={A.signInTitle}>
      <GlassCard>
        <Field label={A.email} value={email} onChange={(v) => { setEmail(v); setSent(false); }} kind="email" />
        {mode === "password" ? <Field label={A.password} value={password} onChange={setPassword} kind="password" /> : null}
        {mode === "code" && sent ? <><Caption>{A.codeSent(email.trim())}</Caption><Field label={A.code} value={code} onChange={setCode} kind="code" /></> : null}
        {error ? <Caption tone="error">{error}</Caption> : null}
        <View style={s.actions}>
          {mode === "password" ? <GoldButton label={A.signIn} onPress={byPassword} disabled={busy || !email || !password} /> : null}
          {mode === "code" && !sent ? <GoldButton label={A.sendCode} onPress={send} disabled={busy || !email} /> : null}
          {mode === "code" && sent ? <><GoldButton label={A.signIn} onPress={byCode} disabled={busy || code.length < 6} /><GoldButton kind="glass" label={A.resend} onPress={send} disabled={busy} /></> : null}
          <GoldButton kind="glass" label={mode === "password" ? A.useCode : A.usePassword} onPress={switchMode} disabled={busy} />
          {mode === "password" ? <GoldButton kind="glass" label={A.forgot} onPress={() => router.push({ pathname: "/account/forgot", params: { email } })} disabled={busy} /> : null}
        </View>
      </GlassCard>
      <Caption tone="muted">{A.replaceNote}</Caption>
      <GoldButton kind="glass" label={A.toCreate} onPress={() => router.replace("/account/create")} disabled={busy} />
    </Frame>
  );
}

export function CreateAccountScreen() {
  const router = useRouter();
  const { lang } = useTheme();
  const { profile } = useProfile();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  const send = () => {
    if (!emailOk(email)) { setError(A.errEmail); return; }
    run(async () => { await requestCode(email, "signup", lang); setSent(true); });
  };
  const create = () => {
    if (!codeOk(code)) { setError(A.errCode); return; }
    if (!passwordOk(password, email)) { setError(A.errPassword); return; }
    run(async () => { await createAccount(email, code, password, profile); router.dismissTo(home); });
  };

  return (
    <Frame title={A.createTitle}>
      <GlassCard>
        <Field label={A.email} value={email} onChange={(v) => { setEmail(v); setSent(false); }} kind="email" />
        {sent ? (
          <>
            <Caption>{A.codeSent(email.trim())}</Caption>
            <Field label={A.code} value={code} onChange={setCode} kind="code" />
            <Field label={A.password} value={password} onChange={setPassword} kind="newPassword" />
            <Caption tone="muted">{A.passwordRule}</Caption>
          </>
        ) : null}
        {error ? <Caption tone="error">{error}</Caption> : null}
        <View style={s.actions}>
          {sent
            ? <><GoldButton label={A.create} onPress={create} disabled={busy || code.length < 6 || !password} /><GoldButton kind="glass" label={A.resend} onPress={send} disabled={busy} /></>
            : <GoldButton label={A.sendCode} onPress={send} disabled={busy || !email} />}
        </View>
      </GlassCard>
      <Caption tone="muted">{A.keepNote}</Caption>
      <GoldButton kind="glass" label={A.toSignIn} onPress={() => router.replace("/account/sign-in")} disabled={busy} />
    </Frame>
  );
}

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { lang } = useTheme();
  const { profile, update } = useProfile();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  const send = () => {
    if (!emailOk(email)) { setError(A.errEmail); return; }
    run(async () => { await requestCode(email, "reset", lang); setSent(true); });
  };
  const save = () => {
    if (!codeOk(code)) { setError(A.errCode); return; }
    if (!passwordOk(password, email)) { setError(A.errPassword); return; }
    run(async () => { update(await resetPassword(email, code, password, profile)); router.dismissTo(home); });
  };

  return (
    <Frame title={A.forgotTitle}>
      <GlassCard>
        <Field label={A.email} value={email} onChange={(v) => { setEmail(v); setSent(false); }} kind="email" />
        {sent ? (
          <>
            <Caption>{A.codeSent(email.trim())}</Caption>
            <Field label={A.code} value={code} onChange={setCode} kind="code" />
            <Field label={A.newPassword} value={password} onChange={setPassword} kind="newPassword" />
            <Caption tone="muted">{A.passwordRule}</Caption>
          </>
        ) : null}
        {error ? <Caption tone="error">{error}</Caption> : null}
        <View style={s.actions}>
          {sent
            ? <><GoldButton label={A.save} onPress={save} disabled={busy || code.length < 6 || !password} /><GoldButton kind="glass" label={A.resend} onPress={send} disabled={busy} /></>
            : <GoldButton label={A.sendCode} onPress={send} disabled={busy || !email} />}
        </View>
      </GlassCard>
      <Caption tone="muted">{A.replaceNote}</Caption>
    </Frame>
  );
}

export function ChangePasswordScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { busy, error, setError, run } = useSubmit();

  const save = () => {
    if (!passwordOk(next)) { setError(A.errPassword); return; }
    run(async () => { await changePassword(current, next, profile); router.dismissTo(home); }, true);
  };

  return (
    <Frame title={A.changeTitle}>
      <GlassCard>
        <Field label={A.currentPassword} value={current} onChange={setCurrent} kind="password" />
        <Field label={A.newPassword} value={next} onChange={setNext} kind="newPassword" />
        <Caption tone="muted">{A.passwordRule}</Caption>
        {error ? <Caption tone="error">{error}</Caption> : null}
        <View style={s.actions}><GoldButton label={A.save} onPress={save} disabled={busy || !current || !next} /></View>
      </GlassCard>
    </Frame>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  field: { marginTop: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, minHeight: 48, borderBottomWidth: 1, fontFamily: fonts.ui.family, fontSize: 16 },
  toggle: { fontFamily: fonts.ui.family, fontSize: 13 },
  actions: { gap: 8, marginTop: 12 },
});
