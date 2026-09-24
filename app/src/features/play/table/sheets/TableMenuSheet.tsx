import React from "react";
import { StyleSheet, View } from "react-native";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { NavRow } from "../../../../components/ui/NavRow";
import { Sheet } from "../../../../components/ui/Sheet";
import { ToggleRow } from "../../../../components/ui/ToggleRow";
import { useTheme } from "../../../../context/ThemeContext";
import { T } from "../copy";

export type SheetName = "menu" | "rules" | "info" | "last" | "arrange" | "tracker" | "hint" | "leave";

/** The table menu (mockup `sheet==='menu'`): what this table plays, how the hand is laid out, the profile switches that apply here, leaving. */
export function TableMenuSheet({ visible, onClose, go, hints, onHints, timer, onTimer, canLast, onLeave }: {
  visible: boolean; onClose: () => void; go: (s: SheetName) => void;
  hints: boolean; onHints: (v: boolean) => void;
  /** undefined hides the switch (online tables use the server clock) */
  timer?: boolean; onTimer?: (v: boolean) => void;
  canLast: boolean; onLeave?: () => void;
}) {
  useTheme();
  const S = T.sheets;
  return (
    <Sheet visible={visible} title={S.table} onClose={onClose}
      actions={<>{onLeave ? <GoldButton label={S.leaveMatch} kind="glass" onPress={onLeave} /> : null}<GoldButton label={S.backToGame} onPress={onClose} /></>}>
      <View style={s.list}>
        <NavRow title={S.houseRules} caption={S.rulesCaption} onPress={() => go("rules")} />
        <NavRow title={S.arrange} caption={S.arrangeCaption} onPress={() => go("arrange")} />
        <NavRow title={S.tracker} caption={S.trackerCaption} onPress={() => go("tracker")} />
        {canLast ? <NavRow title={S.lastTrick} caption={S.lastCaption} onPress={() => go("last")} /> : null}
        <NavRow title={S.tableInfo} caption={S.infoCaption} onPress={() => go("info")} />
        <ToggleRow label={S.hints} hint={S.hintsHint} value={hints} onChange={onHints} />
        {timer !== undefined && onTimer ? <ToggleRow label={S.timer} hint={S.timerHint} value={timer} onChange={onTimer} /> : null}
      </View>
    </Sheet>
  );
}
const s = StyleSheet.create({ list: { gap: 8 } });
