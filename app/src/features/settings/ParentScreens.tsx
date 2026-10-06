import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Caption } from "../../components/ui/Caption";
import { ConfirmSheet } from "../../components/ui/ConfirmSheet";
import { GoldButton } from "../../components/ui/GoldButton";
import { Keypad } from "../../components/ui/Keypad";
import { SettingsGroup, SettingsScreen } from "../../components/ui/Settings";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { ToggleRow } from "../../components/ui/ToggleRow";
import { type PinGate, usePinGate } from "../../hooks/usePinGate";
import { useProfile } from "../../store/profile";
import { T } from "./copy";
import { PIN_LENGTH } from "./pin";
import { makePinRecord } from "./pinCrypto";

/** Keypad with the lock-out and wrong-PIN messages of a `PinGate`; `note` is an extra line (e.g. a mismatch warning). */
export function PinEntry({ prompt, gate, onComplete, note }: { prompt: string; gate: PinGate; onComplete: (pin: string) => void; note?: string | null }) {
  const locked = gate.secondsLeft > 0;
  const problem = locked ? T.parentExtra.lockedFor(gate.secondsLeft) : gate.failed ? T.parentExtra.checkFailed : gate.triesLeft !== undefined ? T.parent.wrong(gate.triesLeft) : note;
  return (
    <>
      <Caption center>{prompt}</Caption>
      <Keypad digits={PIN_LENGTH} onComplete={onComplete} disabled={locked || gate.busy} label={prompt} />
      {problem ? <Caption center tone="error">{problem}</Caption> : null}
    </>
  );
}

/** Settings > Parent controls: switches behind the parent PIN (when one is set). */
export function ParentScreen() {
  const router = useRouter();
  const { profile: p, update } = useProfile();
  const gate = usePinGate();
  const [unlocked, setUnlocked] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const t = T.parent;
  const x = T.parentExtra;

  if (gate.hasPin && !unlocked) {
    return (
      <SettingsScreen title={t.title}>
        <StatusBanner tone={gate.secondsLeft > 0 ? "error" : "info"} title={t.lockedTitle} body={t.enterPin} />
        <PinEntry prompt={t.enterPin} gate={gate} onComplete={async (pin) => { if (await gate.verify(pin)) setUnlocked(true); }} />
      </SettingsScreen>
    );
  }

  const set = (k: "text" | "online" | "wifi") => (v: boolean) => update({ parent: { ...p.parent, [k]: v } });
  const removePin = () => { setConfirmRemove(false); update({ parent: { ...p.parent, pinHash: undefined, salt: undefined, lock: undefined } }); };
  return (
    <SettingsScreen title={t.title}>
      {!gate.hasPin ? <StatusBanner tone="warn" title={t.noPinTitle} body={t.noPinBody} /> : null}
      <SettingsGroup>
        <ToggleRow label={t.text} hint={t.textHint} value={p.parent.text} onChange={set("text")} />
        <ToggleRow label={t.online} hint={t.onlineHint} value={p.parent.online} onChange={set("online")} />
        <ToggleRow label={t.wifi} hint={t.wifiHint} value={p.parent.wifi} onChange={set("wifi")} />
      </SettingsGroup>
      <StatusBanner tone="warn" title={t.installTitle} body={t.installBody} />
      <GoldButton label={gate.hasPin ? t.changePin : t.setPin} onPress={() => router.push("/settings/parent-pin")} />
      {gate.hasPin ? <GoldButton kind="glass" label={t.removePin} onPress={() => setConfirmRemove(true)} /> : null}
      <ConfirmSheet visible={confirmRemove} title={x.removeTitle} facts={x.removeFacts} confirmLabel={x.removeDo} cancelLabel={x.keep}
        onConfirm={removePin} onCancel={() => setConfirmRemove(false)} />
    </SettingsScreen>
  );
}

type Step = "current" | "fresh" | "confirm";

/** Settings > Parent PIN: verify the current PIN (if any), choose a new one, confirm it, save a salted hash. */
export function ParentPinScreen() {
  const router = useRouter();
  const { profile: p, update } = useProfile();
  const gate = usePinGate();
  const [step, setStep] = useState<Step>(gate.hasPin ? "current" : "fresh");
  const [first, setFirst] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = T.pin;

  const done = async (pin: string) => {
    setNote(null);
    if (step === "current") {
      if (await gate.verify(pin)) setStep("fresh");
    } else if (step === "fresh") {
      setFirst(pin);
      setStep("confirm");
    } else if (pin === first) {
      setSaving(true);
      try {
        const rec = await makePinRecord(pin);
        update({ parent: { ...p.parent, ...rec, lock: undefined } });
        router.back();
      } catch {
        setNote(T.parentExtra.saveFailed);
        setFirst("");
        setStep("fresh");
      } finally {
        setSaving(false);
      }
    } else {
      setNote(t.mismatch);
      setFirst("");
      setStep("fresh");
    }
  };

  const prompt = step === "current" ? t.current : step === "fresh" ? t.fresh : t.confirm;
  return (
    <SettingsScreen title={t.title}>
      <Caption center>{t.intro}</Caption>
      <PinEntry key={step} prompt={prompt} gate={step === "current" ? gate : { ...gate, secondsLeft: 0, triesLeft: undefined, failed: false, busy: saving }} onComplete={done} note={note} />
    </SettingsScreen>
  );
}
