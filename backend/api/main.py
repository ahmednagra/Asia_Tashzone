# main.py — uvicorn main:app
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.Core.bootstrap import create_missing_tables
from app.Core.errors import register_error_handlers
from app.Middleware.request_id import RequestIdMiddleware
from config.settings import get_settings
from routes import setup_api_routes


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if get_settings().db_auto_create:
        create_missing_tables()
    yield


def create_app() -> FastAPI:
    # New tables are created at startup (DB_AUTO_CREATE); changes to existing tables go through Alembic migrations.
    settings = get_settings()  # fail fast on missing or weak secrets (C-17)
    app = FastAPI(
        title="TashZone API",
        version="0.2.0",
        # No public schema or docs in production; scripts.export_openapi builds the schema from create_app().openapi().
        openapi_url=None if settings.is_production else "/openapi.json",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        lifespan=lifespan,
    )
    app.add_middleware(RequestIdMiddleware)
    register_error_handlers(app)
    setup_api_routes(app)
    return app


app = create_app()
