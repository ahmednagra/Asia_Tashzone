/** L4/L7 for every game: PR-01 conservation · PR-02 legal ⇔ accepted · PR-03 view legality · PR-04 termination · PR-05 replay. */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { type GameModule, canonicalize, replayModule, stateHash } from "../src/index.js";
import { type Chooser, botChooser, driveMatch, hashChooser, rulesOf, shortRules } from "../src/index.js";

interface Case { profile: string; settings: Record<string, unknown>[]; offTurn?: number }
const CASES: Case[] = [
  { profile: "callbreak.np@1", settings: [{}, { relaxed_play: true, first_lead_no_spade: true }, { call_range: "1-8", auto_redeal_no_spade: true, redeal_on_request: false, overtrick_bonus: false }, { easy_follow: true, low_call_sum_redeal: true }] },
  { profile: "callbridge.bd@1", settings: [{}] },
  { profile: "courtpiece.tz@1", settings: [{}, { variant: "double", stop_at_seven: false, ace_blocks_collect: true }, { variant: "double" }, { dealer_rotation: "rotate" }] },
  {
    profile: "bhabhi.tz@1", offTurn: 2,
    settings: [
      { players: 3 }, { players: 4 }, { players: 6, thulla: "finishTrick", power_holder_empty: "passToNext" },
      { players: 5, take_hand: true, first_trick_discard: false }, { players: 4, power_holder_empty: "drawFromNext" },
      { players: 4, power_holder_empty: "escapeIfThreePlus", two_player_cut: false }, { players: 7 }, { players: 8, take_hand: true, thulla: "finishTrick" },
      { players: 5, decks: 2, handicap: 3 },
    ],
  },
];

function illegalCards(module: GameModule, state: unknown, seat: number, legal: readonly { t: string }[]): string[] {
  const v = module.project(state, { kind: "seat", seat }) as { hand?: { my_hand?: readonly string[] | null } | null };
  const hand = v.hand?.my_hand ?? [];
  return hand.filter((c) => !legal.some((m) => m.t === "Play" && (m as { card: string }).card === c));
}

for (const c of CASES) {
  describe(`${c.profile} properties`, () => {
    it("conserves cards, keeps view legality equal to server legality, accepts exactly the legal moves, terminates, replays", () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 1e6 }), fc.constantFrom(...c.settings), (n, settings) => {
        const { module, rules: full } = rulesOf(c.profile, settings);
        const rules = shortRules(module.id, full, 1);
        const seats = module.seatCount(rules);
        let checked = 0;
        const d = driveMatch(module, rules, `p/${c.profile}/${n}`, hashChooser(`p/${n}`), {
          offTurnSixteenths: c.offTurn,
          onStep: (s) => {
            expect(module.conservationHolds(s)).toBe(true);
            if (checked++ % 3 !== 0) return; // sample states: every third step is fully checked
            const info = module.handInfo(s);
            for (let seat = 0; seat < seats; seat++) {
              const view = module.project(s, { kind: "seat", seat });
              const fromView = module.legalFromView(view);
              expect(canonicalize(fromView)).toBe(canonicalize(module.legalServer(s, seat)));
              if (!info || info.done) continue;
              for (const m of fromView) expect(module.step(s, module.toAction(m, seat, info.hand_id)).ok).toBe(true);
              if (fromView.some((m) => m.t === "Play")) {
                for (const card of illegalCards(module, s, seat, fromView)) {
                  expect(module.step(s, module.toAction({ t: "Play", card }, seat, info.hand_id)).ok).toBe(false);
                  expect(module.explain(view, { t: "Play", card })).not.toBeNull();
                }
              }
            }
          },
        });
        expect(module.summary(d.state).over).toBe(true);
        const r = replayModule(module, rules, d.actions);
        expect(r.stateHashes).toEqual(d.stateHashes);
      }), { numRuns: c.profile.startsWith("bhabhi") ? 18 : 8 });
    });

    it("bots finish full-length matches with only legal moves (Easy and Medium)", () => {
      const { module, rules } = rulesOf(c.profile, c.settings[0]);
      for (const level of ["easy", "medium"] as const) {
        const chooser: Chooser = (m, s, seat, legal, n) => {
          const move = botChooser(level)(m, s, seat, legal, n);
          if (move) expect(legal.map((x) => canonicalize(x))).toContain(canonicalize(move));
          return move ?? (legal.find((x) => x.t !== "RequestRedeal" && x.t !== "Take") ?? null);
        };
        const d = driveMatch(module, shortRules(module.id, rules, 3), `bots/${c.profile}/${level}`, chooser);
        expect(module.summary(d.state).over).toBe(true);
        expect(module.summary(d.state).placements).not.toBeNull();
        expect(stateHash(replayModule(module, shortRules(module.id, rules, 3), d.actions).state)).toBe(d.stateHashes[d.stateHashes.length - 1]);
      }
    });
  });
}
