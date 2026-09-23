import {
  type CallbreakRules, type CallbreakState, type CardId, type HandState, type PlayedCard, initialState,
} from "../src/index.js";

export const RULES: CallbreakRules = {
  profile_id: "callbreak.np@1", seats: 4, direction: "counter_clockwise", dealer_rotation: "counter_clockwise",
  trump: "S", call_min: 1, call_max: 13, must_beat: true, trump_if_winning: true, first_lead_no_trump: false,
  redeal_on_request: true, low_call_sum: 0, redeal_cap: 3, scoring: "callbreak", failure: "full",
  bonus_call: 0, bonus_score: 0, overtrick_bonus: true, auto_redeal_no_trump: false, rounds: 5, tie: "shared", max_actions_per_hand: 256, guard_outcome: "annul",
  turn_ms: 20000, window_ms: 4000,
};

export const SEED = (n: number) => n.toString(16).padStart(2, "0").repeat(32);

/** constructed_state (test builds only): a PLAY-phase state with given hands and trick. */
export function playState(opts: {
  hands: CardId[][]; trick?: PlayedCard[]; turn: number; trick_no?: number; rules?: Partial<CallbreakRules>;
}): CallbreakState {
  const rules = { ...RULES, ...opts.rules };
  const base = initialState(rules);
  const trick = opts.trick ?? [];
  const hand: HandState = {
    hand_id: "t1", seed: SEED(1), phase: "PLAY", annulled: null, dealer: 1, hands: opts.hands,
    calls: [1, 1, 1, 1], turn: opts.turn, leader: trick[0]?.seat ?? opts.turn, trick, trick_no: opts.trick_no ?? 2,
    tricks: [0, 0, 0, 0], played: trick.map((p) => p.card), last_trick: null, last_trick_winner: null, history: [], redeals: 0,
    redeal_requests: [], revealed: [], actions: 10,
  };
  return { ...base, match: { ...base.match, dealer: 1 }, hand };
}
