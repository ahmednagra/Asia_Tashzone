import React from "react";
import { StyleSheet, View } from "react-native";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { NavRow } from "../../../../components/ui/NavRow";
import { Sheet } from "../../../../components/ui/Sheet";
import { ToggleRow } from "../../../../components/ui/ToggleRow";

export type SheetName = "menu" | "rules" | "info" | "last" | "arrange" | "tracker" | "hint" | "leave";

/** The table menu (mockup `sheet==='menu'`): what this table plays, how the hand is laid out, the profile switches that apply here, leaving. */
export function TableMenuSheet({ visible, onClose, go, hints, onHints, timer, onTimer, canLast, onLeave }: {
  visible: boolean; onClose: () => void; go: (s: SheetName) => void;
  hints: boolean; onHints: (v: boolean) => void;
  /** undefined hides the switch (online tables use the server clock) */
  timer?: boolean; onTimer?: (v: boolean) => void;
  canLast: boolean; onLeave?: () => void;
}) {
  return (
    <Sheet visible={visible} title="Table" onClose={onClose}
      actions={<>{onLeave ? <GoldButton label="Leave this match" kind="glass" onPress={onLeave} /> : null}<GoldButton label="Back to the game" onPress={onClose} /></>}>
      <View style={s.list}>
        <NavRow title="House rules" caption="What this table plays" onPress={() => go("rules")} />
        <NavRow title="Arrange my cards" caption="Fan or spread, by suit or by rank" onPress={() => go("arrange")} />
        <NavRow title="What has gone" caption="Cards already played this hand" onPress={() => go("tracker")} />
        {canLast ? <NavRow title="The last trick" caption="Who played what" onPress={() => go("last")} /> : null}
        <NavRow title="Table info" caption="Game, rules preset and bots" onPress={() => go("info")} />
        <ToggleRow label="Hints" hint="Adds a Hint button on your turn" value={hints} onChange={onHints} />
        {timer !== undefined && onTimer ? <ToggleRow label="Turn timer" hint="A bar counts down; when it ends, a card is played for you" value={timer} onChange={onTimer} /> : null}
      </View>
    </Sheet>
  );
}
const s = StyleSheet.create({ list: { gap: 8 } });
