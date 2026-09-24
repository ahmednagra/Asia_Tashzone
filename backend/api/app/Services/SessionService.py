from datetime import timedelta

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.Core.device import device_name
from app.Core.enforcement import aware
from app.Core.errors import not_found
from app.Core.security import sign_player_token
from app.Models import Player, PlayerSession, now
from config.settings import Settings

REVOKED_RETENTION_DAYS = 30


def issue(db: Session, settings: Settings, p: Player) -> str:
    s = PlayerSession(player_id=p.id, device_name=device_name())
    db.add(s)
    db.commit()
    return sign_player_token(settings.player_token_secret, p.id, p.token_generation, settings.player_token_days, s.id)


def revoke(db: Session, session_id: str | None) -> None:
    if session_id is None:
        return
    db.execute(update(PlayerSession).where(PlayerSession.id == session_id, PlayerSession.revoked_at.is_(None)).values(revoked_at=now()))
    db.commit()


def revoke_all(db: Session, p: Player) -> None:
    p.token_generation += 1
    db.execute(update(PlayerSession).where(PlayerSession.player_id == p.id, PlayerSession.revoked_at.is_(None)).values(revoked_at=now()))
    db.commit()


MAX_LISTED = 50


def active(db: Session, settings: Settings, p: Player, current: str | None) -> list[dict]:
    fresh_after = now() - timedelta(days=settings.player_token_days)
    rows = db.scalars(
        select(PlayerSession)
        .where(PlayerSession.player_id == p.id, PlayerSession.revoked_at.is_(None), PlayerSession.created_at > fresh_after)
        .order_by(PlayerSession.last_seen_at.desc())
        .limit(MAX_LISTED)
    ).all()
    return [{"id": s.id, "device_name": s.device_name, "created_at": aware(s.created_at), "last_seen_at": aware(s.last_seen_at),
             "current": s.id == current} for s in rows]


def revoke_own(db: Session, p: Player, session_id: str) -> None:
    s = db.get(PlayerSession, session_id)
    if s is None or s.player_id != p.id or s.revoked_at is not None:
        raise not_found("SESSION_NOT_FOUND", "That device is already signed out")
    s.revoked_at = now()
    db.commit()


def purge(db: Session, settings: Settings) -> int:
    revoked_cutoff = now() - timedelta(days=REVOKED_RETENTION_DAYS)
    idle_cutoff = now() - timedelta(days=settings.player_token_days)
    ids = db.scalars(
        select(PlayerSession.id)
        .where(or_(PlayerSession.revoked_at < revoked_cutoff, PlayerSession.created_at < idle_cutoff))
        .limit(500)
    ).all()
    if ids:
        db.execute(delete(PlayerSession).where(PlayerSession.id.in_(ids)))
        db.commit()
    return len(ids)
