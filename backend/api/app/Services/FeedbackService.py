"""In-app feedback: category, optional bounded match record, and a short text for adults only (v1)."""
import json
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.Core.enforcement import now
from app.Core.errors import ApiError
from app.Models import Feedback, Player
from app.Services.AppConfigService import require_feature
from config.settings import Settings

MAX_RECORD_BYTES = 64 * 1024


def create(db: Session, settings: Settings, p: Player, category: str, profile_id: str | None, match_id: str | None,
           text: str | None, record: dict | None, app_version: str | None) -> Feedback:
    require_feature(settings, "feedback")
    text = (text or "").strip() or None
    if text is not None and p.protected:
        raise ApiError(422, "FREE_TEXT_NOT_ALLOWED", "Written messages are not available in Protected Mode")
    if record is not None and len(json.dumps(record, separators=(",", ":"))) > MAX_RECORD_BYTES:
        raise ApiError(422, "RECORD_TOO_LARGE", "The match record is too large")
    f = Feedback(player_id=p.id, category=category, profile_id=profile_id, match_id=match_id, text=text, record=record, app_version=app_version)
    db.add(f)
    db.commit()
    return f


def purge_old(db: Session, settings: Settings, at: datetime | None = None, batch: int = 500) -> int:
    cutoff = (at or now()) - timedelta(days=settings.feedback_retention_days)
    ids = list(db.scalars(select(Feedback.id).where(Feedback.created_at <= cutoff).limit(batch)))
    if ids:
        db.execute(delete(Feedback).where(Feedback.id.in_(ids)).execution_options(synchronize_session=False))
        db.commit()
    return len(ids)
