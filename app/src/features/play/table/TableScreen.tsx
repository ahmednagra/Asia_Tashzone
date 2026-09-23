/**
 * The mehfil table for every game (mockup `tableChrome` / `seatsHTML` / `paint`): top bar with who acts, the felt
 * inside a walnut rail with seats around it (3–8), the trick in the middle, the player's own plate, actions and
 * hand fan below. Renders a SeatView only (the projection), so it can never show what the viewer may not know.
 * Game-specific controls: call picker (Callbreak), trump picker (Court Piece), take (Bhabhi).
 */
import React, { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type SeatMove, estimateCallbreakTricks } from "@tashzone/engine";
import { ConfirmSheet } from "../../../components/ui/ConfirmSheet";
import { useTheme } from "../../../context/ThemeContext";
import { useProfile } from "../../../store/profile";
import { fonts, material, onTable } from "../../../theme/tokens";
import { ActionPill, FeltChip, RoundButton } from "./chrome";
import { CallPicker, HandOverStrip, RedealStrip, TakeButton, TrumpPicker } from "./Controls";
import { Felt } from "./Felt";
import { Hand } from "./Hand";
import { useDeadlineLeft, useTrickHold, useTurnClock } from "./hooks";
import { breakWarning, type HandSort, instructionLine, lastTrick, mySeat, phaseWord, statusLine, voidTags } from "./insights";
import { type Area, cardLabel, tableModel, trickOffset } from "./logic";
import { MePlate } from "./MePlate";
import { PlayingCard } from "./PlayingCard";
import { Seat } from "./Seat";
import { ArrangeSheet, type HandLayout } from "./sheets/ArrangeSheet";
import { HintSheet } from "./sheets/HintSheet";
import { InfoSheet } from "./sheets/InfoSheet";
import { LastTrickSheet } from "./sheets/LastTrickSheet";
import { RulesSheet } from "./sheets/RulesSheet";
import { type SheetName, TableMenuSheet } from "./sheets/TableMenuSheet";
import { TrackerSheet } from "./sheets/TrackerSheet";

export interface TableScreenProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: any;
  names: readonly string[];
  controls?: readonly ("human" | "handover" | "bot")[];
  onMove: (m: SeatMove) => void;
  textScale?: number;
  /** transient message above the hand (rejected move, clock ran out) */
  toast?: string | null;
  /** offline: the engine's own suggestion; enables the Hint button (with profile.hints) and the turn clock's autoplay */
  hint?: () => SeatMove | null;
  /** offline: called when a card that cannot be played is tapped, so the caller can say why */
  onBlocked?: (card: string) => void;
  undo?: { can: boolean; run: () => void };
  /** enables "Leave this match" in the menu; the confirm dialog is built in */
  onLeave?: () => void;
  /** rows for the table-info sheet */
  info?: readonly (readonly [string, string])[];
  /** online: when the server will act for the player (epoch ms); drives the clock bar */
  deadline?: number | null;
  /** the turn clock is on when set (offline); it plays `hint()` for the human when it runs out */
  clock?: { onExpire: () => void };
  /** offline: the table is holding the next deal */
  betweenHands?: { title: string; primaryLabel: string; onPrimary: () => void; secondaryLabel: string; onSecondary: () => void } | null;
}

/** Trump suggestion for Court Piece: longest suit weighted by high cards (the Medium bot's choice). */
function suggestTrump(hand: readonly string[]): string {
  let best = "S", score = -1;
  for (const suit of ["S", "H", "D", "C"]) {
    const cardsOf = hand.filter((c) => c[1] === suit);
    const v = cardsOf.length * 2 + cardsOf.reduce((a, c) => a + Math.max(0, "23456789TJQKA".indexOf(c[0]!) + 2 - 10), 0);
    if (v > score) { best = suit; score = v; }
  }
  return best;
}

const TRICK_W = 190, TRICK_H = 170;

