"""Writing enforcement down: sanctions, appeals, moderators and the append-only audit trail. Every change writes one
audit row in the same transaction. Notes, appeal messages and anything a player typed never reach a log line."""
import logging
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.Core.enforcement import active_sanction, aware, live_condition, now
from app.Core.errors import conflict, not_found, unprocessable
from app.Models import Appeal, ModerationAudit, Moderator, Player, Sanction, SanctionReport
from config.settings import Settings

logger = logging.getLogger("tashzone")


def audit(db: Session, *, action: str, reason: str, actor: str | None, subject: str | None = None,
          report_id: str | None = None, sanction_id: str | None = None) -> None:
    """Added to the caller's session and committed with the change it describes (atomic). Never updated/deleted."""
    db.add(ModerationAudit(actor_id=actor, action=action, subject_id=subject, report_id=report_id, sanction_id=sanction_id, reason=reason, created_at=now()))
    logger.info("moderation_action", extra={"action": action, "reason": reason, "actor_id": actor, "subject_id": subject})


def _expiry(settings: Settings, kind: str, days: int | None, at: datetime) -> datetime | None:
    if days is None:
        return None if kind == "banned" else at + timedelta(days=settings.sanction_default_days)
    if days <= 0 or days > settings.sanction_max_days:
        raise unprocessable("INVALID_DURATION", "That sanction length is out of range")
    return at + timedelta(days=days)


def create_sanction(db: Session, settings: Settings, *, subject: str, kind: str, reason: str, moderator: str | None,
                    days: int | None = None, report_ids: list[str] | None = None, commit: bool = True) -> Sanction:
    """Sanctions stack; enforcement reads the most severe live one."""
    if db.get(Player, subject) is None:
        raise not_found("PLAYER_NOT_FOUND", "No player with that id")
    at = now()
    s = Sanction(subject_id=subject, kind=kind, reason=reason, moderator_id=moderator, created_at=at, expires_at=_expiry(settings, kind, days, at))
    db.add(s)
    db.flush()
    for rid in report_ids or []:
        db.add(SanctionReport(sanction_id=s.id, report_id=rid))
    audit(db, action="sanction_created", reason=reason, actor=moderator, subject=subject, report_id=(report_ids or [None])[0], sanction_id=s.id)
    if commit:
        db.commit()
    return s


def revoke_sanction(db: Session, s: Sanction, *, moderator: str | None, reason: str, commit: bool = True) -> Sanction:
    if s.revoked_at is None:
        s.revoked_at = now()
        audit(db, action="sanction_revoked", reason=reason, actor=moderator, subject=s.subject_id, sanction_id=s.id)
    if commit:
        db.commit()
    return s


def sanction_view(s: Sanction, report_ids: list[str] | None = None) -> dict:
    live = s.revoked_at is None and (s.expires_at is None or aware(s.expires_at) > now())
    return {"id": s.id, "subject_id": s.subject_id, "kind": s.kind, "reason": s.reason, "created_at": aware(s.created_at),
            "expires_at": aware(s.expires_at) if s.expires_at else None, "revoked_at": aware(s.revoked_at) if s.revoked_at else None,
            "active": live, "report_ids": report_ids or []}


def appeal_view(a: Appeal) -> dict:
    return {"sanction_id": a.sanction_id, "player_id": a.player_id, "message": a.message, "state": a.state,
            "created_at": aware(a.created_at), "decided_at": aware(a.decided_at) if a.decided_at else None, "decision_note": a.decision_note}


def my_sanction(db: Session, p: Player) -> dict:
    cur = active_sanction(db, p.id)
    if cur is None:
        return {"kind": None, "reason": None, "expires_at": None, "can_appeal": False, "appeal": None, "sanction_id": None}
    a = db.get(Appeal, cur.id)
    return {"kind": cur.kind, "reason": cur.reason, "expires_at": aware(cur.expires_at) if cur.expires_at else None,
            "can_appeal": a is None, "appeal": appeal_view(a) if a else None, "sanction_id": cur.id}


def create_appeal(db: Session, p: Player, sanction_id: str | None, message: str) -> Appeal:
    s = active_sanction(db, p.id) if sanction_id is None else db.get(Sanction, sanction_id)
    if s is None or s.subject_id != p.id:
        raise not_found("NO_SANCTION", "You are not under any sanction")
    if s.revoked_at is not None or (s.expires_at is not None and aware(s.expires_at) <= now()):
        raise conflict("SANCTION_NOT_ACTIVE", "That sanction is no longer in force")
    a = Appeal(sanction_id=s.id, player_id=p.id, message=message, state="open", created_at=now())
    db.add(a)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise conflict("APPEAL_ALREADY_SUBMITTED", "You have already appealed this sanction") from exc
    return a


def decide_appeal(db: Session, moderator: str, sanction_id: str, granted: bool, note: str | None) -> Appeal:
    a = db.get(Appeal, sanction_id)
    if a is None:
        raise not_found("APPEAL_NOT_FOUND", "No appeal with that id")
    if a.state != "open":
        raise conflict("APPEAL_ALREADY_DECIDED", "That appeal has already been answered")
    s = db.get(Sanction, a.sanction_id)
    a.state = "granted" if granted else "rejected"
    a.decided_at = now()
    a.decided_by = moderator
    a.decision_note = note
    if granted and s is not None:
        revoke_sanction(db, s, moderator=moderator, reason="granted", commit=False)
    audit(db, action="appeal_decided", reason=a.state, actor=moderator, subject=a.player_id, sanction_id=a.sanction_id)
    db.commit()
    return a


def grant_moderator(db: Session, subject: str, role: str, by: str | None) -> Moderator:
    if db.get(Player, subject) is None:
        raise not_found("PLAYER_NOT_FOUND", "No player with that id")
    m = db.get(Moderator, subject)
    if m is None:
        m = Moderator(player_id=subject, role=role, granted_by=by)
        db.add(m)
    else:
        m.role, m.revoked_at, m.granted_by, m.granted_at = role, None, by, now()
    audit(db, action="moderator_granted", reason=role, actor=by, subject=subject)
    db.commit()
    return m


def revoke_moderator(db: Session, subject: str, by: str | None) -> None:
    m = db.get(Moderator, subject)
    if m is not None and m.revoked_at is None:
        m.revoked_at = now()
        audit(db, action="moderator_revoked", reason=m.role, actor=by, subject=subject)
        db.commit()


def purge_sanctions(db: Session, settings: Settings, at: datetime | None = None, batch: int = 500) -> int:
    """Not what ends a sanction (live_condition did that); only deletes rows long past mattering. Audit rows stay."""
    cutoff = (at or now()) - timedelta(days=settings.sanction_retention_days)
    ids = list(db.scalars(select(Sanction.id).where(~live_condition(), func.coalesce(Sanction.revoked_at, Sanction.expires_at) <= cutoff).limit(batch)))
    if not ids:
        return 0
    ns = {"synchronize_session": False}
    db.execute(delete(Appeal).where(Appeal.sanction_id.in_(ids)).execution_options(**ns))
    db.execute(delete(SanctionReport).where(SanctionReport.sanction_id.in_(ids)).execution_options(**ns))
    db.execute(update(ModerationAudit).where(ModerationAudit.sanction_id.in_(ids)).values(sanction_id=None).execution_options(**ns))
    db.execute(delete(Sanction).where(Sanction.id.in_(ids)).execution_options(**ns))
    db.commit()
    return len(ids)
