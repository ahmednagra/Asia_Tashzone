"""Reports and blocks: the moderation half of open chat and voice. Nothing here reads, stores or logs message content
(except off-by-default report evidence)."""
from datetime import datetime, timedelta

from sqlalchemy import and_, delete, exists, func, or_, select, update
from sqlalchemy.orm import Session

from app.Core.enforcement import aware, now
from app.Core.errors import ApiError, conflict, forbidden, not_found, unprocessable
from app.Models import Block, ModerationAudit, Player, Report, ReportEvidence, Room, RoomSeat, SanctionReport
from config.settings import Settings


def blocked_pair_exists(db: Session, player_id: str, others: list[str]) -> bool:
    if not others:
        return False
    cond = or_(and_(Block.player_id == player_id, Block.blocked_id.in_(others)),
               and_(Block.blocked_id == player_id, Block.player_id.in_(others)))
    return bool(db.scalar(select(exists().where(cond))))


def blocked_error() -> ApiError:
    return forbidden("BLOCKED", "You and someone in that room have blocked each other")


def _room_not_found() -> ApiError:
    return not_found("ROOM_NOT_FOUND", "No room with that code")


def member_view(db: Session, p: Player, code: str) -> tuple[Room, dict[int, str]]:
    """The room and its seat → player map, for a caller sitting in it; strangers get ROOM_NOT_FOUND."""
    room = db.get(Room, code.strip().upper())
    if room is None:
        raise _room_not_found()
    members = {s.seat: s.player_id for s in db.scalars(select(RoomSeat).where(RoomSeat.room_code == room.code))}
    if p.id not in members.values():
        raise _room_not_found()
    return room, members


def list_blocks(db: Session, settings: Settings, p: Player) -> list[dict]:
    rows = db.execute(select(Block.blocked_id, Block.created_at, Player.display_name, Player.deleted_at)
                      .join(Player, Player.id == Block.blocked_id).where(Block.player_id == p.id)
                      .order_by(Block.created_at.desc()).limit(settings.max_blocks_per_player)).all()
    return [{"player_id": r.blocked_id, "display_name": None if r.deleted_at else r.display_name, "created_at": aware(r.created_at)} for r in rows]


def resolve_target(db: Session, p: Player, player_id: str | None, room_code: str | None, seat: int | None) -> str:
    if player_id is not None:
        return player_id
    if room_code is None or seat is None:
        raise unprocessable("INVALID_REQUEST", "Give either player_id or room_code with seat")
    room, members = member_view(db, p, room_code)
    target = members.get(seat)
    if target is not None:
        return target
    if seat < room.seats and room.status in ("playing", "finished"):
        raise unprocessable("CANNOT_BLOCK_BOT", "That seat is played by a bot, not a person")
    raise unprocessable("SEAT_EMPTY", "Nobody is sitting in that seat")


def add_block(db: Session, settings: Settings, p: Player, target_id: str) -> None:
    if target_id == p.id:
        raise unprocessable("CANNOT_BLOCK_SELF", "You cannot block yourself")
    if db.get(Player, target_id) is None:
        raise not_found("PLAYER_NOT_FOUND", "No player with that id")
    if db.get(Block, (p.id, target_id)) is not None:
        return
    count = db.scalar(select(func.count()).select_from(Block).where(Block.player_id == p.id)) or 0
    if count >= settings.max_blocks_per_player:
        raise conflict("BLOCK_LIMIT_REACHED", "Your block list is full; remove someone first")
    db.add(Block(player_id=p.id, blocked_id=target_id))
    db.commit()


def remove_block(db: Session, p: Player, target_id: str) -> None:
    db.execute(delete(Block).where(Block.player_id == p.id, Block.blocked_id == target_id))
    db.commit()


def _store_report(db: Session, settings: Settings, reporter: str, subject: str, room_code: str, reason: str,
                  match_id: str | None, evidence: list[dict] | None) -> Report:
    if evidence and not settings.report_evidence_enabled:
        raise unprocessable("EVIDENCE_DISABLED", "Report evidence is not collected")
    if evidence:
        if len(evidence) > settings.report_evidence_max_messages or any(len(m.get("text", "")) > settings.report_evidence_max_chars for m in evidence):
            raise unprocessable("EVIDENCE_TOO_LARGE", "Too much evidence")
    r = Report(reporter_id=reporter, subject_id=subject, room_code=room_code, reason=reason, match_id=match_id, state="open")
    db.add(r)
    db.flush()
    if evidence:
        db.add(ReportEvidence(report_id=r.id, messages=[{"text": m.get("text", ""), "at": m.get("at")} for m in evidence]))
    db.commit()
    return r


def report_from_app(db: Session, settings: Settings, p: Player, room_code: str, seat: int | None, player_id: str | None,
                    reason: str, match_id: str | None, evidence: list[dict] | None) -> Report:
    code = room_code.strip().upper()
    _, members = member_view(db, p, code)
    subject = members.get(seat) if seat is not None else player_id
    if subject is None or subject not in members.values():
        raise not_found("PLAYER_NOT_FOUND", "That player is not in the room")
    if subject == p.id:
        raise unprocessable("INVALID_REPORT", "You cannot report yourself")
    return _store_report(db, settings, p.id, subject, code, reason, match_id, evidence)


def report_from_server(db: Session, settings: Settings, room: str, reporter: str, subject: str, reason: str, match_id: str | None) -> Report:
    code = room.upper()
    if reporter == subject:
        raise unprocessable("INVALID_REPORT", "A player cannot report themselves")
    if db.get(Room, code) is None:
        raise _room_not_found()
    seated = set(db.scalars(select(RoomSeat.player_id).where(RoomSeat.room_code == code, RoomSeat.player_id.in_([reporter, subject]))))
    if {reporter, subject} - seated:
        raise unprocessable("INVALID_REPORT", "Both players must be members of that room")
    return _store_report(db, settings, reporter, subject, code, reason, match_id, None)


def purge_reports(db: Session, settings: Settings, at: datetime | None = None, batch: int = 500) -> int:
    cutoff = (at or now()) - timedelta(days=settings.report_retention_days)
    ids = list(db.scalars(select(Report.id).where(Report.created_at <= cutoff).limit(batch)))
    if not ids:
        return 0
    ns = {"synchronize_session": False}
    db.execute(delete(ReportEvidence).where(ReportEvidence.report_id.in_(ids)).execution_options(**ns))
    db.execute(delete(SanctionReport).where(SanctionReport.report_id.in_(ids)).execution_options(**ns))
    db.execute(update(ModerationAudit).where(ModerationAudit.report_id.in_(ids)).values(report_id=None).execution_options(**ns))
    db.execute(delete(Report).where(Report.id.in_(ids)).execution_options(**ns))
    db.commit()
    return len(ids)


def purge_evidence(db: Session, settings: Settings, at: datetime | None = None, batch: int = 500) -> int:
    cutoff = (at or now()) - timedelta(days=settings.report_evidence_retention_days)
    ids = list(db.scalars(select(ReportEvidence.report_id).where(ReportEvidence.created_at <= cutoff).limit(batch)))
    if ids:
        db.execute(delete(ReportEvidence).where(ReportEvidence.report_id.in_(ids)).execution_options(synchronize_session=False))
        db.commit()
    return len(ids)
