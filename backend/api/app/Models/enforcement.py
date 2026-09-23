"""What moderators do about it: moderators, sanctions, appeals, the append-only audit, off-by-default evidence."""
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.Models.enums import *  # noqa: F403  (constants, TS, now, new_id, one_of)
from config.database import Base


class ReportEvidence(Base):
    """OFF by default (REPORT_EVIDENCE_ENABLED). The reporter's own recent messages only; enabling it changes the
    Play Data Safety answers, the privacy policy and the in-app disclosure first."""
    __tablename__ = "report_evidence"
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True)
    messages: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now(), index=True)


class Moderator(Base):
    """Who may use /moderation. Appointed only with `python -m scripts.grant_moderator` on the server."""
    __tablename__ = "moderators"
    __table_args__ = (CheckConstraint(one_of("role", MODERATOR_ROLES), name="ck_moderators_role"),)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), default="moderator", server_default="moderator")
    granted_by: Mapped[str | None] = mapped_column(ForeignKey("players.id", ondelete="SET NULL"), nullable=True)
    granted_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)


class Sanction(Base):
    """One row per decision. Expiry is a read-time rule (expires_at <= now stops it applying); revoke is the only update."""
    __tablename__ = "sanctions"
    __table_args__ = (
        CheckConstraint(one_of("kind", SANCTION_KINDS), name="ck_sanctions_kind"),
        CheckConstraint(one_of("reason", RESOLUTION_REASONS), name="ck_sanctions_reason"),
        CheckConstraint("expires_at IS NULL OR expires_at > created_at", name="ck_sanctions_expires_at"),
        Index("ix_sanctions_subject_expires", "subject_id", "expires_at"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    subject_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str] = mapped_column(String(20))
    moderator_id: Mapped[str | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)


class SanctionReport(Base):
    __tablename__ = "sanction_reports"
    sanction_id: Mapped[str] = mapped_column(ForeignKey("sanctions.id", ondelete="CASCADE"), primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), primary_key=True, index=True)


class Appeal(Base):
    """One appeal per sanction (the key is the sanction id, so a second attempt fails on the key)."""
    __tablename__ = "appeals"
    __table_args__ = (
        CheckConstraint(one_of("state", APPEAL_STATES), name="ck_appeals_state"),
        CheckConstraint("length(message) > 0", name="ck_appeals_message"),
        Index("ix_appeals_state_created_at", "state", "created_at"),
    )
    sanction_id: Mapped[str] = mapped_column(ForeignKey("sanctions.id", ondelete="CASCADE"), primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(String(500))
    state: Mapped[str] = mapped_column(String(10), default="open", server_default="open")
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(TS, nullable=True)
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ModerationAudit(Base):
    """Append-only record that a human acted. Never updated or deleted by the application or the worker."""
    __tablename__ = "moderation_audit"
    __table_args__ = (
        CheckConstraint(one_of("action", AUDIT_ACTIONS), name="ck_moderation_audit_action"),
        Index("ix_moderation_audit_subject_created", "subject_id", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(24))
    subject_id: Mapped[str | None] = mapped_column(ForeignKey("players.id"), nullable=True)
    report_id: Mapped[str | None] = mapped_column(ForeignKey("reports.id", ondelete="SET NULL"), nullable=True)
    sanction_id: Mapped[str | None] = mapped_column(ForeignKey("sanctions.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(TS, default=now, server_default=func.now(), index=True)
