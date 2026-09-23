import React, { useState } from "react";
import { Share, StyleSheet, TextInput } from "react-native";
import { Caption } from "../../components/ui/Caption";
import { GoldButton } from "../../components/ui/GoldButton";
import { NavRow } from "../../components/ui/NavRow";
import { SettingsScreen } from "../../components/ui/Settings";
import { Sheet } from "../../components/ui/Sheet";
import { StatusBanner } from "../../components/ui/StatusBanner";
import { usePrefs, useTheme } from "../../context/ThemeContext";
import { usePinGate } from "../../hooks/usePinGate";
import { fonts } from "../../theme/tokens";
import { useProfile } from "../../store/profile";
import { exportProfile, importProfile } from "../../store/profileModel";
import { T } from "./copy";
import { PinEntry } from "./ParentScreens";

type Dialog = "restore" | "wipe" | null;

/** Settings > Account and data. There is no account: the profile lives on this phone, with a real text backup and restore. */
export function AccountScreen() {
  const { c } = useTheme();
  const { profile, update, reset } = useProfile();
  const [, setPrefs] = usePrefs();
  const gate = usePinGate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const t = T.account;

  const close = () => { setDialog(null); setText(""); setMessage(null); };
  const backup = () => { Share.share({ title: t.shareMsgTitle, message: exportProfile(profile) }).catch(() => {}); };
  const restore = () => {
    const next = importProfile(text, profile);
    if (!next) { setMessage(t.restoreBad); return; }
    update(next);
    close();
  };
  const wipe = () => {
    reset();
    setPrefs({ name: "dark", fourColor: false, reducedMotion: false, largeCards: false, system: true });
    close();
  };

  return (
    <SettingsScreen title={t.title}>
      <StatusBanner title={t.noAccountTitle} body={t.noAccountBody} />
      <NavRow icon="↥" title={t.backup} caption={t.backupHint} onPress={backup} />
      <NavRow icon="↧" title={t.restore} caption={t.restoreHint} onPress={() => setDialog("restore")} />
      <NavRow icon="✕" title={t.wipe} caption={t.wipeHint} onPress={() => setDialog("wipe")} />
      <Caption tone="muted">{profile.protectedMode ? t.protectedOn : t.protectedOff}</Caption>

      <Sheet visible={dialog === "restore"} title={t.restoreTitle} onClose={close}
        actions={<><GoldButton label={t.restoreDo} onPress={restore} disabled={!text.trim()} /><GoldButton kind="glass" label={t.cancel} onPress={close} /></>}>
        <Caption>{t.restoreBody}</Caption>
        <TextInput value={text} onChangeText={(v) => { setText(v); setMessage(null); }} multiline placeholder={t.restorePlaceholder} placeholderTextColor={c.textMuted}
          accessibilityLabel={t.restoreTitle} autoCapitalize="none" autoCorrect={false} style={[s.input, { color: c.text, borderColor: c.borderControl }]} />
        {message ? <Caption tone="error">{message}</Caption> : null}
      </Sheet>

      <Sheet visible={dialog === "wipe"} title={t.wipeTitle} onClose={close}
        actions={<>{gate.hasPin ? null : <GoldButton label={t.wipeDo} onPress={wipe} />}<GoldButton kind="glass" label={t.cancel} onPress={close} /></>}>
        <Caption>{t.wipeBody}</Caption>
        {gate.hasPin ? <PinEntry prompt={t.wipePin} gate={gate} onComplete={async (pin) => { if (await gate.verify(pin)) wipe(); }} /> : null}
      </Sheet>
    </SettingsScreen>
  );
}

const s = StyleSheet.create({
  input: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 10, fontFamily: fonts.ui.family, fontSize: 14, textAlignVertical: "top" },
});
