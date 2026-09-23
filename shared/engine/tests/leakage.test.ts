/** L6 leakage for every game: projection law (LK-01), events (LK-02), no seeds / hidden cards in views (LK-04), W-CB-1 (LK-08). */
import { describe, expect, it } from "vitest";
import {
  type CallbreakState, type CardId, type GameModule, type Viewer, callbreak, canonicalize, project, projectEvents, sortCards, step, suitOf,
} from "../src/index.js";
import { driveMatch, hashChooser, rulesOf, shortRules, testSeed } from "../src/index.js";

/** Plays part of a hand and returns a mid-hand state. */
 
function midHand(module: GameModule, rules: any, label: string, moves: number): any {
   
  let captured: any = null;
  let count = 0;
  driveMatch(module, rules, label, hashChooser(label), {
    onStep: (s) => { const info = module.handInfo(s); if (!captured && info && !info.done && ++count >= moves) captured = s; },
  });
  return captured;
}

/** Swap one hidden (not publicly known) card between two other seats' hands. */
 
function swapHidden(state: any, a: number, b: number): any {
  const h = state.hand;
  const known: string[][] = h.known ?? h.hands.map(() => []);
  const hands: string[][] = h.hands.map((x: string[]) => x.slice());
  const ia = hands[a]!.findIndex((c) => !known[a]!.includes(c));
  const ib = hands[b]!.findIndex((c) => !known[b]!.includes(c) && c !== hands[a]![ia]);
  if (ia < 0 || ib < 0) return null;
  const ca = hands[a]![ia]!; const cb = hands[b]![ib]!;
  hands[a]![ia] = cb; hands[b]![ib] = ca;
  return { ...state, hand: { ...h, hands: hands.map((x) => sortCards(x)) } };
}

const GAMES: [string, Record<string, unknown>][] = [["callbreak.np@1", {}], ["courtpiece.tz@1", {}], ["courtpiece.tz@1", { variant: "double" }], ["bhabhi.tz@1", { players: 5 }], ["bhabhi.tz@1", { players: 8 }]];

