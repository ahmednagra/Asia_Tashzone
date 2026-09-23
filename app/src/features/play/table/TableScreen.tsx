/**
 * The mehfil table for every game: felt inside a walnut rim, seats around the rim (3–8), the trick in the
 * middle, own hand below. Renders a SeatView only (the projection), so it can never show what the viewer
 * may not know. Game-specific controls: call picker (Callbreak), trump picker (Court Piece), take (Bhabhi).
 */
import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { type SeatMove, estimateCallbreakTricks } from "@tashzone/engine";
import { fonts, material, onTable, radius } from "../../../design/tokens";
import { type Area, tableModel } from "./logic";
import { CallPicker, RedealStrip, TakeButton, TrumpPicker } from "./Controls";
import { Hand } from "./Hand";
import { PlayingCard } from "./PlayingCard";
import { Seat } from "./Seat";

export interface TableScreenProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: any;
  names: readonly string[];
  controls?: readonly ("human" | "handover" | "bot")[];
  onMove: (m: SeatMove) => void;
  deadline?: number | null;
  textScale?: number;
}

/** Trump suggestion for Court Piece: longest suit weighted by high cards (the Medium bot's choice). */
function suggestTrump(hand: readonly string[]): string {
  let best = "S", score = -1;
  for (const suit of ["S", "H", "D", "C"]) {
    const cards = hand.filter((c) => c[1] === suit);
    const v = cards.length * 2 + cards.reduce((a, c) => a + Math.max(0, "23456789TJQKA".indexOf(c[0]!) + 2 - 10), 0);
    if (v > score) { best = suit; score = v; }
  }
  return best;
}

export function TableScreen({ view, names, controls, onMove, textScale = 1 }: TableScreenProps) {
  const { width } = useWindowDimensions();
  const me: number = view.viewer.kind === "seat" || view.viewer.kind === "handover_bot" ? view.viewer.seat : 0;
  const h = view.hand;
  const model = tableModel(view, me);
  const many = model.seats.length > 5;
  const cardW = Math.max(40, Math.min(72, Math.floor(width / (many ? 9 : 7.5))));
  const legal: readonly SeatMove[] = view.legal;
  const seatEl = (seat: number) => {
    const x = model.seats[seat]!;
    return (
      <Seat key={seat} name={names[seat] ?? `Seat ${seat + 1}`} isTurn={x.isTurn} badge={x.badge} spoken={x.spoken} out={x.out} compact={many}
        control={controls?.[seat] ?? (seat === me ? "human" : "bot")} dealer={x.dealer} />
    );
  };
  const inArea = (a: Area) => model.seats.filter((x) => x.area === a).map((x) => x.seat);
  // clockwise from the human: left side runs bottom→top, right side top→bottom
  const leftSeats = inArea("left").reverse();
  const callMoves = legal.filter((m): m is Extract<SeatMove, { t: "Call" }> => m.t === "Call");
  const canTrump = legal.some((m) => m.t === "ChooseTrump");
  const canTake = legal.some((m) => m.t === "Take");
  return (
    <View style={s.room}>
      <View style={s.rim}>
        <View style={s.felt}>
          <View style={s.top}>{inArea("top").map(seatEl)}</View>
          <View style={s.middle}>
            <View style={s.side}>{leftSeats.map(seatEl)}</View>
            <View style={s.trick} accessibilityLabel={h ? `${model.trick.length} cards in the trick` : "Waiting to deal"}>
              {model.trick.map((p, i) => (
                <View key={`${p.seat}-${i}`} style={{ position: "absolute", left: 20 + (i % 4) * 26, top: 20 + Math.floor(i / 4) * 34 }}>
                  <PlayingCard card={p.card} width={cardW * 0.85} />
                </View>
              ))}
            </View>
            <View style={s.side}>{inArea("right").map(seatEl)}</View>
          </View>
          <View style={s.hud}>{model.hud.map((t) => <Text key={t} style={s.hudText}>{t}</Text>)}</View>
          {h?.window && (
            <RedealStrip canRequest={legal.some((m) => m.t === "RequestRedeal")} requested={h.my_redeal_requested}
              onRequest={() => onMove({ t: "RequestRedeal" })} />
          )}
          {model.notice && <Text style={s.notice} accessibilityLiveRegion="polite">{model.notice}</Text>}
          {model.results && (
            <View style={s.result} accessibilityLiveRegion="assertive">
              <Text style={s.resultTitle}>Match over</Text>
              {model.results.map((r) => (
                <Text key={r.seat} style={s.resultRow}>{`${r.place ?? "-"}. ${names[r.seat] ?? `Seat ${r.seat + 1}`}  ${r.score}`}</Text>
              ))}
            </View>
          )}
        </View>
      </View>
      {seatEl(me)}
      {canTake && <TakeButton onTake={() => onMove({ t: "Take" })} />}
      {h?.my_hand && <Hand cards={h.my_hand} legal={legal} onPlay={(card) => onMove({ t: "Play", card })} cardWidth={cardW} textScale={textScale} />}
      {callMoves.length > 0 && h?.my_hand && (
        <CallPicker min={callMoves[0]!.n} max={callMoves[callMoves.length - 1]!.n}
          suggestion={Math.min(view.rules.call_max, Math.max(view.rules.call_min, Math.round(estimateCallbreakTricks(h.my_hand, view.rules.trump))))}
          onCall={(n) => onMove({ t: "Call", n })} />
      )}
      {canTrump && h?.my_hand && <TrumpPicker suggestion={suggestTrump(h.my_hand)} onChoose={(suit) => onMove({ t: "ChooseTrump", suit })} />}
    </View>
  );
}

const s = StyleSheet.create({
  room: { flex: 1, backgroundColor: material.feltRim, paddingHorizontal: 8, paddingBottom: 8, gap: 8 },
  rim: { flex: 1, borderRadius: 36, backgroundColor: material.walnut, padding: 10, borderWidth: 1, borderColor: material.walnutLit },
  felt: { flex: 1, borderRadius: 28, backgroundColor: material.felt, borderWidth: 1, borderColor: material.goldLeafDim, padding: 12, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center" },
  middle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { gap: 12, alignItems: "center" },
  trick: { width: 170, height: 170, position: "relative" },
  hud: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6 },
  hudText: { color: onTable.secondary, fontFamily: fonts.ui.family, fontSize: 13 },
  notice: { color: onTable.warning, textAlign: "center", fontSize: 15 },
  result: { backgroundColor: "rgba(3,17,13,0.9)", borderRadius: radius.sheet, padding: 16, gap: 4 },
  resultTitle: { color: onTable.gold, fontFamily: fonts.display.family, fontSize: 24, fontWeight: "600" },
  resultRow: { color: onTable.text, fontSize: 17, fontVariant: ["tabular-nums"] },
});
