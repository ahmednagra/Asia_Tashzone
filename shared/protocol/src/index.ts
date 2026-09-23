/**
 * Wire protocol, major 2 (03_PLATFORM.md §6). JSON frames `{type, ...}`.
 * The app sends intents; only the Reducer creates actions. Every inbound frame is
 * validated strictly; unknown or malformed frames close the connection.
 */
import { z } from "zod";
import { hashCanonical } from "@tashzone/engine";

export const PROTOCOL_MAJOR = 2;
export const PROTOCOL_MIN_SUPPORTED = 2; // server supports current and previous major; v1 is retired at RG-1
export const MAX_FRAME_BYTES = 16 * 1024;

export const ERROR_CODES = [
  "UPDATE_REQUIRED", "TABLE_PAUSED", "OWNERSHIP_LOST", "KICKED", "ROOM_LOCKED", "JOIN_PENDING_APPROVAL",
  "MATCH_INTERRUPTED", "WINDOW_CLOSED", "STALE_VIEW", "BAD_FRAME", "UNAUTHORIZED", "RATE_LIMITED", "NOT_SEATED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const hex = (n: number) => z.string().regex(new RegExp(`^[0-9a-f]{${n}}$`));
const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_.:-]+$/);

export const SeatMoveSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("RequestRedeal") }).strict(),
  z.object({ t: z.literal("Call"), n: z.number().int().min(0).max(13) }).strict(),
  z.object({ t: z.literal("Play"), card: z.string().regex(/^[2-9TJQKA][CDHS]$/) }).strict(),
  z.object({ t: z.literal("ChooseTrump"), suit: z.enum(["S", "H", "D", "C"]) }).strict(),
  z.object({ t: z.literal("Take") }).strict(),
]);

/* ─────────── App → match server ─────────── */
export const HelloSchema = z.object({
  type: z.literal("Hello"),
  protocol_min: z.number().int().min(1),
  protocol_max: z.number().int().min(1),
  version_code: z.number().int().min(0),
  engine_build_hash: hex(64),
  behaviour_digest: hex(64),
  correlation_id: id,
  join_token: z.string().min(10).max(2048),
  last_view_seq: z.number().int().min(0).optional(),
}).strict();

export const ClientMessageSchema = z.discriminatedUnion("type", [
  HelloSchema,
  z.object({ type: z.literal("Ping"), n: z.number().int().min(0) }).strict(),
  z.object({ type: z.literal("Start") }).strict(),
  z.object({ type: z.literal("Ready"), hand_id: id, client_seed: hex(64) }).strict(),
  z.object({ type: z.literal("Intent"), intent_id: id, hand_id: id, expected_view_seq: z.number().int().min(0), action: SeatMoveSchema }).strict(),
  z.object({ type: z.literal("ResumeControl") }).strict(),
  z.object({ type: z.literal("RequestSnapshot"), reason: z.enum(["hash_mismatch", "gap", "resume", "user"]) }).strict(),
  z.object({ type: z.literal("Chat"), quick_chat_id: z.string().max(32).optional(), text: z.string().max(200).optional() }).strict(),
  z.object({ type: z.literal("Leave") }).strict(),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type Hello = z.infer<typeof HelloSchema>;

/* ─────────── Match server → app ─────────── */
export type SeatControl = "human" | "handover" | "bot";
export interface TableMeta {
  readonly room: string;
  readonly profile_id: string;
  readonly effective_profile_hash: string;
  readonly engine_build_hash: string;
  readonly seats: readonly { readonly seat: number; readonly name: string; readonly kind: "human" | "bot" }[];
  readonly you: number | null;
}
export type ServerMessage =
  | { type: "Welcome"; protocol: number; server_time: number; session: string }
  | { type: "Pong"; n: number; server_time: number }
  | { type: "TableSnapshot"; view_seq: number; view_hash: string; seat_view: unknown; table_meta: TableMeta;
      waiting_on: unknown; deadline: number | null; seat_controls: readonly SeatControl[]; commitment: string | null }
  | { type: "ViewEvents"; from_seq: number; to_seq: number; events: readonly unknown[]; view_hash: string;
      waiting_on: unknown; deadline: number | null }
  | { type: "IntentResult"; intent_id: string; accepted: boolean; server_seq?: number; reject_code?: string }
  | { type: "SeedRequest"; hand_id: string; commitment: string }
  | { type: "HandSealed"; hand_id: string; verification_record: unknown }
  | { type: "SeatControlChanged"; seat: number; control: SeatControl }
  | { type: "PresenceChanged"; seat: number; online: boolean }
  | { type: "HostChanged"; seat: number }
  | { type: "Chat"; seat: number; quick_chat_id?: string; text?: string }
  | { type: "TablePaused"; reason: string }
  | { type: "TableResumed"; deadline: number | null }
  | { type: "ServerRestarting"; plan: "continue" | "handover" | "interrupt"; deadline: number }
  | { type: "MatchEnded"; result: unknown; outcome: "completed" | "interrupted" }
  | { type: "Error"; code: ErrorCode };

export type ParseResult = { ok: true; msg: ClientMessage } | { ok: false; code: "BAD_FRAME" };

/** Parse and validate one inbound text frame. Never throws. */
export function parseClientFrame(raw: string): ParseResult {
  if (raw.length > MAX_FRAME_BYTES) return { ok: false, code: "BAD_FRAME" };
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return { ok: false, code: "BAD_FRAME" }; }
  const r = ClientMessageSchema.safeParse(json);
  return r.success ? { ok: true, msg: r.data } : { ok: false, code: "BAD_FRAME" };
}

export function encode(msg: ServerMessage | ClientMessage): string {
  return JSON.stringify(msg);
}

/** View hash sent with snapshots/events; the app recomputes it over its projection (§6.6 consistency). */
export function viewHash(view: unknown): string {
  return hashCanonical(view);
}

export function negotiate(min: number, max: number): number | null {
  const hi = Math.min(max, PROTOCOL_MAJOR);
  return hi >= Math.max(min, PROTOCOL_MIN_SUPPORTED) ? hi : null;
}
