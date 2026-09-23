/**
 * Profiles are data (02_ENGINE.md §1). A profile + room settings compile into an effective rule set with
 * `effective_profile_hash` (C-03). Toggle schemas are generated from the same table the compiler uses, so
 * schema ⇔ compiler agreement holds by construction and is tested (C-22, CG-07).
 *
 * Profiles: callbreak.np@1, callbridge.bd@1 (spec), courtpiece.tz@1 and bhabhi.tz@1 (TashZone v1 rules,
 * ported unchanged). v1 Callbreak presets (Classic, Easy follow, Call Bridge) are presets of callbreak.np@1.
 */
import { hashCanonical } from "../core/canonical.js";
import type { GameId } from "../core/types.js";
import type { CallbreakRules } from "../games/callbreak.js";
import type { CourtPieceRules } from "../games/courtpiece.js";
import { type BhabhiRules, checkRules as checkBhabhiRules } from "../games/bhabhi.js";

export type ToggleValue = boolean | number | string;
export interface ToggleSpec<R> {
  readonly id: string;
  /** Variant id in 01_GAME_RULES.md, or "v1" for a TashZone v1 house rule. */
  readonly variant: string;
  readonly kind: "boolean" | "enum";
  readonly values?: readonly (number | string)[];
  readonly default: ToggleValue;
  readonly apply: (r: R, v: ToggleValue) => R;
}
export interface ProfileDef<R = unknown> {
  readonly id: string;
  readonly game: GameId;
  readonly status: "FROZEN" | "FROZEN_WITH_GAPS" | "PROVISIONAL";
  readonly base: R;
  readonly toggles: readonly ToggleSpec<R>[];
  readonly presets: Readonly<Record<string, Readonly<Record<string, ToggleValue>>>>;
  /** Preset the app selects first (v1 behaviour). */
  readonly default_preset: string;
  readonly decisions: Readonly<Record<string, string>>;
  /** Cross-field rules after toggles; returns a problem or null. */
  readonly check?: (r: R) => string | null;
  /** Settings forced by other settings when not given explicitly (e.g. two decks for 7–8 Bhabhi players). */
  readonly finalize?: (r: R, explicit: ReadonlySet<string>) => R;
  /** Extra JSON Schema constraints mirroring `check`/`finalize` exactly. */
  readonly schemaAllOf?: readonly Record<string, unknown>[];
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* ───────────── Callbreak family ───────────── */

const CALLBREAK_BASE: CallbreakRules = {
  profile_id: "callbreak.np@1", seats: 4, direction: "counter_clockwise", dealer_rotation: "counter_clockwise", trump: "S",
  call_min: 1, call_max: 13, must_beat: true, trump_if_winning: true, first_lead_no_trump: false, redeal_on_request: true,
  low_call_sum: 0, redeal_cap: 3, scoring: "callbreak", failure: "full", bonus_call: 0, bonus_score: 0,
  overtrick_bonus: true, auto_redeal_no_trump: false, rounds: 5, tie: "shared",
  max_actions_per_hand: 256, guard_outcome: "annul", turn_ms: 20000, window_ms: 4000,
};

const CALL_RANGES: Record<string, [number, number]> = { "1-13": [1, 13], "1-8": [1, 8], "2-13": [2, 13] };

const callbreakToggles: ToggleSpec<CallbreakRules>[] = [
  { id: "relaxed_play", variant: "CB-01", kind: "boolean", default: false,
    apply: (r, v) => (v ? { ...r, must_beat: false, trump_if_winning: false } : r) },
  { id: "easy_follow", variant: "v1", kind: "boolean", default: false,
    apply: (r, v) => (v ? { ...r, must_beat: false } : r) },
  { id: "low_call_sum_redeal", variant: "CB-03", kind: "boolean", default: false,
    apply: (r, v) => (v ? { ...r, low_call_sum: 8 } : r) },
  { id: "redeal_on_request", variant: "CB-04", kind: "boolean", default: true,
    apply: (r, v) => ({ ...r, redeal_on_request: v === true }) },
  { id: "auto_redeal_no_spade", variant: "v1", kind: "boolean", default: false,
    apply: (r, v) => ({ ...r, auto_redeal_no_trump: v === true }) },
  { id: "first_lead_no_spade", variant: "CB-05", kind: "boolean", default: false,
    apply: (r, v) => ({ ...r, first_lead_no_trump: v === true }) },
  { id: "clockwise_play", variant: "CB-06", kind: "boolean", default: false,
    apply: (r, v) => (v ? { ...r, direction: "clockwise", dealer_rotation: "clockwise" } : r) },
  { id: "dealer_rotates_clockwise", variant: "CB-07", kind: "boolean", default: false,
    apply: (r, v) => (v ? { ...r, dealer_rotation: "clockwise" } : r) },
  { id: "failure_shortfall", variant: "CB-08", kind: "boolean", default: false,
    apply: (r, v) => (v ? { ...r, failure: "shortfall" } : r) },
  { id: "call_range", variant: "v1", kind: "enum", values: ["1-13", "1-8", "2-13"], default: "1-13",
    apply: (r, v) => { const [a, b] = CALL_RANGES[v as string]!; return { ...r, call_min: a, call_max: b }; } },
  { id: "overtrick_bonus", variant: "v1", kind: "boolean", default: true,
    apply: (r, v) => ({ ...r, overtrick_bonus: v === true }) },
  { id: "rounds", variant: "CB-11", kind: "enum", values: [3, 5, 10, 15, 25, 50, 100], default: 5,
    apply: (r, v) => ({ ...r, rounds: v as number }) },
  { id: "accessible_timers", variant: "PD-07", kind: "boolean", default: false,
    apply: (r, v) => (v ? { ...r, turn_ms: r.turn_ms * 2 } : r) },
];

const V1_CLASSIC = { call_range: "1-8", overtrick_bonus: true, auto_redeal_no_spade: true, redeal_on_request: false } as const;

const DECISIONS = {
  "G-12": "must-beat and must-trump-if-winning ON by default (canonical S11/Pagat reading, matches leading apps); CB-01 relaxed play is a room toggle",
  "G-13": "void seat whose trumps cannot beat the current winner may play any card (S11); CB-02 stays DEFER",
  "G-14": "equal final totals share the placement (standard competition ranking); no tie-break hand",
  "G-15": "bid-sum<8 redeal off by default (CB-03 toggle); at most 3 consecutive annulments, then the deal is played as dealt",
  "G-57": "cap 256 actions per hand (a complete hand needs ≤ 130 including timeouts); outcome: annul, same dealer",
  "W-CB-1": "hidden-eligibility window with fixed 4000 ms duration, identical for every viewer; never closes early",
  "V1": "TashZone v1 presets kept: Classic (calls 1–8, automatic no-spade redeal, +0.1 per overtrick), Easy follow, Call Bridge (2–13, no overtrick bonus)",
};

export const CALLBREAK_NP_1: ProfileDef<CallbreakRules> = {
  id: "callbreak.np@1", game: "callbreak", status: "FROZEN_WITH_GAPS", base: CALLBREAK_BASE, toggles: callbreakToggles,
  presets: {
    standard: {},
    "lakdi-india": { clockwise_play: true },
    classic: V1_CLASSIC,
    "easy-follow": { ...V1_CLASSIC, easy_follow: true },
    "call-bridge-classic": { ...V1_CLASSIC, call_range: "2-13", overtrick_bonus: false },
  },
  default_preset: "classic",
  decisions: DECISIONS,
};

export const CALLBRIDGE_BD_1: ProfileDef<CallbreakRules> = {
  id: "callbridge.bd@1", game: "callbreak", status: "FROZEN_WITH_GAPS",
  base: { ...CALLBREAK_BASE, profile_id: "callbridge.bd@1", call_min: 2, call_max: 12, must_beat: false,
    scoring: "callbridge", bonus_call: 8, bonus_score: 130 },
  toggles: callbreakToggles.filter((t) => !["relaxed_play", "easy_follow", "failure_shortfall", "call_range", "overtrick_bonus"].includes(t.id)),
  presets: { standard: {} },
  default_preset: "standard",
  decisions: { ...DECISIONS, "G-58": "Call Bridge match length defaults to 5 hands with the CB-11 options (source says 'set amount of time')" },
};

/* ───────────── Court Piece (v1) ───────────── */

const COURTPIECE_BASE: CourtPieceRules = {
  profile_id: "courtpiece.tz@1", seats: 4, variant: "single", stop_at_seven: true, ace_blocks_collect: false,
  target_points: 7, hand_points: 1, court_points: 3, dealer_rotation: "pagat",
  max_actions_per_hand: 256, turn_ms: 30000, window_ms: 4000,
};

export const COURTPIECE_TZ_1: ProfileDef<CourtPieceRules> = {
  id: "courtpiece.tz@1", game: "courtpiece", status: "FROZEN", base: COURTPIECE_BASE,
  toggles: [
    { id: "variant", variant: "v1", kind: "enum", values: ["single", "double"], default: "single", apply: (r, v) => ({ ...r, variant: v as "single" | "double" }) },
    { id: "stop_at_seven", variant: "v1", kind: "boolean", default: true, apply: (r, v) => ({ ...r, stop_at_seven: v === true }) },
    { id: "ace_blocks_collect", variant: "v1", kind: "boolean", default: false, apply: (r, v) => ({ ...r, ace_blocks_collect: v === true }) },
    { id: "target_points", variant: "v1", kind: "enum", values: range(1, 21), default: 7, apply: (r, v) => ({ ...r, target_points: v as number }) },
    { id: "hand_points", variant: "v1", kind: "enum", values: range(1, 5), default: 1, apply: (r, v) => ({ ...r, hand_points: v as number }) },
    { id: "court_points", variant: "v1", kind: "enum", values: range(1, 10), default: 3, apply: (r, v) => ({ ...r, court_points: v as number }) },
    { id: "dealer_rotation", variant: "v1", kind: "enum", values: ["pagat", "rotate"], default: "pagat", apply: (r, v) => ({ ...r, dealer_rotation: v as "pagat" | "rotate" }) },
    { id: "accessible_timers", variant: "PD-07", kind: "boolean", default: false, apply: (r, v) => (v ? { ...r, turn_ms: r.turn_ms * 2 } : r) },
  ],
  presets: {
    standard: {},
    double: { variant: "double", ace_blocks_collect: false },
    single: { variant: "single", ace_blocks_collect: false },
    "double-ace": { variant: "double", ace_blocks_collect: true },
  },
  default_preset: "double",
  decisions: {
    "V1": "TashZone v1 Court Piece rules unchanged: caller sees 5 cards and chooses trump; Single and Double Sir; Double Sir collects when the same player wins two tricks in a row, and the last trick collects the pile; court = 7–0 (single) or all 13 collected (double); losing side deals next (pagat)",
    "G-57": "cap 256 actions per hand; outcome annul, same dealer",
  },
};

/* ───────────── Bhabhi (v1) ───────────── */

const BHABHI_BASE: BhabhiRules = {
  profile_id: "bhabhi.tz@1", players: 4, thulla: "immediate", first_trick_discard: true, power_holder_empty: "drawFromWaste",
  decks: 1, take_hand: false, two_player_cut: true, rounds: 3, bhabhi_limit: 0, handicap: 0, max_tricks: 2000,
  max_actions_per_hand: 40000, turn_ms: 30000, window_ms: 4000,
};

export const BHABHI_TZ_1: ProfileDef<BhabhiRules> = {
  id: "bhabhi.tz@1", game: "bhabhi", status: "FROZEN", base: BHABHI_BASE,
  toggles: [
    { id: "players", variant: "v1", kind: "enum", values: range(3, 8), default: 4, apply: (r, v) => ({ ...r, players: v as number }) },
    { id: "thulla", variant: "v1", kind: "enum", values: ["immediate", "finishTrick"], default: "immediate", apply: (r, v) => ({ ...r, thulla: v as "immediate" | "finishTrick" }) },
    { id: "first_trick_discard", variant: "v1", kind: "boolean", default: true, apply: (r, v) => ({ ...r, first_trick_discard: v === true }) },
    { id: "power_holder_empty", variant: "v1", kind: "enum", values: ["drawFromWaste", "drawFromNext", "escapeIfThreePlus", "passToNext"], default: "drawFromWaste",
      apply: (r, v) => ({ ...r, power_holder_empty: v as BhabhiRules["power_holder_empty"] }) },
    { id: "decks", variant: "v1", kind: "enum", values: [1, 2], default: 1, apply: (r, v) => ({ ...r, decks: v as 1 | 2 }) },
    { id: "take_hand", variant: "v1", kind: "boolean", default: false, apply: (r, v) => ({ ...r, take_hand: v === true }) },
    { id: "two_player_cut", variant: "v1", kind: "boolean", default: true, apply: (r, v) => ({ ...r, two_player_cut: v === true }) },
    { id: "rounds", variant: "v1", kind: "enum", values: range(1, 15), default: 3, apply: (r, v) => ({ ...r, rounds: v as number }) },
    { id: "bhabhi_limit", variant: "v1", kind: "enum", values: range(0, 5), default: 0, apply: (r, v) => ({ ...r, bhabhi_limit: v as number }) },
    { id: "handicap", variant: "v1", kind: "enum", values: range(0, 9), default: 0, apply: (r, v) => ({ ...r, handicap: v as number }) },
    { id: "accessible_timers", variant: "PD-07", kind: "boolean", default: false, apply: (r, v) => (v ? { ...r, turn_ms: r.turn_ms * 2 } : r) },
  ],
  presets: {
    standard: {},
    "full-trick": { thulla: "finishTrick" },
    "quick-escape": { power_holder_empty: "passToNext" },
    "take-hand": { take_hand: true },
  },
  default_preset: "standard",
  decisions: {
    "V1": "TashZone v1 Bhabhi rules unchanged (L14, L19, L32–L35, L39): ace of spades leads; first trick put aside; four power-holder rules; take-the-hand; two-player cut; ranking by fewest times Bhabhi, then summed finishing places",
    "L32": "two decks are forced for 7–8 players when `decks` is not set explicitly",
    "L39": "handicap is offered against bots only; the match server refuses a room with a handicap",
  },
  check: (r) => checkBhabhiRules(r),
  finalize: (r, explicit) => (!explicit.has("decks") && r.players >= 7 ? { ...r, decks: 2 } : r),
  schemaAllOf: [
    { if: { required: ["decks"], properties: { decks: { const: 1 } } }, then: { properties: { players: { enum: [3, 4, 5, 6] } } } },
    { if: { required: ["decks"], properties: { decks: { const: 2 } } }, then: { properties: { players: { enum: [4, 5, 6, 7, 8] } } } },
  ],
};

 
export const PROFILES: Readonly<Record<string, ProfileDef<any>>> = {
  [CALLBREAK_NP_1.id]: CALLBREAK_NP_1,
  [CALLBRIDGE_BD_1.id]: CALLBRIDGE_BD_1,
  [COURTPIECE_TZ_1.id]: COURTPIECE_TZ_1,
  [BHABHI_TZ_1.id]: BHABHI_TZ_1,
};

/** Hash of the profile definition (data only: base rules, toggle table, presets, decisions). */
export function profileHash(p: ProfileDef): string {
  return hashCanonical({
    id: p.id, game: p.game, status: p.status, base: p.base, presets: p.presets, default_preset: p.default_preset, decisions: p.decisions,
    toggles: p.toggles.map((t) => ({ id: t.id, variant: t.variant, kind: t.kind, values: t.values ?? null, default: t.default })),
    schema_all_of: p.schemaAllOf ?? null,
  });
}

 
export type CompileResult<R = any> =
  | { ok: true; game: GameId; rules: R; effective_profile_hash: string; profile_hash: string; toggles: Record<string, ToggleValue> }
  | { ok: false; error: string };

/** Every profile has a `standard` preset (the plain base rules); omitting `preset` means `standard`. */
export function compile(profileId: string, settings: Readonly<Record<string, unknown>> = {}, preset = "standard"): CompileResult {
  const p = PROFILES[profileId];
  if (!p) return { ok: false, error: "unknown_profile" };
  const presetValues = p.presets[preset];
  if (!presetValues) return { ok: false, error: "unknown_preset" };
  const known = new Set(p.toggles.map((t) => t.id));
  for (const k of Object.keys(settings).sort()) if (!known.has(k)) return { ok: false, error: `unknown_setting:${k}` };
  const resolved: Record<string, ToggleValue> = {};
  const explicit = new Set<string>();
  let rules = p.base;
  for (const t of p.toggles) {
    const given = t.id in settings;
    const raw = given ? settings[t.id] : t.id in presetValues ? presetValues[t.id] : t.default;
    if (given || t.id in presetValues) explicit.add(t.id);
    if (t.kind === "boolean" && typeof raw !== "boolean") return { ok: false, error: `bad_value:${t.id}` };
    if (t.kind === "enum" && !((typeof raw === "number" || typeof raw === "string") && (t.values ?? []).includes(raw))) return { ok: false, error: `bad_value:${t.id}` };
    resolved[t.id] = raw as ToggleValue;
    rules = t.apply(rules, raw as ToggleValue);
  }
  if (p.finalize) rules = p.finalize(rules, explicit);
  const problem = p.check?.(rules) ?? null;
  if (problem) return { ok: false, error: `invalid:${problem}` };
  return { ok: true, game: p.game, rules, effective_profile_hash: hashCanonical(rules), profile_hash: profileHash(p), toggles: resolved };
}

/** JSON Schema (draft 2020-12) of valid room settings for a profile (C-22). */
export function settingsSchema(p: ProfileDef): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const t of p.toggles) {
    if (t.kind === "boolean") properties[t.id] = { type: "boolean", default: t.default, "x-variant": t.variant };
    else {
      const numeric = (t.values ?? []).every((v) => typeof v === "number");
      properties[t.id] = { type: numeric ? "integer" : "string", enum: [...(t.values ?? [])], default: t.default, "x-variant": t.variant };
    }
  }
  const schema: Record<string, unknown> = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `tashzone:profile:${p.id}:settings`,
    type: "object",
    additionalProperties: false,
    properties,
  };
  if (p.schemaAllOf && p.schemaAllOf.length > 0) schema["allOf"] = [...p.schemaAllOf];
  return schema;
}

export interface ProfileBundle {
  readonly profile_id: string;
  readonly game: GameId;
  readonly status: ProfileDef["status"];
  readonly profile_hash: string;
  readonly default_effective_profile_hash: string;
  readonly presets: ProfileDef["presets"];
  readonly default_preset: string;
  readonly decisions: ProfileDef["decisions"];
  readonly settings_schema: Record<string, unknown>;
}

export function profileBundle(p: ProfileDef): ProfileBundle {
  const c = compile(p.id);
  if (!c.ok) throw new Error(c.error);
  return {
    profile_id: p.id, game: p.game, status: p.status, profile_hash: c.profile_hash,
    default_effective_profile_hash: c.effective_profile_hash, presets: p.presets, default_preset: p.default_preset,
    decisions: p.decisions, settings_schema: settingsSchema(p),
  };
}
