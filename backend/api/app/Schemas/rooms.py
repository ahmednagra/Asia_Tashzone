"""Room request bodies."""

from pydantic import BaseModel, ConfigDict, Field


class CreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile_id: str = Field(max_length=40)
    preset: str = Field(default="standard", max_length=40)
    settings: dict = Field(default_factory=dict)
