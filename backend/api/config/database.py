from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config.settings import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_Session: sessionmaker[Session] | None = None


def engine():
    global _engine, _Session
    if _engine is None:
        url = get_settings().database_url
        kw = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
        _engine = create_engine(url, **kw)
        if url.startswith("sqlite"):
            # enforce foreign keys like PostgreSQL does, so dev/test cannot hide ordering bugs
            event.listen(_engine, "connect", lambda conn, _rec: conn.execute("PRAGMA foreign_keys=ON"))
        _Session = sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_db() -> Iterator[Session]:
    engine()
    assert _Session is not None
    with _Session() as s:
        yield s


def reset_engine() -> None:
    global _engine, _Session
    _engine = None
    _Session = None
