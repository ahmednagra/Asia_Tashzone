/** @tashzone/match — table runners shared by the app: offline LocalTable, the reconnecting online MatchClient, the
 * transport-agnostic Room (also run by backend/match-server) and the same-Wi-Fi host table / guest adapters. */
export * from "./localTable.js";
export * from "./matchClient.js";
export * from "./room/index.js";
export * from "./lan/link.js";
export * from "./lan/framing.js";
export * from "./lan/qr.js";
export * from "./lan/linkSocket.js";
export * from "./lan/hostTable.js";
export * from "./lan/hostSeat.js";
