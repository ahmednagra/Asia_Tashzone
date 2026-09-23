"""Reports (players) and moderator decisions. Reasons are a fixed list so the audit trail is countable."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Reason = Literal["abuse", "cheating", "duplicate", "no_evidence", "not_a_violation", "repeat_offender", "retaliatory", "spam"]
Kind = Literal["warning", "chat_muted", "online_suspended", "banned"]

class EvidenceMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=500)
    at: str | None = Field(default=None, max_length=40)


class ReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    room_code: str = Field(pattern=r"^[A-Za-z0-9]{6}$")
    seat: int | None = Field(default=None, ge=0, le=7)
    player_id: str | None = Field(default=None, max_length=36)
    reason: Literal["rude", "cheating", "other"]
    match_id: str | None = Field(default=None, max_length=80)
    evidence: list[EvidenceMessage] | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def _subject(self) -> "ReportIn":
        if (self.seat is None) == (self.player_id is None):
            raise ValueError("give either seat or player_id")
        return self


class ResolutionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Reason
    note: str | None = Field(default=None, max_length=500)
    resolve_all: bool = False


class ActionIn(ResolutionIn):
    kind: Kind
    days: int | None = Field(default=None, ge=1, le=3650)


class SanctionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Kind
    reason: Reason
    days: int | None = Field(default=None, ge=1, le=3650)


class RevokeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: Reason = "not_a_violation"


class DecisionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    granted: bool
    note: str | None = Field(default=None, max_length=500)


class ModeratorIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["moderator", "admin"] = "moderator"
