"""Match-server owned rows (role tz_match): room directory lease, sealed hands, the input journal."""
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class RoomDirectory(Base):
    __tablename__ = "room_directory"
    room_code: Mapped[str] = mapped_column(String(6), primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(64))
    instance_url: Mapped[str] = mapped_column(String(255))
    epoch: Mapped[int] = mapped_column(BigInteger)
    lease_until: Mapped[datetime] = mapped_column(TS)
    heartbeat_at: Mapped[datetime] = mapped_column(TS)


class Hand(Base):
    __tablename__ = "hands"
    hand_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    room_code: Mapped[str] = mapped_column(String(6), index=True)
    epoch: Mapped[int] = mapped_column(BigInteger)
    commitment: Mapped[str] = mapped_column(String(64))
    encrypted_seed: Mapped[str | None] = mapped_column(Text, nullable=True)  # removed at seal (T-18)
    server_seed: Mapped[str | None] = mapped_column(String(64), nullable=True)  # revealed at seal
    client_seeds: Mapped[list | None] = mapped_column(JSON, nullable=True)
    substituted: Mapped[list | None] = mapped_column(JSON, nullable=True)
    chain_root: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    match_state_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)
    randomness_version: Mapped[str] = mapped_column(String(16), default="tz-rng-v1", server_default=text("'tz-rng-v1'"))
    sealed_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())


class InputRecordRow(Base):
    __tablename__ = "input_records"
    hand_id: Mapped[str] = mapped_column(ForeignKey("hands.hand_id", ondelete="CASCADE"), primary_key=True)
    server_seq: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    epoch: Mapped[int] = mapped_column(BigInteger)
    intent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    actor: Mapped[str] = mapped_column(String(8))
    origin: Mapped[str] = mapped_column(String(10))
    action: Mapped[dict] = mapped_column(JSON)
    prev_hash: Mapped[str] = mapped_column(String(64))
    state_hash: Mapped[str] = mapped_column(String(64))
    __table_args__ = (UniqueConstraint("hand_id", "actor", "intent_id", name="uq_input_intent"),)
