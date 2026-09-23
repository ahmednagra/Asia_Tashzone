from fastapi import APIRouter

from app.Core.security import Config
from app.Http.Controllers.AppConfigController import AppConfigController

router = APIRouter(prefix="/app-config", tags=["App config"])


@router.get("")
def get_app_config(settings: Config):
    """Kill switch, per-game switches, minimum version, APK update, engine manifest. Missing values mean "no opinion"."""
    return AppConfigController.get(settings)
