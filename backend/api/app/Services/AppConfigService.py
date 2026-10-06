"""Remote control the app reads at launch: kill switch, per-game and per-feature switches, minimum version, APK
update, engine manifest. All from the environment: no rebuild, no redeploy of the app."""
import json
from pathlib import Path

from app.Core.errors import ApiError
from app.Services.GameConfigService import bundles
from app.Services.IdentityVerifier import configured_providers
from config.settings import Settings

FEATURES = ("quick_match", "voice", "free_text", "feedback", "account_linking")


def feature_enabled(settings: Settings, feature: str) -> bool:
    return settings.online_enabled and feature not in settings.disabled_feature_set


def require_online(settings: Settings, profile_id: str | None = None) -> None:
    if not settings.online_enabled:
        raise ApiError(503, "ONLINE_DISABLED", settings.maintenance_message_en or "Online play is paused for maintenance")
    if profile_id is not None and profile_id in settings.disabled_profile_set:
        raise ApiError(503, "GAME_DISABLED", "This game is not available online right now")


def require_feature(settings: Settings, feature: str) -> None:
    if not feature_enabled(settings, feature):
        raise ApiError(503, "FEATURE_DISABLED", "This feature is not available right now")


def _manifest(settings: Settings) -> dict:
    if settings.engine_manifest and Path(settings.engine_manifest).exists():
        return json.loads(Path(settings.engine_manifest).read_text())
    return {"engine_build_hash": None, "behaviour_digests": {}}


def app_config(settings: Settings) -> dict:
    """Read once per launch; unauthenticated (nothing here is private). Missing values mean "no opinion"."""
    m = _manifest(settings)
    latest = None
    if settings.app_latest_version_code and settings.app_download_url:
        notes = {k: v for k, v in (("en", settings.app_release_notes_en), ("ur", settings.app_release_notes_ur)) if v}
        latest = {"version": settings.app_latest_version, "version_code": settings.app_latest_version_code,
                  "download_url": settings.app_download_url, "sha256": settings.app_download_sha256,
                  "size_bytes": settings.app_download_size_bytes, "notes": notes}
    maintenance = {k: v for k, v in (("en", settings.maintenance_message_en), ("ur", settings.maintenance_message_ur)) if v}
    return {
        "min_version_code": settings.min_version_code,
        "minimum_version": settings.app_minimum_version or None,
        "latest": latest,
        "online": {"enabled": settings.online_enabled, "disabled_profiles": sorted(settings.disabled_profile_set), "message": maintenance or None},
        "protocol": {"min": 2, "max": 2},
        "engine_build_hash": m.get("engine_build_hash"),
        "behaviour_digests": m.get("behaviour_digests", {}),
        "match_url": settings.match_server_url,
        "profiles": {pid: {"profile_hash": b["profile_hash"], "status": b["status"], "default_preset": b.get("default_preset", "standard"),
                           "online": settings.online_enabled and pid not in settings.disabled_profile_set} for pid, b in bundles().items()},
        "features": {**{f: feature_enabled(settings, f) for f in FEATURES}, "voice": feature_enabled(settings, "voice") and settings.voice_configured,
                     "verify_hand": False, "tournaments": False},
        "sign_in_providers": list(configured_providers()),
        "email_accounts": feature_enabled(settings, "account_linking") and settings.email_accounts_configured,
    }
