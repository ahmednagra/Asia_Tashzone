/**
 * Hand-off between the table and the result screens (separate routes). The table publishes what a result
 * screen needs (data plus the actions it may take) and clears it on unmount; the screens read it. Pure
 * TypeScript, no React Native, so it is tested in Node.
 */
import type { GameResult, HandResult } from "./result/model";

export type Outcome =
  | { kind: "hand"; data: HandResult; onNext: () => void; onLeave: () => void }
  | { kind: "game"; data: GameResult; onAgain: () => void; onLeave: () => void };

let current: Outcome | null = null;

export function publishOutcome(o: Outcome | null): void { current = o; }
export function readOutcome(): Outcome | null { return current; }
/** Clears only if the caller's outcome is still the published one (a newer table may have replaced it). */
export function clearOutcome(o: Outcome): void { if (current === o) current = null; }
