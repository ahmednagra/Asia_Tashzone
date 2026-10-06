"""Enum-like text values the schema constrains (CHECK constraints, never database enum types) and shared column
helpers. A CHECK is one ALTER away from a new value; a PostgreSQL enum type is awkward to change."""
import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime


def now() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid.uuid4())


def one_of(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({','.join(repr(v) for v in sorted(values))})"


ROOM_STATUSES = ("expired", "finished", "open", "playing")
ROOM_ORIGINS = ("code", "quick_match")
TICKET_STATES = ("cancelled", "expired", "matched", "waiting")
FEEDBACK_CATEGORIES = ("bug", "idea", "other", "rules")
REPORT_REASONS = ("cheating", "other", "rude")
REPORT_STATES = ("actioned", "dismissed", "open")
RESOLUTION_REASONS = ("abuse", "cheating", "duplicate", "no_evidence", "not_a_violation", "repeat_offender", "retaliatory", "spam")
SANCTION_KINDS = ("banned", "chat_muted", "online_suspended", "warning")
SANCTION_RANK = {"warning": 0, "chat_muted": 1, "online_suspended": 2, "banned": 3}
APPEAL_STATES = ("granted", "open", "rejected")
AUDIT_ACTIONS = ("appeal_decided", "moderator_granted", "moderator_revoked", "report_actioned", "report_dismissed", "sanction_created", "sanction_revoked")
MODERATOR_ROLES = ("admin", "moderator")
IDENTITY_PROVIDERS = ("apple", "google", "play_games")
AUTH_CODE_PURPOSES = ("login", "reset", "signup")
SEAT_KINDS = ("bot", "human")

TS = DateTime(timezone=True)
