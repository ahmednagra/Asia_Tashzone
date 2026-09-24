import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type SeatMove, estimateCallbreakTricks } from "@tashzone/engine";
import { ConfirmSheet } from "../../../components/ui/ConfirmSheet";
import { useTheme } from "../../../context/ThemeContext";
import { useProfile } from "../../../store/profile";
import { fonts, material, onTable } from "../../../theme/tokens";
import { triggerSound } from "../../../utils/sound";
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
  toast?: string | null;
  hint?: () => SeatMove | null;
  onBlocked?: (card: string) => void;
  undo?: { can: boolean; run: () => void };
  onLeave?: () => void;
  info?: readonly (readonly [string, string])[];
  deadline?: number | null;
  clock?: { onExpire: () => void };
  betweenHands?: { title: string; primaryLabel: string; onPrimary: () => void; secondaryLabel: string; onSecondary: () => void } | null;
}

function suggestTrump(hand: readonly string[]): string {
  let best = "S", score = -1;
  for (const suit of ["S", "H", "D", "C"]) {
    const cardsOf = hand.filter((c) => c[1] === suit);
    const v = cardsOf.length * 2 + cardsOf.reduce((a, c) => a + Math.max(0, "23456789TJQKA".indexOf(c[0]!) + 2 - 10), 0);
    if (v > score) { best = suit; score = v; }
  }
  return best;
}

