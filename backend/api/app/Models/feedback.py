"""In-app feedback."""
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class Feedback(Base):
    """In-app feedback: an optional bounded match record and, for adults only, a short text."""
    __tablename__ = "feedback"
    __table_args__ = (CheckConstraint(one_of("category", FEEDBACK_CATEGORIES), name="ck_feedback_category"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(10))
    profile_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    match_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    record: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now(), index=True)
