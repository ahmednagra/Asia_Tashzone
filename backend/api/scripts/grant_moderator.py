"""Appoint or remove a moderator from the server console (never an API). Writes the same audit row a route would.

    docker compose exec api python -m scripts.grant_moderator <player_id> [--role admin|moderator] [--revoke]
The player id is shown in the app under Settings → About (long-press the version)."""
import argparse
import sys

from app.Core.errors import ApiError
from app.Services.SanctionService import grant_moderator, revoke_moderator
from config.database import get_db


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("player_id")
    ap.add_argument("--role", choices=["moderator", "admin"], default="moderator")
    ap.add_argument("--revoke", action="store_true")
    a = ap.parse_args()
    db = next(get_db())
    try:
        if a.revoke:
            revoke_moderator(db, a.player_id, None)
            print(f"revoked {a.player_id}")
        else:
            m = grant_moderator(db, a.player_id, a.role, None)
            print(f"granted {m.role} to {m.player_id}")
        return 0
    except ApiError as e:
        print(f"error: {e.code} {e.message}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