export function TableScreen({ view, names, controls, onMove, textScale = 1, toast, hint, onBlocked, undo, onLeave, info, clock, deadline, betweenHands }: TableScreenProps) {
  const { width } = useWindowDimensions();
  const inset = useSafeAreaInsets();
  const { largeCards } = useTheme();
  const { profile, update } = useProfile();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [layout, setLayout] = useState<HandLayout>("fan");
  const [sort, setSort] = useState<HandSort>("suit");
  const [hintMove, setHintMove] = useState<SeatMove | null>(null);

  const me = mySeat(view);
  const h = view.hand;
  const model = tableModel(view, me, names);
  const many = model.seats.length > 5;
  const cardW = Math.min(largeCards ? 84 : 72, Math.max(40, Math.floor((width / (many ? 9 : 7.5)) * (largeCards ? 1.15 : 1))));
  const legal: readonly SeatMove[] = view.legal;
  const myTurn = !!h && h.turn === me && legal.length > 0 && !view.match.over;
  const shown = useTrickHold(view, names, 900);
  const status = statusLine(view, names);
  const instruction = instructionLine(view, names);
  const warn = breakWarning(view, names);
  const last = lastTrick(view, names);
  const nameOf = (seat: number) => names[seat] ?? `Seat ${seat + 1}`;

  // turn clock: only where the caller supplies autoplay, the profile asks for it and it is the player's move
  const totalMs: number = view.rules?.turn_ms ?? 20000;
  const clockOn = !!clock && profile.timer && !profile.easy && myTurn && h.phase !== "WINDOW";
  const turnKey = h ? `${h.hand_id}|${h.phase}|${h.trick?.length ?? 0}|${h.my_hand?.length ?? 0}|${h.turn}` : "none";
  const localLeft = useTurnClock(clockOn, turnKey, totalMs, sheet !== null, () => clock?.onExpire());
  const serverOn = !clock && !!deadline && profile.timer && !profile.easy && myTurn;
  const serverLeft = useDeadlineLeft(deadline, serverOn);
  const remaining = serverLeft ?? localLeft;
  const showClock = clockOn || (serverOn && serverLeft !== null);

  const inArea = (a: Area) => model.seats.filter((x) => x.area === a).map((x) => x.seat);
  const seatEl = (seat: number) => {
    const x = model.seats[seat]!;
    return (
      <Seat key={seat} name={nameOf(seat)} isTurn={x.isTurn} badge={x.badge} spoken={x.spoken} out={x.out} compact={many}
        voids={voidTags(view, seat)} control={controls?.[seat] ?? "bot"} dealer={x.dealer} />
    );
  };
  // clockwise from the human: left side runs bottom→top, right side top→bottom
  const leftSeats = inArea("left").reverse();
  const callMoves = legal.filter((m): m is Extract<SeatMove, { t: "Call" }> => m.t === "Call");
  const canTrump = legal.some((m) => m.t === "ChooseTrump");
  const canTake = legal.some((m) => m.t === "Take");
  const notice = model.notice ?? shown.taken;
  const close = () => setSheet(null);
  const w = Math.round(cardW * 0.85);

  return (
    <View style={[s.room, { paddingTop: inset.top + 4, paddingBottom: Math.max(inset.bottom, 8) }]}>
      <View style={s.topBar}>
        <RoundButton glyph="☰" label="Table menu" onPress={() => setSheet("menu")} />
        <Text style={[s.status, status.mine && { color: material.goldLeafHot }]} numberOfLines={1} accessibilityRole="header" accessibilityLiveRegion="polite">{status.text}</Text>
        <RoundButton glyph="▦" label="What has gone" onPress={() => setSheet("tracker")} />
      </View>

      <View style={s.scene}>
        <Felt>
          <View style={s.hudRow}>{model.hud.map((t) => <FeltChip key={t} text={t} />)}</View>
          <View style={s.top}>{inArea("top").map(seatEl)}</View>
          <View style={s.middle}>
            <View style={s.side}>{leftSeats.map(seatEl)}</View>
            <View style={s.center}>
              <Text style={s.phase} accessibilityElementsHidden importantForAccessibility="no">{phaseWord(view)}</Text>
              <View style={s.trick} accessible accessibilityLabel={h && shown.trick.length ? `In the trick: ${shown.trick.map((p) => `${nameOf(p.seat)}, ${cardLabel(p.card)}`).join("; ")}` : h ? "No cards in the trick" : "Waiting to deal"}>
                {shown.trick.map((p) => {
                  const area = model.seats[p.seat]!.area;
                  const idx = Math.max(0, inArea(area).indexOf(p.seat));
                  const off = trickOffset(area, idx);
                  return (
                    <View key={`${p.seat}-${p.card}`} style={{ position: "absolute", left: TRICK_W / 2 - w / 2 + off.x, top: TRICK_H / 2 - (w * 1.4) / 2 + off.y }}>
                      <PlayingCard card={p.card} width={w} />
                    </View>
                  );
                })}
              </View>
              {warn ? <Text style={s.warn} accessibilityLiveRegion="assertive">{warn}</Text> : null}
            </View>
            <View style={s.side}>{inArea("right").map(seatEl)}</View>
          </View>
          <View style={s.noticeBox}>
            {h?.window ? <RedealStrip canRequest={legal.some((m) => m.t === "RequestRedeal")} requested={h.my_redeal_requested} onRequest={() => onMove({ t: "RequestRedeal" })} /> : null}
            {notice ? <Text style={s.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
          </View>
        </Felt>
      </View>

      <View style={s.foot}>
        <MePlate name={nameOf(me)} avatar={profile.avatar} cards={h?.my_hand?.length ?? 0} turn={myTurn} instruction={instruction}
          clock={showClock ? { remainingMs: remaining, totalMs } : null} />
        <View style={s.actions}>
          {undo?.can ? <ActionPill label="↶ Undo" onPress={undo.run} /> : null}
          {last ? <ActionPill label="Last trick" onPress={() => setSheet("last")} /> : null}
          <ActionPill label="⇄ Arrange" onPress={() => setSheet("arrange")} />
          {profile.hints && hint && myTurn ? <ActionPill label="Hint" primary onPress={() => { setHintMove(hint()); setSheet("hint"); }} /> : null}
        </View>
      </View>

      {betweenHands ? <HandOverStrip {...betweenHands} /> : null}
      {toast ? <Text style={s.toast} accessibilityLiveRegion="assertive">{toast}</Text> : null}
      {canTake && <TakeButton onTake={() => onMove({ t: "Take" })} />}
      {h?.my_hand && (
        <Hand cards={h.my_hand} legal={legal} layout={layout} sort={sort} cardWidth={cardW} textScale={textScale}
          onPlay={(card) => onMove({ t: "Play", card })} onBlocked={onBlocked} />
      )}
      {callMoves.length > 0 && h?.my_hand && (
        <CallPicker min={callMoves[0]!.n} max={callMoves[callMoves.length - 1]!.n}
          suggestion={Math.min(view.rules.call_max, Math.max(view.rules.call_min, Math.round(estimateCallbreakTricks(h.my_hand, view.rules.trump))))}
          onCall={(n) => onMove({ t: "Call", n })} />
      )}
      {canTrump && h?.my_hand && <TrumpPicker suggestion={suggestTrump(h.my_hand)} onChoose={(suit) => onMove({ t: "ChooseTrump", suit })} />}

      <TableMenuSheet visible={sheet === "menu"} onClose={close} go={setSheet} canLast={!!last}
        hints={profile.hints} onHints={(v) => update({ hints: v })}
        timer={clock ? profile.timer : undefined} onTimer={(v) => update({ timer: v })}
        onLeave={onLeave ? () => setSheet("leave") : undefined} />
      <RulesSheet visible={sheet === "rules"} onClose={close} view={view} />
      <InfoSheet visible={sheet === "info"} onClose={close} title="Table info" rows={info ?? []} />
      <LastTrickSheet visible={sheet === "last"} onClose={close} view={view} names={names} />
      <ArrangeSheet visible={sheet === "arrange"} onClose={close} layout={layout} onLayout={setLayout} sort={sort} onSort={setSort} />
      <TrackerSheet visible={sheet === "tracker"} onClose={close} view={view} />
      <HintSheet visible={sheet === "hint"} onClose={close} view={view} move={hintMove} />
      <ConfirmSheet visible={sheet === "leave"} title="Leave this match?" onCancel={close} onConfirm={() => { close(); onLeave?.(); }}
        confirmLabel="Leave the match" cancelLabel="Stay at the table"
        standing={[`${h?.my_hand?.length ?? 0} in hand`, `${model.seats.length} seats`, ...(h ? [`${model.hud[0] ?? ""}`] : [])].filter(Boolean)}
        facts={[
          { mark: "H", title: "This game ends here", body: "A game against bots is not held open: leaving closes the table for good." },
          h && h.phase !== "DONE" && !view.match.over
            ? { mark: "!", title: "The hand in progress is dropped", body: "No result is recorded for it, and the running score goes with it." }
            : { mark: "·", title: "Nothing is in progress", body: "You can leave without losing anything." },
        ]} />
    </View>
  );
}

const s = StyleSheet.create({
  room: { flex: 1, backgroundColor: material.feltRim, paddingHorizontal: 8, gap: 8 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  status: { flex: 1, color: onTable.secondary, fontFamily: fonts.display.family, fontSize: 17, fontWeight: "600" },
  scene: { flex: 1 },
  hudRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center" },
  middle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { gap: 12, alignItems: "center" },
  center: { alignItems: "center", flexShrink: 1 },
  phase: { color: material.goldLeafDim, fontFamily: fonts.display.family, fontSize: 12, letterSpacing: 3 },
  trick: { width: TRICK_W, height: TRICK_H, position: "relative" },
  warn: { color: onTable.text, backgroundColor: material.feltRim, borderWidth: 1, borderColor: onTable.error, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, textAlign: "center", maxWidth: 240 },
  noticeBox: { gap: 6, minHeight: 20 },
  notice: { color: onTable.warning, textAlign: "center", fontSize: 14 },
  foot: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 7, flex: 1, justifyContent: "flex-end" },
  toast: { alignSelf: "center", color: onTable.text, fontSize: 15, backgroundColor: material.feltDeep, borderWidth: 1, borderColor: onTable.gold, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
});
