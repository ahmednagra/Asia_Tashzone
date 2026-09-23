"""Match results, per-seat outcomes and online stats."""
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class Match(Base):
    __tablename__ = "matches"
    match_id: Mapped[str] = mapped_column(String(80), primary_key=True)  # results accepted once (C-27)
    room_code: Mapped[str] = mapped_column(String(6), index=True)
    epoch: Mapped[int] = mapped_column(BigInteger)
    profile_id: Mapped[str] = mapped_column(String(40))
    effective_profile_hash: Mapped[str] = mapped_column(String(64))
    engine_build_hash: Mapped[str] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(16))
    totals: Mapped[list] = mapped_column(JSON)
    placements: Mapped[list | None] = mapped_column(JSON, nullable=True)
    players: Mapped[list] = mapped_column(JSON)
    bot_seats: Mapped[list] = mapped_column(JSON)
    sealed_hand_ids: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())


class MatchPlayer(Base):
    """One seat's outcome, for match history. (match_id, seat) keeps retries from double counting."""
    __tablename__ = "match_players"
    __table_args__ = (
        CheckConstraint(one_of("kind", SEAT_KINDS), name="ck_match_players_kind"),
        CheckConstraint("(kind = 'bot' AND player_id IS NULL) OR (kind = 'human' AND player_id IS NOT NULL)", name="ck_match_players_kind_player"),
        Index("ix_match_players_player_created", "player_id", "created_at"),
    )
    match_id: Mapped[str] = mapped_column(ForeignKey("matches.match_id", ondelete="CASCADE"), primary_key=True)
    seat: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    player_id: Mapped[str | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    placement: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())


class PlayerStat(Base):
    """Online stats per player and profile, from match-server results only."""
    __tablename__ = "player_stats"
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    profile_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    played: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    interrupted: Mapped[int] = mapped_column(Integer, default=0)
