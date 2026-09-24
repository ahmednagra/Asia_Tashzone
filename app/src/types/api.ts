/** Response shapes of the FastAPI backend (backend/api). Hand-written; keep in step with the OpenAPI schema. */
export interface AppConfig {
  min_version_code: number;
  protocol: { min: number; max: number };
  engine_build_hash: string | null;
  behaviour_digests: Record<string, string>;
  match_url: string;
  features?: Partial<Record<string, boolean>>;
  sign_in_providers?: string[];
  email_accounts?: boolean;
}
export interface JoinResponse { room_code: string; seat: number; match_url: string; join_token: string }
export interface MeView {
  player_id: string;
  display_name: string;
  avatar_id: number;
  protected: boolean;
  linked_providers: string[];
  email: string | null;
  available_providers: string[];
}
export interface LinkView { provider: string; linked_at: string }
export interface RestoreView { player_id: string; token: string }
export type SessionView = RestoreView;
export interface DeviceSession { id: string; device_name: string | null; created_at: string; last_seen_at: string; current: boolean }
export interface ProgressBody {
  xp: number;
  matches: number;
  wins: number;
  hands_played: number;
  first_out: number;
  times_bhabhi: number;
  best_streak: number;
  badges: string[];
  games: Record<string, { matches: number; wins: number; hands_played: number }>;
}
export interface ProgressView extends ProgressBody { level: number; titles: number[]; updated_at: string }
