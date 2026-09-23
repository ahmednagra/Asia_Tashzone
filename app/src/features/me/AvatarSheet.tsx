import React, { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";
import { AvatarPicker } from "../../components/ui/AvatarPicker";
import { Caption } from "../../components/ui/Caption";
import { GoldButton } from "../../components/ui/GoldButton";
import { SectionLabel } from "../../components/ui/SectionLabel";
import { Sheet } from "../../components/ui/Sheet";
import { useTheme } from "../../context/ThemeContext";
import { useProfile } from "../../store/profile";
import { fonts } from "../../theme/tokens";
import { T } from "./copy";

/** Avatar picker and name editor (mockup `sheet:avatar`). The avatar saves on tap; the name saves on Done or when the sheet closes. */
export function AvatarSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const { profile, update } = useProfile();
  const [draft, setDraft] = useState(profile.name);
  const t = T.sheet;

  useEffect(() => { if (visible) setDraft(profile.name); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    const name = draft.trim();
    if (name && name !== profile.name) update({ name });
    onClose();
  };
  return (
    <Sheet visible={visible} title={t.title} onClose={finish} actions={<GoldButton label={t.done} onPress={finish} />}>
      <Caption>{t.body}</Caption>
      <AvatarPicker value={profile.avatar} onChange={(avatar) => update({ avatar })} />
      <SectionLabel>{t.nameLabel}</SectionLabel>
      <TextInput value={draft} onChangeText={setDraft} maxLength={24} placeholder={t.namePlaceholder} placeholderTextColor={c.textMuted}
        accessibilityLabel={t.nameLabel} returnKeyType="done" onSubmitEditing={finish} autoCorrect={false}
        style={[s.input, { color: c.text, borderColor: c.borderControl }]} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, marginTop: 6, marginBottom: 8, fontFamily: fonts.ui.family, fontSize: 18 },
});
