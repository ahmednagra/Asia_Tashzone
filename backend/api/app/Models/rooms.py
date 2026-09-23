"""Online rooms, seats and kicks."""
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class Room(Base):
    """An online room. `origin` never changes: typed chat and voice exist only in a `code` room."""
    __tablename__ = "rooms"
    __table_args__ = (
        CheckConstraint(one_of("status", ROOM_STATUSES), name="ck_rooms_status"),
        CheckConstraint(one_of("origin", ROOM_ORIGINS), name="ck_rooms_origin"),
        CheckConstraint("seats BETWEEN 3 AND 8", name="ck_rooms_seats"),
        Index("ix_rooms_status_expires_at", "status", "expires_at"),
        Index("ix_rooms_status_changed", "status", "status_changed_at"),
    )
    code: Mapped[str] = mapped_column(String(6), primary_key=True)
    host_player_id: Mapped[str] = mapped_column(ForeignKey("players.id"))
    profile_id: Mapped[str] = mapped_column(String(40))
    preset: Mapped[str] = mapped_column(String(40), default="standard")
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    profile_hash: Mapped[str] = mapped_column(String(64))
    seats: Mapped[int] = mapped_column(SmallInteger, default=4, server_default=text("4"))
    origin: Mapped[str] = mapped_column(String(12), default="code", server_default="code")
    status: Mapped[str] = mapped_column(String(10), default="open", server_default="open")
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    status_changed_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())


class RoomSeat(Base):
    __tablename__ = "room_seats"
    __table_args__ = (UniqueConstraint("room_code", "player_id"), CheckConstraint("seat BETWEEN 0 AND 7", name="ck_room_seats_seat"))
    room_code: Mapped[str] = mapped_column(ForeignKey("rooms.code", ondelete="CASCADE"), primary_key=True)
    seat: Mapped[int] = mapped_column(Integer, primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id"))
    joined_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())


class RoomKick(Base):
    """A player the host removed: they get the same "no room" answer as a stranger if they try the code again."""
    __tablename__ = "room_kicks"
    room_code: Mapped[str] = mapped_column(ForeignKey("rooms.code", ondelete="CASCADE"), primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    kicked_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
