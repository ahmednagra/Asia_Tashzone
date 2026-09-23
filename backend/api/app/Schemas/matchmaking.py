"""Quick Match request bodies."""

from pydantic import BaseModel, ConfigDict, Field


class QueueIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile_id: str = Field(max_length=40)
    seats: int = Field(default=4, ge=3, le=8)
