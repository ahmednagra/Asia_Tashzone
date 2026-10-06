"""Environment configuration (C-17). Every old TashZone operational setting is here, lower-cased
(pydantic-settings matches env vars case-insensitively, so ROOM_TTL_MINUTES sets room_ttl_minutes)."""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_PLACEHOLDER_MARKERS = ("dev-", "change-me", "replace-with")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "sqlite:///./dev.db"
    player_token_secret: str
    join_token_secret: str
    internal_api_token: str
    match_server_url: str = "ws://localhost:8787/match"  # env MATCH_SERVER_URL
    engine_manifest: str | None = None
    release_tag: str = "dev"
    release_commit: str = "unknown"

    # tokens
    player_token_days: int = 180
    join_token_ttl_s: int = 600

    # ── remote control: kill switch, minimum version, APK update (read by every app at launch) ──
    online_enabled: bool = True  # false: every online action answers 503 ONLINE_DISABLED; offline play is unaffected
    disabled_profiles: str = ""  # comma list, e.g. "bhabhi.tz@1": that game cannot be played online
    disabled_features: str = ""  # comma list of: quick_match, voice, free_text, feedback, account_linking
    maintenance_message_en: str = ""
    maintenance_message_ur: str = ""
    min_version_code: int = 1  # below this versionCode the app must update before playing online
    app_minimum_version: str = ""
    app_latest_version: str = ""
    app_latest_version_code: int = 0
    app_download_url: str = ""
    app_download_sha256: str = ""
    app_download_size_bytes: int = 0
    app_release_notes_en: str = ""
    app_release_notes_ur: str = ""

    # rooms and retention
    room_ttl_minutes: int = 60
    room_playing_max_minutes: int = Field(default=180, ge=30)
    room_finished_idle_minutes: int = Field(default=30, ge=1)
    room_retention_days: int = Field(default=30, ge=1)
    feedback_retention_days: int = Field(default=180, ge=1)
    report_retention_days: int = Field(default=180, ge=1)
    expiry_interval_seconds: int = Field(default=300, ge=10)

    # Quick Match
    matchmaking_ticket_ttl_seconds: int = Field(default=120, ge=10, le=900)
    matchmaking_bot_backfill_seconds: int = Field(default=20, ge=0, le=600)
    matchmaking_room_ttl_minutes: int = Field(default=10, ge=1, le=60)
    matchmaking_candidate_factor: int = Field(default=3, ge=1, le=10)
    matchmaking_max_candidates: int = Field(default=32, ge=8, le=200)
    matchmaking_max_position: int = Field(default=100, ge=10, le=1000)
    matchmaking_queues_per_minute: int = Field(default=10, ge=1)
    matchmaking_polls_per_minute: int = Field(default=60, ge=1)
    matchmaking_queues_per_ip_per_minute: int = Field(default=60, ge=1)

    # voice (self-hosted LiveKit)
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""
    voice_token_minutes: int = Field(default=120, ge=5, le=360)

    # moderation
    max_blocks_per_player: int = Field(default=200, ge=1, le=1000)
    reports_per_hour: int = Field(default=5, ge=1)
    reports_per_ip_per_hour: int = Field(default=30, ge=1)
    voice_tokens_per_hour: int = Field(default=20, ge=1)
    moderation_page_size: int = Field(default=25, ge=1, le=100)
    moderation_max_page_size: int = Field(default=100, ge=1, le=200)
    moderation_max_offset: int = Field(default=1000, ge=0, le=10_000)
    moderation_actions_per_minute: int = Field(default=60, ge=1)
    sanction_default_days: int = Field(default=7, ge=1, le=365)
    sanction_max_days: int = Field(default=365, ge=1, le=3650)
    sanction_retention_days: int = Field(default=365, ge=1)
    appeals_per_hour: int = Field(default=5, ge=1)
    appeal_max_chars: int = Field(default=500, ge=1, le=500)
    report_evidence_enabled: bool = False
    report_evidence_max_messages: int = Field(default=10, ge=1, le=50)
    report_evidence_max_chars: int = Field(default=200, ge=1, le=500)
    report_evidence_retention_days: int = Field(default=30, ge=1, le=180)

    # optional sign-in (account recovery only)
    google_client_ids: str = ""
    apple_client_ids: str = ""
    play_games_client_id: str = ""
    play_games_client_secret: str = ""
    oidc_jwks_ttl_seconds: int = Field(default=3600, ge=60, le=86_400)
    oidc_jwks_min_refresh_seconds: int = Field(default=60, ge=5, le=3600)
    oidc_http_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    oidc_max_response_bytes: int = Field(default=64 * 1024, ge=4096)
    oidc_max_token_chars: int = Field(default=8192, ge=512)
    oidc_clock_skew_seconds: int = Field(default=60, ge=0, le=300)

    # email accounts
    mail_backend: str = "disabled"
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_ssl: bool = False
    smtp_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    mail_from: str = ""
    auth_code_ttl_minutes: int = Field(default=10, ge=2, le=60)
    auth_code_max_attempts: int = Field(default=5, ge=1, le=10)
    auth_code_resend_seconds: int = Field(default=60, ge=10, le=600)
    auth_code_retention_hours: int = Field(default=24, ge=1)
    auth_codes_per_email_per_hour: int = Field(default=5, ge=1)
    auth_codes_per_ip_per_hour: int = Field(default=20, ge=1)
    logins_per_email_per_15_minutes: int = Field(default=8, ge=1)
    logins_per_ip_per_hour: int = Field(default=60, ge=1)

    # startup
    db_auto_create: bool = True

    # rate limits
    account_links_per_hour: int = Field(default=10, ge=1)
    restores_per_ip_per_hour: int = Field(default=20, ge=1)
    progress_syncs_per_minute: int = Field(default=6, ge=1)
    registrations_per_ip_per_hour: int = Field(default=30, ge=1)
    room_creates_per_minute: int = Field(default=10, ge=1)
    room_join_attempts_per_minute: int = 20
    room_join_attempts_per_ip_per_minute: int = 60
    feedback_per_minute: int = 3
    feedback_per_ip_per_minute: int = 20

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def voice_configured(self) -> bool:
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret)

    @staticmethod
    def _list(value: str) -> tuple[str, ...]:
        return tuple(part.strip() for part in value.split(",") if part.strip())

    @property
    def google_audiences(self) -> tuple[str, ...]:
        return self._list(self.google_client_ids)

    @property
    def apple_audiences(self) -> tuple[str, ...]:
        return self._list(self.apple_client_ids)

    @property
    def play_games_configured(self) -> bool:
        return bool(self.play_games_client_id and self.play_games_client_secret)

    @property
    def email_accounts_configured(self) -> bool:
        if self.mail_backend == "console":
            return True
        return self.mail_backend == "smtp" and bool(self.smtp_host and self.mail_from)

    @property
    def disabled_profile_set(self) -> frozenset[str]:
        return frozenset(self._list(self.disabled_profiles))

    @property
    def disabled_feature_set(self) -> frozenset[str]:
        return frozenset(self._list(self.disabled_features))

    def check(self) -> None:
        secrets = {"PLAYER_TOKEN_SECRET": self.player_token_secret, "JOIN_TOKEN_SECRET": self.join_token_secret,
                   "INTERNAL_API_TOKEN": self.internal_api_token}
        if self.livekit_api_secret:
            secrets["LIVEKIT_API_SECRET"] = self.livekit_api_secret
        if any(len(s) < 32 for s in secrets.values()):
            raise ValueError("secrets must be at least 32 characters")
        if len(set(secrets.values())) != len(secrets):
            raise ValueError("secrets must be distinct")
        if self.mail_backend not in ("disabled", "console", "smtp"):
            raise ValueError("MAIL_BACKEND must be disabled, console or smtp")
        if self.is_production and self.mail_backend == "console":
            raise ValueError("MAIL_BACKEND=console prints sign-in codes to the log and is not allowed in production")
        if self.is_production:
            bad = [n for n, v in secrets.items() if any(m in v.lower() for m in _PLACEHOLDER_MARKERS)]
            if bad:
                raise ValueError(f"production secrets are placeholders: {', '.join(bad)}")


@lru_cache
def get_settings() -> Settings:
    s = Settings()  # type: ignore[call-arg]
    s.check()
    return s
