"""Optional sign-in (account recovery only)."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Provider = Literal["google", "apple", "play_games"]

class IdentityIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: Provider
    id_token: str = Field(min_length=1, max_length=8192)
    nonce: str | None = Field(default=None, max_length=256)
