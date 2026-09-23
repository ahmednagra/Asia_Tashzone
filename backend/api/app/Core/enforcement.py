"""Read-time sanction rules: what is live for whom and what it forbids. Only reads; writes are in moderation.py.
A sanction applies while it is not revoked and expires_at is null or in the future: no job ends a sanction."""
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.Core.errors import ApiError
from app.Models import SANCTION_RANK, Sanction


def now() -> datetime:
    return datetime.now(UTC)


def aware(value: datetime) -> datetime:
    """SQLite returns naive datetimes; stored values are UTC."""
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def live_condition(at: datetime | None = None):
    moment = at or now()
    return or_(Sanction.expires_at.is_(None), Sanction.expires_at > moment).self_group() & Sanction.revoked_at.is_(None)


def active_sanctions(db: Session, player_id: str, at: datetime | None = None) -> list[Sanction]:
    rows = list(db.scalars(select(Sanction).where(Sanction.subject_id == player_id, live_condition(at)).limit(50)))
    return sorted(rows, key=lambda s: (-SANCTION_RANK.get(s.kind, 0), -aware(s.created_at).timestamp()))


def active_sanction(db: Session, player_id: str, at: datetime | None = None) -> Sanction | None:
    found = active_sanctions(db, player_id, at)
    return found[0] if found else None


def active_kinds(db: Session, player_ids: list[str], at: datetime | None = None) -> dict[str, set[str]]:
    if not player_ids:
        return {}
    found: dict[str, set[str]] = {}
    for subject, kind in db.execute(select(Sanction.subject_id, Sanction.kind).where(Sanction.subject_id.in_(player_ids), live_condition(at))).all():
        found.setdefault(subject, set()).add(kind)
    return found


# warning restricts nothing: it is a record and a message to the player
SILENCING_KINDS = frozenset({"chat_muted", "online_suspended", "banned"})
OFFLINE_KINDS = frozenset({"online_suspended", "banned"})


def banned_error() -> ApiError:
    # 403, not 401: the token is valid and the app must not throw it away and register a new profile
    return ApiError(403, "ACCOUNT_BANNED", "This profile is banned from TashZone")


def is_banned(db: Session, player_id: str) -> bool:
    return any(s.kind == "banned" for s in active_sanctions(db, player_id))


def require_online_allowed(db: Session, player_id: str) -> None:
    kinds = {s.kind for s in active_sanctions(db, player_id)}
    if "banned" in kinds:
        raise banned_error()
    if "online_suspended" in kinds:
        raise ApiError(403, "ACCOUNT_SUSPENDED", "Online play is suspended for this profile")


def is_silenced(db: Session, player_id: str) -> bool:
    return bool(SILENCING_KINDS & {s.kind for s in active_sanctions(db, player_id)})
