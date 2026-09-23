# main.py — uvicorn main:app
from fastapi import FastAPI

from app.Core.errors import register_error_handlers
from app.Middleware.request_id import RequestIdMiddleware
from config.settings import get_settings
from routes import setup_api_routes


def create_app() -> FastAPI:
    # Schema changes happen only through Alembic migrations; nothing creates tables at startup.
    settings = get_settings()  # fail fast on missing or weak secrets (C-17)
    app = FastAPI(
        title="TashZone API",
        version="0.2.0",
        # No public schema or docs in production; scripts.export_openapi builds the schema from create_app().openapi().
        openapi_url=None if settings.is_production else "/openapi.json",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    setup_api_routes(app)
    return app


app = create_app()
