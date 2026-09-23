"""Optional account linking, the only way to get a profile back on a new phone. Never merges two profiles (v1)."""
import logging

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.Core.enforcement import aware, banned_error, is_banned
from app.Core.errors import conflict, not_found
from app.Models import Player, PlayerIdentity, now
from app.Services.IdentityVerifier import get_verifier
from app.Services.PlayerService import token_for
from config.settings import Settings

logger = logging.getLogger("tashzone")


def linked_providers(db: Session, p: Player) -> list[str]:
    return sorted(db.scalars(select(PlayerIdentity.provider).where(PlayerIdentity.player_id == p.id)))


def link(db: Session, p: Player, provider: str, id_token: str, nonce: str | None) -> dict:
    """Idempotent. Never merges two profiles: an account already on another profile is refused."""
    v = get_verifier(provider).verify(id_token, nonce)
    existing = db.get(PlayerIdentity, (v.provider, v.subject))
    if existing is not None:
        if existing.player_id != p.id:
            raise conflict("IDENTITY_ALREADY_LINKED", "That sign-in already belongs to another TashZone profile")
        existing.last_used_at = now()
        db.commit()
        return {"provider": existing.provider, "linked_at": aware(existing.created_at)}
    if db.scalar(select(PlayerIdentity.subject).where(PlayerIdentity.player_id == p.id, PlayerIdentity.provider == v.provider)):
        raise conflict("PROVIDER_ALREADY_LINKED", "A different account is already linked for that sign-in")
    row = PlayerIdentity(provider=v.provider, subject=v.subject, player_id=p.id)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise conflict("IDENTITY_ALREADY_LINKED", "That sign-in already belongs to another TashZone profile") from exc
    logger.info("identity_linked", extra={"player_id": p.id, "provider": v.provider})
    return {"provider": row.provider, "linked_at": aware(row.created_at)}


def unlink(db: Session, p: Player, provider: str) -> None:
    db.execute(delete(PlayerIdentity).where(PlayerIdentity.player_id == p.id, PlayerIdentity.provider == provider))
    db.commit()


def restore(db: Session, settings: Settings, provider: str, id_token: str, nonce: str | None) -> tuple[Player, str]:
    v = get_verifier(provider).verify(id_token, nonce)
    ident = db.get(PlayerIdentity, (v.provider, v.subject))
    p = db.get(Player, ident.player_id) if ident is not None else None
    if ident is None or p is None or p.deleted_at is not None:
        raise not_found("IDENTITY_NOT_LINKED", "No TashZone profile is linked to that sign-in")
    if is_banned(db, p.id):
        raise banned_error()
    ident.last_used_at = now()
    p.last_seen_at = now()
    db.commit()
    logger.info("player_restored", extra={"player_id": p.id, "provider": v.provider})
    return p, token_for(settings, p)
