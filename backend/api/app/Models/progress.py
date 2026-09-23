"""The phone's whole-app progress, synced as a convenience copy (never an authority)."""
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    Integer,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class PlayerProgress(Base):
    """The phone's whole-app progress (offline included). A convenience sync, never an authority."""
    __tablename__ = "player_progress"
    __table_args__ = (
        CheckConstraint("xp >= 0 AND matches >= 0 AND wins >= 0 AND hands_played >= 0 AND first_out >= 0 "
                        "AND times_bhabhi >= 0 AND best_streak >= 0", name="ck_player_progress_non_negative"),
        CheckConstraint("wins <= matches", name="ck_player_progress_wins"),
        CheckConstraint("best_streak <= wins", name="ck_player_progress_best_streak"),
    )
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    xp: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    matches: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    wins: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    hands_played: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    first_out: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    times_bhabhi: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    best_streak: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
    badges: Mapped[list] = mapped_column(JSON, default=list)
    games: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