describe.each(GAMES)("projection law — %s %j", (profile, settings) => {
  const { module, rules: full } = rulesOf(profile, settings);
  const rules = shortRules(module.id, full, 1);
  const seats = module.seatCount(rules);

  it("LK-01: states differing only in hidden cards project identically to every other seat and spectators", () => {
    let checked = 0;
    for (const moves of [3, 9, 17]) {
      const s = midHand(module, rules, `lk/${profile}/${moves}`, moves);
      if (!s) continue;
      for (let v = 0; v < seats; v++) {
        const others = [...Array(seats).keys()].filter((x) => x !== v && s.hand.hands[x].length > 0);
        if (others.length < 2) continue;
        const s2 = swapHidden(s, others[0]!, others[1]!);
        if (!s2) continue;
        for (const viewer of [{ kind: "seat", seat: v }, { kind: "handover_bot", seat: v }] as Viewer[]) {
          expect(canonicalize(module.project(s2, viewer))).toBe(canonicalize(module.project(s, viewer)));
        }
        expect(canonicalize(module.project(s2, { kind: "spectator_public" }))).toBe(canonicalize(module.project(s, { kind: "spectator_public" })));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("LK-04: no seed in any view, and every card in a view is in that viewer's visible set", () => {
    for (const moves of [1, 6, 14]) {
      const s = midHand(module, rules, `lk4/${profile}/${moves}`, moves);
      if (!s) continue;
      for (let v = 0; v < seats; v++) {
        const viewer: Viewer = { kind: "seat", seat: v };
        const json = canonicalize(module.project(s, viewer));
        expect(json).not.toContain(s.hand.seed);
        expect(json).not.toContain('"seed"');
        const visible = module.visibleCardIds(s, viewer);
        for (const c of json.match(/"[2-9TJQKA][CDHS]"/g)?.map((x) => x.slice(1, 3)) ?? []) expect(visible.has(c)).toBe(true);
      }
    }
  });
});

describe("LK-02 projected event streams (Callbreak)", () => {
  it("identical for hidden-different states under the same public action", () => {
    const { rules } = rulesOf("callbreak.np@1", { redeal_on_request: false });
    const r0 = step(callbreak.initialState(rules), { t: "BeginHand", actor: "system", hand_id: "y", hand_seed: testSeed("y") });
    if (!r0.ok) throw new Error();
    const st = r0.state;
    const caller = st.hand!.turn;
    const others = [0, 1, 2, 3].filter((x) => x !== caller);
    const st2 = swapHidden(st, others[1]!, others[2]!) as CallbreakState;
    const a = { t: "Call", actor: caller, hand_id: "y", n: 3 } as const;
    const e1 = step(st, a); const e2 = step(st2, a);
    if (!e1.ok || !e2.ok) throw new Error();
    expect(canonicalize(projectEvents(e1.events, { kind: "seat", seat: others[0]! }))).toBe(canonicalize(projectEvents(e2.events, { kind: "seat", seat: others[0]! })));
  });
});

describe("LK-08 hidden-eligibility window W-CB-1", () => {
  const { rules } = rulesOf("callbreak.np@1", { rounds: 3 });
  function windowState(): CallbreakState {
    const r = step(callbreak.initialState(rules), { t: "BeginHand", actor: "system", hand_id: "w1", hand_seed: testSeed("w1") });
    if (!r.ok) throw new Error();
    expect(r.state.hand!.phase).toBe("WINDOW");
    return r.state;
  }
  function withHands(s: CallbreakState, hands: CardId[][]): CallbreakState { return { ...s, hand: { ...s.hand!, hands: hands.map(sortCards) } }; }
  function variants(s: CallbreakState): [CallbreakState, CallbreakState] {
    const all = [...s.hand!.hands[1]!, ...s.hand!.hands[2]!, ...s.hand!.hands[3]!];
    const spades = all.filter((c) => suitOf(c) === "S"); const rest = all.filter((c) => suitOf(c) !== "S");
    const seat2 = rest.slice(-13); const pool = [...spades, ...rest.slice(0, rest.length - 13)];
    const mine = s.hand!.hands[0]!.slice();
    const neutral = [mine, all.filter((_, i) => i % 3 === 0), all.filter((_, i) => i % 3 === 1), all.filter((_, i) => i % 3 === 2)];
    return [withHands(s, [mine, pool.slice(0, 13), seat2, pool.slice(13)]), withHands(s, neutral)];
  }
  it("seat 0 and spectators see the same window whether or not anyone is eligible; requests are sealed", () => {
    const [withEligible, neutral] = variants(windowState());
    for (const viewer of [{ kind: "seat", seat: 0 }, { kind: "spectator_public" }] as Viewer[]) {
      expect(canonicalize(project(withEligible, viewer))).toBe(canonicalize(project(neutral, viewer)));
    }
    expect(project(withEligible, { kind: "seat", seat: 2 }).legal).toEqual([{ t: "RequestRedeal" }]);
    const req = step(withEligible, { t: "RequestRedeal", actor: 2, hand_id: "w1" });
    if (!req.ok) throw new Error(req.code);
    expect(projectEvents(req.events, { kind: "seat", seat: 0 })).toEqual([]);
    expect(req.state.hand!.phase).toBe("WINDOW");
    const closed = step(req.state, { t: "CloseWindow", actor: "system", hand_id: "w1" });
    if (!closed.ok) throw new Error();
    expect(closed.state.hand!.annulled).toBe("redeal_request");
    expect(closed.state.hand!.revealed.map((x) => x.seat)).toEqual([2]);
  });
  it("ineligible request is rejected; redeal cap plays the deal as dealt", () => {
    const [, neutral] = variants(windowState());
    const eligible1 = !neutral.hand!.hands[1]!.some((c) => suitOf(c) === "S") || !neutral.hand!.hands[1]!.some((c) => "AKQJ".includes(c[0]!));
    if (!eligible1) expect(step(neutral, { t: "RequestRedeal", actor: 1, hand_id: "w1" })).toMatchObject({ ok: false, code: "ILLEGAL_ACTION" });
    const s = windowState();
    const capped = step({ ...s, hand: { ...s.hand!, phase: "DONE" }, match: { ...s.match, redeal_streak: 3 } }, { t: "BeginHand", actor: "system", hand_id: "w2", hand_seed: testSeed("w2") });
    if (!capped.ok) throw new Error();
    expect(capped.state.hand!.phase).toBe("CALL");
  });
});
