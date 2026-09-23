import React from "react";
import { GoldButton } from "../../../../components/ui/GoldButton";
import { ChipGroup } from "../../../../components/ui/ChipGroup";
import { Sheet } from "../../../../components/ui/Sheet";
import type { HandSort } from "../insights";

export type HandLayout = "fan" | "spread";

/** Arrange my cards (mockup `sheet==='arrange'`): layout and sort order, a local view preference that never touches the engine. */
export function ArrangeSheet({ visible, onClose, layout, onLayout, sort, onSort }: {
  visible: boolean; onClose: () => void; layout: HandLayout; onLayout: (v: HandLayout) => void; sort: HandSort; onSort: (v: HandSort) => void;
}) {
  return (
    <Sheet visible={visible} title="Arrange my cards" onClose={onClose} actions={<GoldButton label="Done" onPress={onClose} />}>
      <ChipGroup label="Layout" value={layout} onChange={onLayout} options={[{ value: "fan", label: "Fan" }, { value: "spread", label: "Spread" }]}
        hint={layout === "spread" ? "Every card is shown whole, tiled in rows." : "The classic overlap; the playable cards lift."} />
      <ChipGroup label="Order" value={sort} onChange={onSort} options={[{ value: "suit", label: "By suit" }, { value: "rank", label: "By rank" }]}
        hint={sort === "rank" ? "Highest first, regardless of suit." : "Grouped by suit, colours alternating."} />
    </Sheet>
  );
}
