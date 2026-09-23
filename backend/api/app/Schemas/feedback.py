"""Feedback request bodies."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FeedbackIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Literal["bug", "rules", "idea", "other"]
    profile_id: str | None = Field(default=None, max_length=40)
    match_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_.:-]{1,80}$")
    text: str | None = Field(default=None, max_length=500)
    record: dict | None = None  # {profile_id, rules, actions[]}: bounded to 64 KB server-side
    app_version: str | None = Field(default=None, max_length=32)
