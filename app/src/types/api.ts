/** Response shapes of the FastAPI backend (backend/api). Hand-written; keep in step with the OpenAPI schema. */
export interface AppConfig {
  min_version_code: number;
  protocol: { min: number; max: number };
  engine_build_hash: string | null;
  behaviour_digests: Record<string, string>;
  match_url: string;
}
export interface JoinResponse { room_code: string; seat: number; match_url: string; join_token: string }
