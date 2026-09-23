"""The moderator's side: a report queue grouped by player, the player dossier, dismiss / action (with sanction),
and the appeal queue. Bounded queries only."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.Core.enforcement import active_sanctions, aware, live_condition, now
from app.Core.errors import conflict, not_found
from app.Models import Appeal, ModerationAudit, Moderator, Player, Report, ReportEvidence, Sanction, SanctionReport
from app.Services.SanctionService import appeal_view, audit, create_sanction, sanction_view
from config.settings import Settings


def page(settings: Settings, limit: int | None, offset: int | None) -> tuple[int, int]:
    return (min(max(limit or settings.moderation_page_size, 1), settings.moderation_max_page_size),
            min(max(offset or 0, 0), settings.moderation_max_offset))


def report_view(db: Session, r: Report) -> dict:
    ev = db.get(ReportEvidence, r.id)
    return {"id": r.id, "reporter_id": r.reporter_id, "subject_id": r.subject_id, "room_code": r.room_code, "match_id": r.match_id,
            "reason": r.reason, "state": r.state, "created_at": aware(r.created_at),
            "resolved_at": aware(r.resolved_at) if r.resolved_at else None, "resolution_reason": r.resolution_reason,
            "resolution_note": r.resolution_note, "evidence": ev.messages if ev else None}


def queue(db: Session, settings: Settings, state: str, limit: int | None, offset: int | None) -> dict:
    """Reports grouped by the player they are about, most recently reported first; bounded queries only."""
    size, start = page(settings, limit, offset)
    groups = db.execute(select(Report.subject_id, func.count().label("n"), func.count(func.distinct(Report.reporter_id)).label("reporters"),
                               func.min(Report.created_at).label("first"), func.max(Report.created_at).label("last"))
                        .where(Report.state == state).group_by(Report.subject_id)
                        .order_by(func.max(Report.created_at).desc()).limit(size).offset(start)).all()
    subjects = [g.subject_id for g in groups]
    reasons: dict[str, dict[str, int]] = {}
    newest: dict[str, str] = {}
    names: dict[str, str | None] = {}
    live: dict[str, dict] = {}
    if subjects:
        for subject, reason, n in db.execute(select(Report.subject_id, Report.reason, func.count()).where(Report.subject_id.in_(subjects), Report.state == state)
                                             .group_by(Report.subject_id, Report.reason)).all():
            reasons.setdefault(subject, {})[reason] = int(n)
        for r in db.scalars(select(Report).where(Report.subject_id.in_(subjects), Report.state == state).order_by(Report.created_at.desc()).limit(size * 50)):
            newest.setdefault(r.subject_id, r.id)
        names = {pid: (None if d else n) for pid, n, d in db.execute(select(Player.id, Player.display_name, Player.deleted_at).where(Player.id.in_(subjects))).all()}
        for s in db.scalars(select(Sanction).where(Sanction.subject_id.in_(subjects), live_condition())):
            live.setdefault(s.subject_id, sanction_view(s))
    return {"items": [{"subject_id": g.subject_id, "display_name": names.get(g.subject_id), "reports": int(g.n), "reporters": int(g.reporters),
                       "reasons": reasons.get(g.subject_id, {}), "first_reported_at": aware(g.first), "last_reported_at": aware(g.last),
                       "newest_report_id": newest.get(g.subject_id), "active_sanction": live.get(g.subject_id)} for g in groups],
            "limit": size, "offset": start}


def dossier(db: Session, subject_id: str) -> dict:
    p = db.get(Player, subject_id)
    if p is None:
        raise not_found("PLAYER_NOT_FOUND", "No player with that id")
    counts = db.execute(select(func.count(), func.count(func.distinct(Report.reporter_id)), func.min(Report.created_at), func.max(Report.created_at))
                        .where(Report.subject_id == subject_id)).one()
    recent = db.scalars(select(Report).where(Report.subject_id == subject_id).order_by(Report.created_at.desc()).limit(25))
    sanctions = list(db.scalars(select(Sanction).where(Sanction.subject_id == subject_id).order_by(Sanction.created_at.desc()).limit(25)))
    behind: dict[str, list[str]] = {}
    if sanctions:
        for sid, rid in db.execute(select(SanctionReport.sanction_id, SanctionReport.report_id).where(SanctionReport.sanction_id.in_([s.id for s in sanctions]))).all():
            behind.setdefault(sid, []).append(rid)
    appeals = {a.sanction_id: appeal_view(a) for a in db.scalars(select(Appeal).where(Appeal.player_id == subject_id))}
    trail = db.scalars(select(ModerationAudit).where(ModerationAudit.subject_id == subject_id).order_by(ModerationAudit.created_at.desc()).limit(50))
    return {
        "player_id": p.id, "display_name": None if p.deleted_at else p.display_name, "protected": p.protected,
        "created_at": aware(p.created_at), "deleted": p.deleted_at is not None,
        "reports": {"total": int(counts[0]), "reporters": int(counts[1]), "first_at": aware(counts[2]) if counts[2] else None, "last_at": aware(counts[3]) if counts[3] else None},
        "recent_reports": [report_view(db, r) for r in recent],
        "active_sanctions": [sanction_view(s) for s in active_sanctions(db, subject_id)],
        "sanctions": [{**sanction_view(s, behind.get(s.id)), "appeal": appeals.get(s.id)} for s in sanctions],
        "audit": [{"action": a.action, "reason": a.reason, "actor_id": a.actor_id, "report_id": a.report_id, "sanction_id": a.sanction_id,
                   "created_at": aware(a.created_at)} for a in trail],
    }


def _open_report(db: Session, report_id: str) -> Report:
    r = db.get(Report, report_id)
    if r is None:
        raise not_found("REPORT_NOT_FOUND", "No report with that id")
    if r.state != "open":
        raise conflict("REPORT_ALREADY_RESOLVED", "That report has already been resolved")
    return r


def _resolve(db: Session, r: Report, state: str, moderator: str, reason: str, note: str | None, resolve_all: bool) -> list[Report]:
    targets = [r]
    if resolve_all:
        targets += list(db.scalars(select(Report).where(Report.subject_id == r.subject_id, Report.state == "open", Report.id != r.id).limit(200)))
    at = now()
    for t in targets:
        t.state, t.resolved_at, t.resolved_by, t.resolution_reason = state, at, moderator, reason
        t.resolution_note = note if t.id == r.id else None
    return targets


def dismiss(db: Session, moderator: Moderator, report_id: str, reason: str, note: str | None, resolve_all: bool) -> dict:
    r = _open_report(db, report_id)
    _resolve(db, r, "dismissed", moderator.player_id, reason, note, resolve_all)
    audit(db, action="report_dismissed", reason=reason, actor=moderator.player_id, subject=r.subject_id, report_id=r.id)
    db.commit()
    return report_view(db, r)


def action(db: Session, settings: Settings, moderator: Moderator, report_id: str, kind: str, reason: str, days: int | None,
           note: str | None, resolve_all: bool) -> dict:
    r = _open_report(db, report_id)
    resolved = _resolve(db, r, "actioned", moderator.player_id, reason, note, resolve_all)
    s = create_sanction(db, settings, subject=r.subject_id, kind=kind, reason=reason, moderator=moderator.player_id, days=days,
                        report_ids=[x.id for x in resolved], commit=False)
    audit(db, action="report_actioned", reason=reason, actor=moderator.player_id, subject=r.subject_id, report_id=r.id, sanction_id=s.id)
    db.commit()
    return sanction_view(s, [x.id for x in resolved])


def appeals_queue(db: Session, settings: Settings, state: str | None, limit: int | None, offset: int | None) -> list[dict]:
    size, start = page(settings, limit, offset)
    stmt = select(Appeal)
    if state is not None:
        stmt = stmt.where(Appeal.state == state)
    order = Appeal.created_at.asc() if state == "open" else Appeal.created_at.desc()
    return [appeal_view(a) for a in db.scalars(stmt.order_by(order).limit(size).offset(start))]
