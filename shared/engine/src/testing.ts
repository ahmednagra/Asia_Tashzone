/** Match drivers and the behaviour digest for every game module (tests, digest script, replays): deterministic seeds, match drivers, behaviour digest (02_ENGINE.md §9). */
import { canonicalize, hashCanonical, sha256Hex } from "./core/canonical.js";
import type { BaseView, GameModule } from "./core/contract.js";
import { stateHash } from "./core/replay.js";
import type { Action, SeatMove } from "./core/types.js";
import { getModule } from "./registry.js";
import { type BotLevel, chooseMove } from "./bots/index.js";
import { PROFILES, compile } from "./profiles/index.js";

/** Deterministic 32-byte hex seed from a label (tests only; production seeds come from a CSPRNG). */
export function testSeed(label: string): string { return sha256Hex("tz/test-seed/" + label); }

 
export type Chooser = (module: GameModule, state: any, seat: number, legal: readonly SeatMove[], n: number) => SeatMove | null;

/** Chooses from legal moves using a counter-driven hash (deterministic "random" play). */
export function hashChooser(label: string): Chooser {
  return (_m, _s, seat, legal, n) => {
    if (legal.length === 0) return null;
    const h = sha256Hex(`${label}/${n}/${seat}`);
    return legal[parseInt(h.slice(0, 8), 16) % legal.length]!;
  };
}

/** A bot of the given level choosing from the seat's own view. */
export function botChooser(level: BotLevel = "medium", budget?: Parameters<typeof chooseMove>[4]): Chooser {
  return (module, state, seat, _legal, n) => chooseMove(module, module.project(state, { kind: "seat", seat }) as BaseView, level, `bot/${n}/${seat}`, budget);
}

export interface DriveResult {
   
  state: any;
  actions: Action[];
  stateHashes: string[];
  eventsHash: string;
  legalHash: string;
}

export interface DriveOptions {
  readonly maxHands?: number;
  /** Also let seats other than the one to move act (Bhabhi take-the-hand), with this chance in 1/16ths. */
  readonly offTurnSixteenths?: number;
   
  readonly onStep?: (state: any) => void;
}

/**
 * Drives a match to completion through the real step() path. The shell role (BeginHand seeds, window
 * close) is simulated deterministically. Every accepted action is recorded for replay.
 */
export function driveMatch(module: GameModule, rules: unknown, label: string, chooser: Chooser, opts: DriveOptions = {}): DriveResult {
  let state = module.initialState(rules);
  const seats = module.seatCount(rules);
  const actions: Action[] = [];
  const stateHashes: string[] = [];
  const evParts: string[] = [];
  const legalParts: string[] = [];
  let handNo = 0;
  let n = 0;
  const apply = (a: Action) => {
    const r = module.step(state, a);
    if (!r.ok) throw new Error(`driver: rejected ${a.t} (${r.code}) at ${n}`);
    state = r.state;
    actions.push(a);
    stateHashes.push(stateHash(state));
    evParts.push(canonicalize(r.events));
    opts.onStep?.(state);
  };
  const legalOf = (seat: number) => module.legalFromView(module.project(state, { kind: "seat", seat }));
  for (let guard = 0; guard < 200_000; guard++) {
    if (module.summary(state).over || handNo > (opts.maxHands ?? 1000)) break;
    const w = module.waitingOn(state);
    if (w.mode === "AUTO") {
      handNo++;
      apply({ t: "BeginHand", actor: "system", hand_id: `h${handNo}`, hand_seed: testSeed(`${label}/hand/${handNo}`) });
      continue;
    }
    const handId = module.handInfo(state)!.hand_id;
    if (w.mode === "WINDOW") {
      for (let seat = 0; seat < seats; seat++) {
        const legal = legalOf(seat);
        legalParts.push(canonicalize(legal));
        const m = chooser(module, state, seat, legal, n++);
        if (m && m.t === "RequestRedeal") apply(module.toAction(m, seat, handId));
      }
      apply({ t: "CloseWindow", actor: "system", hand_id: handId });
      continue;
    }
    const turn = w.seats[0]!;
    if (opts.offTurnSixteenths) {
      let acted = false;
      for (let seat = 0; seat < seats && !acted; seat++) {
        if (seat === turn) continue;
        const legal = legalOf(seat);
        if (legal.length === 0) continue;
        if (parseInt(sha256Hex(`${label}/off/${n}/${seat}`).slice(0, 2), 16) % 16 >= opts.offTurnSixteenths) continue;
        apply(module.toAction(legal[0]!, seat, handId));
        n++;
        acted = true;
      }
      if (acted) continue;
    }
    const legal = legalOf(turn);
    legalParts.push(canonicalize(legal));
    const m = chooser(module, state, turn, legal, n++);
    if (!m) throw new Error(`driver: chooser returned no move on a turn (${module.id})`);
    apply(module.toAction(m, turn, handId));
  }
  return { state, actions, stateHashes, eventsHash: sha256Hex(evParts.join("\n")), legalHash: sha256Hex(legalParts.join("\n")) };
}

/** Shortens a match for tests and digests, per game. */
 
export function shortRules(game: string, rules: any, hands = 2): any {
  if (game === "callbreak") return { ...rules, rounds: Math.min(rules.rounds, hands) };
  if (game === "courtpiece") return { ...rules, target_points: Math.min(rules.target_points, hands) };
  if (game === "bhabhi") return { ...rules, rounds: Math.min(rules.rounds, hands), bhabhi_limit: 0 };
  return rules;
}

/** Compiled rules for a profile (throws on error). */
 
export function rulesOf(profileId: string, settings: Record<string, unknown> = {}, preset = "standard"): { module: GameModule; rules: any } {
  const c = compile(profileId, settings, preset);
  if (!c.ok) throw new Error(c.error);
  return { module: getModule(c.game), rules: c.rules };
}

/**
 * Behaviour digest (02_ENGINE.md §9): hash over legal-action sets, state hashes and events of a fixed-seed
 * simulation set covering defaults and toggles. Equal digests ⇒ compatible behaviour. A function of behaviour
 * only: the engine build hash is deliberately excluded.
 */
export function behaviourDigest(profileId: string, _engineBuild = "", games = 2): string {
  const p = PROFILES[profileId];
  if (!p) throw new Error("unknown profile");
  const configs: Record<string, unknown>[] = [{}];
  for (const t of p.toggles) {
    if (t.id === "handicap" || t.id === "rounds" || t.id === "target_points") continue;
    if (t.kind === "boolean") configs.push({ [t.id]: !t.default });
    else for (const v of (t.values ?? []).filter((x) => x !== t.default).slice(0, 2)) configs.push({ [t.id]: v });
  }
  const parts: string[] = [profileId];
  configs.forEach((cfg, i) => {
    const c = compile(profileId, cfg);
    if (!c.ok) return; // combinations the profile refuses are not behaviour
    const module = getModule(c.game);
    const rules = shortRules(c.game, c.rules, 1);
    for (let g = 0; g < games; g++) {
      const d = driveMatch(module, rules, `digest/${profileId}/${i}/${g}`, g % 2 === 0 ? botChooser("medium") : hashChooser(`digest/${i}/${g}`));
      parts.push(canonicalize(cfg), d.stateHashes[d.stateHashes.length - 1]!, d.eventsHash, d.legalHash);
    }
  });
  return hashCanonical(parts);
}
