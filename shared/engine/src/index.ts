/**
 * @tashzone/engine — deterministic shared engine (02_ENGINE.md), used identically by the phone and the server.
 *   module.step(state, action) -> (state', events[])   total, deterministic, no I/O
 *   module.project(state, viewer) -> SeatView          the only exit for game data
 *   module.legalFromView(view) -> SeatMove[]           reads the SeatView only
 * Layout (as TashZone v1): core/ · families/ · games/ · bots/ · profiles/ · registry · testing.
 */
export const ENGINE_VERSION = "0.2.0";
export const EVENT_SCHEMA_VERSION = 2;

export * from "./core/types.js";
export * from "./core/contract.js";
export * from "./core/bytes.js";
export * from "./core/canonical.js";
export * from "./core/cards.js";
export * from "./core/rng.js";
export * from "./core/botrng.js";
export * from "./core/seats.js";
export * from "./core/journal.js";
export * from "./core/replay.js";
export * from "./registry.js";
export {
  type FollowRules, FREE_FOLLOW, trickWinner, highestOfLed, legalCards, followError, inferVoids, removeEach, removeOne,
  highest, lowest, sameCards, cardsOfSuit,
} from "./families/trick-taking.js";
export * from "./games/callbreak.js";
export {
  type CourtPieceRules, type CourtPieceState, type CourtPieceView, type CourtPieceHand, type CourtPieceHandView,
  type CourtPieceMatch, type CourtPieceHandResult, type Team, teamOf, courtpiece,
} from "./games/courtpiece.js";
export {
  type BhabhiRules, type BhabhiState, type BhabhiView, type BhabhiHand, type BhabhiHandView, type BhabhiMatch,
  type BhabhiHandResult, type BhabhiLastTrick, type PowerHolderEmpty, bhabhi, bhabhiPlacements, checkRules as checkBhabhiRules,
} from "./games/bhabhi.js";
export * from "./bots/index.js";
export * from "./profiles/index.js";
export * from "./testing.js";
