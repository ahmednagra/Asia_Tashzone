from fastapi import FastAPI

from routes.api import health
from routes.api.v1 import app_config, catalogue, feedback, internal, matchmaking, moderation, players, reports, rooms


def setup_api_routes(app: FastAPI) -> None:
    app.include_router(health.router)
    for module in (players, rooms, matchmaking, catalogue, app_config, feedback, reports, moderation, internal):
        app.include_router(module.router, prefix="/api/v1")
