/** Response shapes of the room and matchmaking endpoints (backend RoomService.view / join_ticket, MatchmakingService._view). */
export interface RoomView {
  code: string;
  profile_id: string;
  preset: string;
  settings: Record<string, unknown>;
  seats: number;
  origin: "code" | string;
  status: "open" | "playing" | "finished" | "expired" | string;
  host_seat: number | null;
  expires_at: string;
  members: { seat: number; display_name: string; avatar_id: number }[];
}

export interface JoinTicket {
  room_code: string;
  seat: number;
  match_url: string;
  join_token: string;
  join_token_expires_in: number;
  profile_hash: string;
  room: RoomView;
}

export type TicketView =
  | { status: "waiting"; profile_id: string; seats: number; position: number | null; bot_backfill_in_seconds: number; expires_at: string }
  | { status: "matched"; profile_id: string; seats: number; join: JoinTicket }
  | { status: "expired" | "cancelled" | string; profile_id: string; seats: number };
