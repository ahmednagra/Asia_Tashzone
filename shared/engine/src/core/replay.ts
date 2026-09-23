/** P-15 deterministic replay: replay(module, rules, actions) == recorded events and state hashes. */
import { hashCanonical } from "./canonical.js";
import { type CallbreakRules, type CallbreakState, callbreak } from "../games/callbreak.js";
import type { GameModule } from "./contract.js";
import type { Action, EngineEvent } from "./types.js";

export function stateHash(state: unknown): string {
  return hashCanonical(state);
}

export interface ReplayOutput<S = unknown> {
  readonly state: S;
  readonly stateHashes: string[];
  readonly events: EngineEvent[][];
}

export function replayModule<S>(module: GameModule<S>, rules: unknown, actions: readonly Action[], from?: S): ReplayOutput<S> {
  let state = from ?? module.initialState(rules);
  const stateHashes: string[] = [];
  const events: EngineEvent[][] = [];
  for (let i = 0; i < actions.length; i++) {
    const r = module.step(state, actions[i]);
    if (!r.ok) throw new Error(`replay: action ${i} rejected (${r.code})`);
    state = r.state;
    stateHashes.push(stateHash(state));
    events.push(r.events.slice());
  }
  return { state, stateHashes, events };
}

/** Callbreak shorthand kept for existing callers. */
export function replay(rules: CallbreakRules, actions: readonly Action[], from?: CallbreakState): ReplayOutput<CallbreakState> {
  return replayModule(callbreak, rules, actions, from);
}
