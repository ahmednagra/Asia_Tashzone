"""App config: read once per launch by every app; unauthenticated (nothing in it is private)."""
from app.Services import AppConfigService
from config.settings import Settings


class AppConfigController:
    @staticmethod
    def get(settings: Settings) -> dict:
        return AppConfigService.app_config(settings)
