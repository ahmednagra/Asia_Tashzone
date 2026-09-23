"""Quick Match tickets."""
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class MatchmakingTicket(Base):
    """Quick Match: one row per player (so a player can never be seated at two tables), first come, bots backfill."""
    __tablename__ = "matchmaking_tickets"
    __table_args__ = (
        CheckConstraint(one_of("state", TICKET_STATES), name="ck_tickets_state"),
        CheckConstraint("seats BETWEEN 3 AND 8", name="ck_tickets_seats"),
        CheckConstraint("(state = 'matched' AND room_code IS NOT NULL) OR (state <> 'matched' AND room_code IS NULL)", name="ck_tickets_room_code"),
        Index("ix_tickets_queue", "state", "profile_id", "seats", "created_at"),
        Index("ix_tickets_state_expires", "state", "expires_at"),
    )
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    profile_id: Mapped[str] = mapped_column(String(40))
    seats: Mapped[int] = mapped_column(SmallInteger)
    state: Mapped[str] = mapped_column(String(10), default="waiting", server_default="waiting")
    room_code: Mapped[str | None] = mapped_column(String(6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(TS)
