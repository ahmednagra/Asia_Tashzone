from sqlalchemy import inspect, text

import app.Models  # noqa: F401
from app.Utils.Logger import logger
from config.database import Base, engine

SCHEMA_LOCK_KEY = 7406231811


def create_missing_tables() -> list[str]:
    with engine().begin() as conn:
        if conn.dialect.name == "postgresql":
            conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": SCHEMA_LOCK_KEY})
        existing = set(inspect(conn).get_table_names())
        missing = [t for t in Base.metadata.sorted_tables if t.name not in existing]
        if missing:
            Base.metadata.create_all(conn, tables=missing, checkfirst=True)
    names = [t.name for t in missing]
    if names:
        logger.info("tables_created", extra={"tables": names})
    return names
