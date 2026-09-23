"""Optional provider accounts linked for recovery (provider + opaque subject only)."""
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class PlayerIdentity(Base):
    """A provider account a player chose to attach for recovery. Provider + opaque subject only: no email, no name."""
    __tablename__ = "player_identities"
    __table_args__ = (
        CheckConstraint(one_of("provider", IDENTITY_PROVIDERS), name="ck_player_identities_provider"),
        CheckConstraint("length(subject) > 0", name="ck_player_identities_subject"),
        UniqueConstraint("player_id", "provider", name="uq_player_identities_player_id_provider"),
    )
    provider: Mapped[str] = mapped_column(String(16), primary_key=True)
    subject: Mapped[str] = mapped_column(String(255), primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    last_used_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
