"""What players do to each other: report and block. No message text."""
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class Block(Base):
    """Symmetric in effect: neither side can sit at a table with the other, whoever pressed the button."""
    __tablename__ = "blocks"
    __table_args__ = (CheckConstraint("player_id <> blocked_id", name="ck_blocks_not_self"), Index("ix_blocks_blocked_id", "blocked_id"))
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    blocked_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())


class Report(Base):
    """A player reporting another. No message content, ever. Resolution columns are the only thing that changes."""
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint(one_of("reason", REPORT_REASONS), name="ck_reports_reason"),
        CheckConstraint("reporter_id <> subject_id", name="ck_reports_not_self"),
        CheckConstraint(one_of("state", REPORT_STATES), name="ck_reports_state"),
        CheckConstraint("(state = 'open' AND resolved_at IS NULL AND resolution_reason IS NULL) "
                        "OR (state <> 'open' AND resolved_at IS NOT NULL AND resolution_reason IS NOT NULL)", name="ck_reports_resolution"),
        Index("ix_reports_subject_state", "subject_id", "state"),
        Index("ix_reports_state_created_at", "state", "created_at"),
        Index("ix_reports_reporter_id", "reporter_id"),
        Index("ix_reports_created_at", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    reporter_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    subject_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    room_code: Mapped[str] = mapped_column(String(6))
    match_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reason: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    state: Mapped[str] = mapped_column(String(10), default="open", server_default="open")
    resolved_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    resolution_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
