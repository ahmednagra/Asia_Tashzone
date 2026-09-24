import React from "react";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { ChipGroup } from "../../../../components/ui/ChipGroup";
import { Sheet } from "../../../../components/ui/Sheet";
import { useTheme } from "../../../../context/ThemeContext";
import type { HandSort } from "../insights";
import { T } from "../copy";

export type HandLayout = "fan" | "spread";

/** Arrange my cards (mockup `sheet==='arrange'`): layout and sort order, a local view preference that never touches the engine. */
export function ArrangeSheet({ visible, onClose, layout, onLayout, sort, onSort }: {
  visible: boolean; onClose: () => void; layout: HandLayout; onLayout: (v: HandLayout) => void; sort: HandSort; onSort: (v: HandSort) => void;
}) {
  useTheme();
  const S = T.sheets;
  return (
    <Sheet visible={visible} title={S.arrange} onClose={onClose} actions={<GoldButton label={S.done} onPress={onClose} />}>
      <ChipGroup label={S.layout} value={layout} onChange={onLayout} options={[{ value: "fan", label: S.fan }, { value: "spread", label: S.spread }]}
        hint={layout === "spread" ? S.spreadHint : S.fanHint} />
      <ChipGroup label={S.order} value={sort} onChange={onSort} options={[{ value: "suit", label: S.bySuit }, { value: "rank", label: S.byRank }]}
        hint={sort === "rank" ? S.rankHint : S.suitHint} />
    </Sheet>
  );
}
