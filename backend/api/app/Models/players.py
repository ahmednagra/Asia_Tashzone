"""Players and Parent Settings."""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    func,
    text,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class Player(Base):
    """An anonymous player (no account, no personal data). Soft-deleted on a data-deletion request."""
    __tablename__ = "players"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    display_name: Mapped[str] = mapped_column(String(40))
    avatar_id: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"))
    # Protected Mode: decided once at registration from the age answer, which is never stored. True for under 18
    # or unknown age; nothing in the API can turn it off for an existing player.
    protected: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    token_generation: Mapped[int] = mapped_column(Integer, default=1)  # bump = revoke all tokens (C-17)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)


class ParentalSettings(Base):
    """Parent Settings synced from the device; enforced by the server for protected players only."""
    __tablename__ = "parental_settings"
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    online_play: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    same_wifi: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    quick_messages: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    reactions: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    # Owner decision (17 Sep 2026): typed chat and voice are open to all ages, moderated rather than age-gated;
    # both default on and a parent can switch either off.
    free_text_chat: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    voice: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    pin_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now(), onupdate=now)