export function TableScreen({
  view,
  names,
  controls,
  onMove,
  textScale = 1,
  toast,
  hint,
  onBlocked,
  undo,
  onLeave,
  info,
  clock,
  deadline,
  betweenHands,
}: TableScreenProps) {
  const { width, height } = useWindowDimensions();
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
  const isCompact = height < 740;

  const cardW = Math.min(
    largeCards ? 80 : 70,
    Math.max(42, Math.floor((width / (many ? 9.2 : 7.6)) * (largeCards ? 1.12 : 1)))
  );

  const legal: readonly SeatMove[] = view.legal;
  const myTurn = !!h && h.turn === me && legal.length > 0 && !view.match.over;
  const shown = useTrickHold(view, names, 900);
  const status = statusLine(view, names);
  const instruction = instructionLine(view, names);
  const warn = breakWarning(view, names);
  const last = lastTrick(view, names);
  const nameOf = (seat: number) => names[seat] ?? `Seat ${seat + 1}`;

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
      <Seat
        key={seat}
        name={nameOf(seat)}
        isTurn={x.isTurn}
        badge={x.badge}
        spoken={x.spoken}
        out={x.out}
        compact={many || isCompact}
        voids={voidTags(view, seat)}
        control={controls?.[seat] ?? "bot"}
        dealer={x.dealer}
      />
    );
  };

  const leftSeats = inArea("left").reverse();
  const callMoves = legal.filter((m): m is Extract<SeatMove, { t: "Call" }> => m.t === "Call");
  const canTrump = legal.some((m) => m.t === "ChooseTrump");
  const canTake = legal.some((m) => m.t === "Take");
  const notice = model.notice ?? shown.taken;
  const close = () => setSheet(null);

  const trickW = isCompact ? 160 : 180;
  const trickH = isCompact ? 135 : 155;
  const w = Math.round(cardW * (isCompact ? 0.75 : 0.82));

  const flashAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (warn) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start();
    }
  }, [warn, flashAnim]);

  const flashBorderColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(227, 189, 110, 0.3)", "#d13028"],
  });

  return (
    <View
      style={[
        s.room,
        {
          paddingTop: inset.top + 2,
          paddingBottom: Math.max(inset.bottom, 4),
        },
      ]}
    >
      <View style={s.topBar}>
        <RoundButton glyph="☰" label="Table menu" onPress={() => setSheet("menu")} />
        <Text
          style={[s.status, status.mine && { color: material.goldLeafHot }]}
          numberOfLines={1}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {status.text}
        </Text>
        <RoundButton glyph="▦" label="What has gone" onPress={() => setSheet("tracker")} />
      </View>

      <View style={s.scene}>
        <Animated.View style={{ flex: 1, borderColor: flashBorderColor }}>
          <Felt>
            <View style={s.hudRow}>
              {model.hud.map((t) => (
                <FeltChip key={t} text={t} />
              ))}
            </View>

            <View style={s.topSeatsRow}>{inArea("top").map(seatEl)}</View>

            <View style={s.middleArena}>
              <View style={s.sideSeats}>{leftSeats.map(seatEl)}</View>

              <View style={s.centerStage}>
                <Text style={s.phase} accessibilityElementsHidden importantForAccessibility="no">
                  {phaseWord(view)}
                </Text>
                <View
                  style={[s.trick, { width: trickW, height: trickH }]}
                  accessible
                  accessibilityLabel={
                    h && shown.trick.length
                      ? `In the trick: ${shown.trick.map((p) => `${nameOf(p.seat)}, ${cardLabel(p.card)}`).join("; ")}`
                      : h
                      ? "No cards in the trick"
                      : "Waiting to deal"
                  }
                >
                  {shown.trick.map((p) => {
                    const area = model.seats[p.seat]!.area;
                    const idx = Math.max(0, inArea(area).indexOf(p.seat));
                    const off = trickOffset(area, idx);
                    return (
                      <View
                        key={`${p.seat}-${p.card}`}
                        style={{
                          position: "absolute",
                          left: trickW / 2 - w / 2 + off.x,
                          top: trickH / 2 - (w * 1.4) / 2 + off.y,
                        }}
                      >
                        <PlayingCard card={p.card} width={w} />
                      </View>
                    );
                  })}
                </View>
                {warn ? <Text style={s.warn} accessibilityLiveRegion="assertive">{warn}</Text> : null}
              </View>

              <View style={s.sideSeats}>{inArea("right").map(seatEl)}</View>
            </View>

            <View style={s.noticeBox}>
              {h?.window ? (
                <RedealStrip
                  canRequest={legal.some((m) => m.t === "RequestRedeal")}
                  requested={h.my_redeal_requested}
                  onRequest={() => onMove({ t: "RequestRedeal" })}
                />
              ) : null}
              {notice ? (
                <Text style={s.notice} accessibilityLiveRegion="polite">
                  {notice}
                </Text>
              ) : null}
            </View>
          </Felt>
        </Animated.View>
      </View>

      <View style={s.bridgeBar}>
        <MePlate
          name={nameOf(me)}
          avatar={profile.avatar}
          cards={h?.my_hand?.length ?? 0}
          turn={myTurn}
          instruction={instruction}
          clock={showClock ? { remainingMs: remaining, totalMs } : null}
        />
        <View style={s.actionsRow}>
          {undo?.can ? <ActionPill label="↶ Undo" onPress={undo.run} /> : null}
          {last ? <ActionPill label="Last" onPress={() => setSheet("last")} /> : null}
          <ActionPill label="⇄ Arrange" onPress={() => setSheet("arrange")} />
          {profile.hints && hint && myTurn ? (
            <ActionPill
              label="Hint"
              primary
              onPress={() => {
                setHintMove(hint());
                setSheet("hint");
              }}
            />
          ) : null}
        </View>
      </View>

      {toast ? (
        <Text style={s.toast} accessibilityLiveRegion="assertive">
          {toast}
        </Text>
      ) : null}

      {h?.my_hand && (
        <Hand
          cards={h.my_hand}
          legal={legal}
          layout={layout}
          sort={sort}
          cardWidth={cardW}
          textScale={textScale}
          onPlay={(card) => onMove({ t: "Play", card })}
          onBlocked={onBlocked}
        />
      )}

      {callMoves.length > 0 && h?.my_hand && (
        <View style={s.floatingOverlay}>
          <CallPicker
            min={callMoves[0]!.n}
            max={callMoves[callMoves.length - 1]!.n}
            suggestion={Math.min(
              view.rules.call_max,
              Math.max(
                view.rules.call_min,
                Math.round(estimateCallbreakTricks(h.my_hand, view.rules.trump))
              )
            )}
            onCall={(n) => onMove({ t: "Call", n })}
          />
        </View>
      )}

      {canTrump && h?.my_hand && (
        <View style={s.floatingOverlay}>
          <TrumpPicker
            suggestion={suggestTrump(h.my_hand)}
            onChoose={(suit) => onMove({ t: "ChooseTrump", suit })}
          />
        </View>
      )}

      {canTake && (
        <View style={s.floatingOverlay}>
          <TakeButton onTake={() => onMove({ t: "Take" })} />
        </View>
      )}

      {betweenHands && (
        <View style={s.floatingOverlay}>
          <HandOverStrip {...betweenHands} />
        </View>
      )}

      <TableMenuSheet
        visible={sheet === "menu"}
        onClose={close}
        go={setSheet}
        canLast={!!last}
        hints={profile.hints}
        onHints={(v) => update({ hints: v })}
        timer={clock ? profile.timer : undefined}
        onTimer={(v) => update({ timer: v })}
        onLeave={onLeave ? () => setSheet("leave") : undefined}
      />
      <RulesSheet visible={sheet === "rules"} onClose={close} view={view} />
      <InfoSheet visible={sheet === "info"} onClose={close} title="Table info" rows={info ?? []} />
      <LastTrickSheet visible={sheet === "last"} onClose={close} view={view} names={names} />
      <ArrangeSheet
        visible={sheet === "arrange"}
        onClose={close}
        layout={layout}
        onLayout={setLayout}
        sort={sort}
        onSort={setSort}
      />
      <TrackerSheet visible={sheet === "tracker"} onClose={close} view={view} />
      <HintSheet visible={sheet === "hint"} onClose={close} view={view} move={hintMove} />
      <ConfirmSheet
        visible={sheet === "leave"}
        title="Leave this match?"
        onCancel={close}
        onConfirm={() => {
          close();
          onLeave?.();
        }}
        confirmLabel="Leave the match"
        cancelLabel="Stay at the table"
        standing={[
          `${h?.my_hand?.length ?? 0} in hand`,
          `${model.seats.length} seats`,
          ...(h ? [`${model.hud[0] ?? ""}`] : []),
        ].filter(Boolean)}
        facts={[
          {
            mark: "H",
            title: "This game ends here",
            body: "A game against bots is not held open: leaving closes the table for good.",
          },
          h && h.phase !== "DONE" && !view.match.over
            ? {
                mark: "!",
                title: "The hand in progress is dropped",
                body: "No result is recorded for it, and the running score goes with it.",
              }
            : {
                mark: "·",
                title: "Nothing is in progress",
                body: "You can leave without losing anything.",
              },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  room: {
    flex: 1,
    backgroundColor: material.feltRim,
    paddingHorizontal: 6,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 2,
  },
  status: {
    flex: 1,
    color: onTable.secondary,
    fontFamily: fonts.display.family,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  scene: {
    flex: 1,
    minHeight: 0,
    marginVertical: 2,
  },
  hudRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 5,
  },
  topSeatsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 2,
  },
  middleArena: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  sideSeats: {
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  centerStage: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },
  phase: {
    color: material.goldLeafDim,
    fontFamily: fonts.display.family,
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  trick: {
    position: "relative",
  },
  warn: {
    color: onTable.text,
    backgroundColor: material.feltRim,
    borderWidth: 1,
    borderColor: onTable.error,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    textAlign: "center",
    maxWidth: 220,
    marginTop: 2,
  },
  noticeBox: {
    minHeight: 18,
    justifyContent: "center",
  },
  notice: {
    color: onTable.warning,
    textAlign: "center",
    fontSize: 13,
  },
  bridgeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  toast: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    color: onTable.text,
    fontSize: 14,
    backgroundColor: "rgba(6, 32, 25, 0.94)",
    borderWidth: 1.5,
    borderColor: onTable.gold,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    zIndex: 200,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingOverlay: {
    position: "absolute",
    bottom: 110,
    left: 10,
    right: 10,
    zIndex: 150,
  },
});
