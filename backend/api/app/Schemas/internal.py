"""Match server → API bodies (service token)."""
from typing import Literal

from pydantic import BaseModel, Field


class ResultIn(BaseModel):
    match_id: str = Field(max_length=80)
    room: str = Field(pattern="^[A-Z0-9]{6}$")
    epoch: int
    profile_id: str
    effective_profile_hash: str = Field(pattern="^[0-9a-f]{64}$")
    engine_build_hash: str
    outcome: Literal["completed", "interrupted"]
    totals: list[int]
    placements: list[int] | None
    players: list[str | None]
    bot_seats: list[int]
    sealed_hand_ids: list[str]


class InternalReportIn(BaseModel):
    room: str = Field(pattern="^[A-Za-z0-9]{6}$")
    reporter_player_id: str = Field(max_length=36)
    subject_player_id: str = Field(max_length=36)
    reason: Literal["rude", "cheating", "other"]
    match_id: str | None = Field(default=None, max_length=80)
