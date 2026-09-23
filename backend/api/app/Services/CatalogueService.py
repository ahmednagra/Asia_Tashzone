"""Games, presets and table sizes the app can offer online, derived from the profile bundles."""
from app.Services.GameConfigService import bundles
from config.settings import Settings


def catalogue(settings: Settings) -> dict:
    """Games, presets and table sizes the app can offer online (derived from the profile bundles)."""
    games = []
    for pid, b in bundles().items():
        props = b["settings_schema"]["properties"]
        games.append({"profile_id": pid, "game": b["game"], "presets": list(b["presets"]), "default_preset": b.get("default_preset", "standard"),
                      "seat_counts": props["players"]["enum"] if "players" in props else [4],
                      "online": settings.online_enabled and pid not in settings.disabled_profile_set})
    return {"games": games}
