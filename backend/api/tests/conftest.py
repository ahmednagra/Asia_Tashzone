import os

import pytest

os.environ.setdefault("PLAYER_TOKEN_SECRET", "p" * 40)
os.environ.setdefault("JOIN_TOKEN_SECRET", "j" * 40)
os.environ.setdefault("INTERNAL_API_TOKEN", "i" * 40)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # TZ_TEST_DATABASE_URL runs the same tests against PostgreSQL (migrated with Alembic)
    url = os.environ.get("TZ_TEST_DATABASE_URL") or f"sqlite:///{tmp_path}/t.db"
    monkeypatch.setenv("DATABASE_URL", url)
    import app.Models  # noqa: F401  (register every table on Base.metadata before create_all)
    from app.Middleware.rate_limit import reset_limits
    from config.database import Base, engine, reset_engine
    from config.settings import get_settings

    get_settings.cache_clear()
    reset_limits()
    reset_engine()
    if url.startswith("sqlite"):
        Base.metadata.create_all(engine())
    else:
        with engine().begin() as c:
            for t in reversed(Base.metadata.sorted_tables):
                c.exec_driver_sql(f'TRUNCATE "{t.name}" CASCADE')
    from fastapi.testclient import TestClient

    from main import create_app

    with TestClient(create_app()) as tc:
        yield tc
    reset_engine()


INTERNAL = {"Authorization": "Bearer " + "i" * 40}


def register(client, name="Asha", adult=True, **extra):
    body = {"display_name": name, "birth_year": 1990 if adult else 2015, **extra}
    r = client.post("/api/v1/players", json=body)
    assert r.status_code == 201, r.text
    d = r.json()
    return d["player_id"], {"Authorization": f"Bearer {d['token']}"}


@pytest.fixture()
def env(monkeypatch):
    """Set environment settings mid-test: env(ONLINE_ENABLED="false")."""
    from config.settings import get_settings

    def set_env(**values):
        for k, v in values.items():
            monkeypatch.setenv(k, str(v))
        get_settings.cache_clear()
    yield set_env
    get_settings.cache_clear()


@pytest.fixture()
def db_session(client):
    from config.database import get_db
    gen = get_db()
    s = next(gen)
    yield s
    s.close()


@pytest.fixture()
def moderator(client, db_session):
    """An admin moderator (appointed as scripts/grant_moderator does)."""
    from app.Services.SanctionService import grant_moderator
    pid, h = register(client, "Mod")
    grant_moderator(db_session, pid, "admin", None)
    return pid, h
