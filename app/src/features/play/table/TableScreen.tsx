import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type SeatMove, estimateCallbreakTricks } from "@tashzone/engine";
import { ConfirmSheet } from "../../../components/ui/ConfirmSheet";
import { useTheme } from "../../../context/ThemeContext";
import { useBackAction } from "../../../hooks/useBackAction";
import { useProfile } from "../../../store/profile";
import { fonts, onTable } from "../../../theme/tokens";
import { displayFace, scriptText } from "../../../i18n";
import { useFeel } from "../../../utils/feel";
import { FeltChip, RoundButton, TurnClock } from "./chrome";
import { CallPicker, HandOverStrip, RedealStrip, TakeButton, TrumpPicker } from "./Controls";
import { Felt } from "./Felt";
import { Hand } from "./Hand";
import { useTrickHold } from "./hooks";
import { breakWarning, type HandSort, instructionLine, lastTrick, mySeat, phaseWord, statusLine, voidTags } from "./insights";
import { type Area, cardLabel, seatName, tableModel, trickOffset } from "./logic";
import { T } from "./copy";
import { MePlate } from "./MePlate";
import { Seat } from "./Seat";
import { ArrangeSheet, type HandLayout } from "./sheets/ArrangeSheet";
import { HintSheet } from "./sheets/HintSheet";
import { InfoSheet } from "./sheets/InfoSheet";
import { LastTrickSheet } from "./sheets/LastTrickSheet";
import { RulesSheet } from "./sheets/RulesSheet";
import { type SheetName, TableMenuSheet } from "./sheets/TableMenuSheet";
import { TrackerSheet } from "./sheets/TrackerSheet";
import { TrickCard } from "./TrickCard";

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
  const landscape = width > height;
  const inset = useSafeAreaInsets();
  const { t, calm, largeCards, lang, rtl } = useTheme();
  const feel = useFeel();
  const focused = useIsFocused();
  const { profile, update } = useProfile();
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [layout, setLayout] = useState<HandLayout>("fan");
  const [sort, setSort] = useState<HandSort>("suit");
  const [hintMove, setHintMove] = useState<SeatMove | null>(null);
  const [feltH, setFeltH] = useState(999);
  const [roomH, setRoomH] = useState(0);
  const [handTop, setHandTop] = useState<number | null>(null);

  const me = mySeat(view);
  const h = view.hand;
  const model = useMemo(() => tableModel(view, me, names), [view, me, names, lang]);
  const voids = useMemo(() => model.seats.map((x) => voidTags(view, x.seat)), [view, model, lang]);
  const many = model.seats.length > 5;
  const isCompact = landscape || height < 700;
  const sideW = landscape ? Math.round(Math.min(width * 0.46, 420)) : 0;

  const cardW = landscape
    ? Math.min(largeCards ? 80 : 70, Math.max(42, Math.floor(Math.min(width / 7.6, height * 0.2) * (largeCards ? 1.12 : 1))))
    : Math.min(largeCards ? 80 : 70, Math.max(42, Math.floor((width / (many ? 9.2 : 7.6)) * (largeCards ? 1.12 : 1))));
  const handW = landscape ? sideW - 8 : Math.min(width - 16 - inset.left - inset.right, 680);

  const legal: readonly SeatMove[] = view.legal;
  const myTurn = !!h && h.turn === me && legal.length > 0 && !view.match.over;
  const shown = useTrickHold(view, names, 900);
  const status = statusLine(view, names);
  const instruction = instructionLine(view, names);
  const warn = breakWarning(view, names);
  const last = lastTrick(view, names);
  const nameOf = (seat: number) => seatName(names, seat);
  const S = T.screen;

  const totalMs: number = view.rules?.turn_ms ?? 20000;
  const clockOn = !!clock && profile.timer && !profile.easy && myTurn && h.phase !== "WINDOW";
  const turnKey = h ? `${h.hand_id}|${h.phase}|${h.trick?.length ?? 0}|${h.my_hand?.length ?? 0}|${h.turn}` : "none";
  const serverOn = !clock && !!deadline && profile.timer && !profile.easy && myTurn;

  const live = useRef({ onMove, onBlocked, clock, feel });
  live.current = { onMove, onBlocked, clock, feel };
  const expire = useCallback(() => live.current.clock?.onExpire(), []);
  const playCard = useCallback((card: string) => {
    live.current.feel("play");
    live.current.onMove({ t: "Play", card });
  }, []);
  const hasBlocked = !!onBlocked;
  const blocked = useMemo(() => (hasBlocked ? (card: string) => live.current.onBlocked?.(card) : undefined), [hasBlocked]);

  const wasTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !wasTurn.current) live.current.feel("turn");
    wasTurn.current = myTurn;
  }, [myTurn]);
  useEffect(() => { if (shown.taken) live.current.feel("trick"); }, [shown.taken]);
  useEffect(() => { if (warn) live.current.feel("warn"); }, [warn]);

  useBackAction(() => setSheet("leave"), !!onLeave && focused && sheet === null);

  const inArea = (a: Area) => model.seats.filter((x) => x.area === a).map((x) => x.seat);
  const badgeColor = model.game === "callbreak" ? t.value.bid : model.game === "courtpiece" ? t.value.points : undefined;
  const seatEl = (seat: number) => {
    const x = model.seats[seat]!;
    return (
      <Seat
        key={seat}
        name={nameOf(seat)}
        isTurn={x.isTurn}
        badge={x.badge}
        badgeColor={badgeColor}
        spoken={x.spoken}
        out={x.out}
        compact={many || isCompact}
        voids={voids[seat]}
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
  const close = useCallback(() => setSheet(null), []);

  const trickW = isCompact ? 160 : 180;
  const trickH = isCompact ? 135 : 155;
  const w = Math.round(cardW * (isCompact ? 0.75 : 0.82));

  const flashAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!warn) { flashAnim.setValue(0); return; }
    const anim = calm
      ? Animated.timing(flashAnim, { toValue: 1, duration: 120, useNativeDriver: true })
      : Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]);
    anim.start();
    return () => anim.stop();
  }, [warn, calm, flashAnim]);

  const topBar = (
    <View style={s.topBar}>
      <RoundButton glyph="☰" label={S.menu} onPress={() => setSheet("menu")} />
      <Text
        style={[s.status, displayFace(t.type.display, 16, lang), status.mine && { color: t.accent.color }]}
        numberOfLines={1}
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
      >
        {status.text}
      </Text>
      <RoundButton glyph="▦" label={S.tracker} onPress={() => setSheet("tracker")} />
    </View>
  );

  const felt = (
    <View style={[s.scene, s.ltr]} onLayout={(e) => setFeltH(e.nativeEvent.layout.height)}>
      <Felt>
        <View style={s.hudRow}>
          {model.hud.map((x) => (
            <FeltChip key={x.text} text={x.text} color={x.points ? t.value.points : undefined} />
          ))}
        </View>

        <View style={s.topSeatsRow}>{inArea("top").map(seatEl)}</View>

        <View style={s.middleArena}>
          <View style={s.sideSeats}>{leftSeats.map(seatEl)}</View>

          <View style={s.centerStage}>
            {feltH >= 220 ? (
              <Text style={[s.phase, scriptText(lang)]} accessibilityElementsHidden importantForAccessibility="no">
                {phaseWord(view)}
              </Text>
            ) : null}
            <View
              style={[s.trick, { width: trickW, height: trickH }]}
              accessible
              accessibilityLabel={
                h && shown.trick.length
                  ? S.inTrick(shown.trick.map((p) => `${nameOf(p.seat)}${T.sep}${cardLabel(p.card)}`).join("; "))
                  : h
                  ? S.trickEmpty
                  : S.waitingDeal
              }
            >
              {shown.trick.map((p) => {
                const area = model.seats[p.seat]!.area;
                const idx = Math.max(0, inArea(area).indexOf(p.seat));
                const off = trickOffset(area, idx);
                return (
                  <TrickCard
                    key={`${p.seat}-${p.card}`}
                    card={p.card}
                    width={w}
                    left={trickW / 2 - w / 2 + off.x}
                    top={trickH / 2 - (w * 1.4) / 2 + off.y}
                    fromX={off.x * 2.5}
                    fromY={off.y * 2.5}
                  />
                );
              })}
            </View>
            {warn ? <Text style={[s.warn, { backgroundColor: t.felt.deep }]} accessibilityLiveRegion="assertive">{warn}</Text> : null}
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
      <Animated.View pointerEvents="none" style={[s.flash, { borderRadius: t.shape.felt + 18, opacity: flashAnim }]} />
    </View>
  );

  const bridge = (
    <View style={s.bridgeBar}>
      <MePlate
        name={nameOf(me)}
        avatar={profile.avatar}
        cards={h?.my_hand?.length ?? 0}
        turn={myTurn}
        instruction={instruction}
        clock={clockOn || serverOn ? (
          <TurnClock local={clockOn} turnKey={turnKey} totalMs={totalMs} paused={sheet !== null} deadline={serverOn ? deadline ?? null : null} onExpire={expire} width={96} />
        ) : null}
      />
      <View style={s.actionsRow}>
        {undo?.can ? <RoundButton glyph={rtl ? "↷" : "↶"} label={S.undo} onPress={undo.run} /> : null}
        {last ? <RoundButton glyph={rtl ? "↻" : "↺"} label={S.last} onPress={() => setSheet("last")} /> : null}
        {profile.hints && hint && myTurn ? (
          <RoundButton
            glyph="?"
            label={S.hint}
            on
            onPress={() => {
              setHintMove(hint());
              setSheet("hint");
            }}
          />
        ) : null}
      </View>
    </View>
  );

  const hand = h?.my_hand ? (
    <Hand
      cards={h.my_hand}
      legal={legal}
      layout={layout}
      sort={sort}
      cardWidth={cardW}
      maxWidth={handW}
      textScale={textScale}
      onPlay={playCard}
      onBlocked={blocked}
    />
  ) : null;

  const tray =
    callMoves.length > 0 && h?.my_hand ? (
      <CallPicker
        min={callMoves[0]!.n}
        max={callMoves[callMoves.length - 1]!.n}
        suggestion={Math.min(
          view.rules.call_max,
          Math.max(view.rules.call_min, Math.round(estimateCallbreakTricks(h.my_hand, view.rules.trump)))
        )}
        onCall={(n) => onMove({ t: "Call", n })}
      />
    ) : canTrump && h?.my_hand ? (
      <TrumpPicker suggestion={suggestTrump(h.my_hand)} onChoose={(suit) => onMove({ t: "ChooseTrump", suit })} />
    ) : canTake ? (
      <TakeButton onTake={() => onMove({ t: "Take" })} />
    ) : betweenHands ? (
      <HandOverStrip {...betweenHands} />
    ) : null;

  const toastEl = toast ? (
    <Text style={[s.toast, { backgroundColor: t.sheet.bg, borderColor: t.accent.color }]} accessibilityLiveRegion="assertive">
      {toast}
    </Text>
  ) : null;

  const pad = {
    paddingTop: inset.top + 2,
    paddingBottom: Math.max(inset.bottom, 4),
    paddingLeft: inset.left + 6,
    paddingRight: inset.right + 6,
    backgroundColor: t.c.bg,
  };

  return (
    <View style={[s.room, pad, landscape && s.roomLandscape]} onLayout={(e) => setRoomH(e.nativeEvent.layout.height)}>
      {landscape ? (
        <>
          <View style={s.leftPane}>
            {felt}
            {tray ? <View style={s.trayLandscape}>{tray}</View> : null}
          </View>
          <View style={[s.side, { width: sideW }]}>
            {topBar}
            <View style={s.grow} />
            {bridge}
            {hand}
          </View>
        </>
      ) : (
        <>
          {topBar}
          {felt}
          {bridge}
          <View onLayout={(e) => setHandTop(e.nativeEvent.layout.y)}>{hand}</View>
          {tray ? (
            <View style={[s.trayPortrait, { bottom: handTop !== null && roomH > 0 ? Math.max(8, roomH - handTop + 4) : 110 }]}>{tray}</View>
          ) : null}
        </>
      )}

      {toastEl}

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
      <InfoSheet visible={sheet === "info"} onClose={close} title={S.tableInfo} rows={info ?? []} />
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
        title={S.leaveTitle}
        onCancel={close}
        onConfirm={() => {
          close();
          onLeave?.();
        }}
        confirmLabel={S.leave}
        cancelLabel={S.stay}
        standing={[
          S.inHand(h?.my_hand?.length ?? 0),
          S.seats(model.seats.length),
          ...(h ? [model.hud[0]?.text ?? ""] : []),
        ].filter(Boolean)}
        facts={[
          { mark: "H", title: S.endsTitle, body: S.endsBody },
          h && h.phase !== "DONE" && !view.match.over
            ? { mark: "!", title: S.droppedTitle, body: S.droppedBody }
            : { mark: "·", title: S.idleTitle, body: S.idleBody },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  room: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  roomLandscape: {
    flexDirection: "row",
    gap: 8,
  },
  leftPane: {
    flex: 1,
    minWidth: 0,
  },
  side: {
    justifyContent: "flex-end",
  },
  grow: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 2,
  },
  status: {
    flex: 1,
    color: onTable.secondary,
    fontSize: 16,
    textAlign: "center",
  },
  scene: {
    flex: 1,
    minHeight: 0,
    marginVertical: 2,
  },
  ltr: {
    direction: "ltr",
  },
  flash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: onTable.error,
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
    color: onTable.muted,
    fontFamily: fonts.ui.medium,
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  trick: {
    position: "relative",
  },
  warn: {
    color: onTable.text,
    fontFamily: fonts.ui.medium,
    borderWidth: 1,
    borderColor: onTable.error,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 240,
    marginTop: 2,
  },
  noticeBox: {
    minHeight: 18,
    justifyContent: "center",
  },
  notice: {
    color: onTable.warning,
    fontFamily: fonts.ui.family,
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
    gap: 6,
    alignItems: "center",
  },
  toast: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    color: onTable.text,
    fontFamily: fonts.ui.medium,
    fontSize: 14,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
    maxWidth: "90%",
    zIndex: 200,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  trayPortrait: {
    position: "absolute",
    left: 10,
    right: 10,
    zIndex: 150,
  },
  trayLandscape: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 150,
  },
});
