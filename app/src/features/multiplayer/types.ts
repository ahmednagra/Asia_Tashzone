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

/** What a same-Wi-Fi table adds to the session: only the host has a PIN, QR and address to show. */
export interface WifiState {
  role: "host" | "guest";
  pin: string | null;
  /** `tashzone://wifi?...` for the QR code */
  qr: string | null;
  /** `ip:port` for manual joining */
  address: string | null;
  /** roster with online flags (host only); guests use the session's `members` */
  roster: { seat: number; name: string; kind: "human" | "bot"; host: boolean; online: boolean }[];
  /** the table refuses every PIN (too many wrong tries) */
  locked: boolean;
}

export type TicketView =
  | { status: "waiting"; profile_id: string; seats: number; position: number | null; bot_backfill_in_seconds: number; expires_at: string }
  | { status: "matched"; profile_id: string; seats: number; join: JoinTicket }
  | { status: "expired" | "cancelled" | string; profile_id: string; seats: number };
