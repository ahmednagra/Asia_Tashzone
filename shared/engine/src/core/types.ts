/** P-10 actions and events; P-05 viewers; P-07 waiting modes. Shared by every game module. */
import type { CardId, Suit } from "./cards.js";
import type { DrawRecord } from "./rng.js";

export type Seat = number;
export type Actor = Seat | "system";
export type GameId = "callbreak" | "courtpiece" | "bhabhi";

/** System actions come from the Runtime Shell, never from a client. */
export type SystemAction =
  | { readonly t: "BeginHand"; readonly actor: "system"; readonly hand_id: string; readonly hand_seed: string }
  | { readonly t: "CloseWindow"; readonly actor: "system"; readonly hand_id: string }
  | { readonly t: "Timeout"; readonly actor: "system"; readonly hand_id: string; readonly seat: Seat };

/** What a seat may submit as an intent payload (actor and hand are bound by the server). */
export type SeatMove =
  | { readonly t: "RequestRedeal" }
  | { readonly t: "Call"; readonly n: number }
  | { readonly t: "Play"; readonly card: CardId }
  | { readonly t: "ChooseTrump"; readonly suit: Suit }
  | { readonly t: "Take" };

export type SeatActionType = SeatMove["t"];
export type SeatAction = SeatMove & { readonly actor: Seat; readonly hand_id: string };
export type Action = SystemAction | SeatAction;

/** Visibility of an event: public, or only the listed seats. */
export type EventVisibility = "public" | readonly Seat[];
export interface EngineEvent {
  readonly t: string;
  readonly vis: EventVisibility;
  readonly [k: string]: unknown;
}

export type WaitingOn =
  | { readonly mode: "TURN"; readonly seats: readonly Seat[] }
  | { readonly mode: "WINDOW"; readonly seats: readonly Seat[]; readonly window: string; readonly fixed_duration: boolean }
  | { readonly mode: "AUTO"; readonly seats: readonly Seat[] }
  | { readonly mode: "NONE"; readonly seats: readonly Seat[] };

/** C-10 viewer kinds (admin_breakglass is deliberately absent from the engine API). */
export type Viewer =
  | { readonly kind: "seat"; readonly seat: Seat }
  | { readonly kind: "handover_bot"; readonly seat: Seat }
  | { readonly kind: "spectator_public" }
  | { readonly kind: "eliminated_seat"; readonly seat: Seat }
  | { readonly kind: "post_hand_participant"; readonly seat: Seat };

/** Generic rejection codes, derivable from the actor's own view (L-04). */
export type RejectCode =
  | "BAD_SCHEMA"
  | "WRONG_HAND"
  | "NOT_NOW"
  | "NOT_YOUR_TURN"
  | "ILLEGAL_ACTION"
  | "MATCH_OVER";

/**
 * Precise reasons an intended move is illegal, for player messages ("Follow the lead suit").
 * Codes are the v1 app's stable codes: the app maps each to a translated message; never rename one.
 * Computed from the viewer's own SeatView only, so explaining never leaks hidden information.
 */
export type RuleErrorCode =
  | "MATCH_OVER"
  | "NOT_YOUR_TURN"
  | "WRONG_PHASE"
  | "INVALID_ACTION"
  | "CARD_NOT_IN_HAND"
  | "MUST_LEAD_ACE_OF_SPADES"
  | "MUST_FOLLOW_SUIT"
  | "MUST_BEAT"
  | "MUST_TRUMP"
  | "MUST_OVERTRUMP"
  | "MUST_NOT_LEAD_TRUMP"
  | "CALL_OUT_OF_RANGE";

export type StepResult<S> =
  | { readonly ok: true; readonly state: S; readonly events: readonly EngineEvent[]; readonly draws: readonly DrawRecord[] }
  | { readonly ok: false; readonly code: RejectCode };
