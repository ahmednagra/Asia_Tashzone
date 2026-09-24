from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, SmallInteger, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class PlayerAccount(Base):
    __tablename__ = "player_accounts"
    __table_args__ = (
        CheckConstraint("email = lower(email)", name="ck_player_accounts_email_lower"),
        CheckConstraint("length(email) BETWEEN 3 AND 254", name="ck_player_accounts_email_length"),
    )
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verified_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    password_changed_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)


class AuthCode(Base):
    __tablename__ = "auth_codes"
    __table_args__ = (
        CheckConstraint(one_of("purpose", AUTH_CODE_PURPOSES), name="ck_auth_codes_purpose"),
        CheckConstraint("attempts >= 0", name="ck_auth_codes_attempts"),
        Index("ix_auth_codes_email_purpose_created", "email", "purpose", "created_at"),
        Index("ix_auth_codes_expires_at", "expires_at"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    purpose: Mapped[str] = mapped_column(String(10))
    email: Mapped[str] = mapped_column(String(254))
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(TS)
    used_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
