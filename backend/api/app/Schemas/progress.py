"""Progress sync bodies: every value is a bounded claim from an untrusted device."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Counter = Annotated[int, Field(ge=0, le=1_000_000)]

class GameCounters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    matches: Counter = 0
    wins: Counter = 0
    hands_played: Counter = 0


class ProgressIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    xp: Annotated[int, Field(ge=0, le=10_000_000)] = 0
    matches: Counter = 0
    wins: Counter = 0
    hands_played: Counter = 0
    first_out: Counter = 0
    times_bhabhi: Counter = 0
    best_streak: Counter = 0
    badges: Annotated[list[Annotated[str, Field(min_length=1, max_length=40)]], Field(max_length=64)] = Field(default_factory=list)
    games: Annotated[dict[Literal["callbreak", "courtpiece", "bhabhi", "callbridge"], GameCounters], Field(max_length=8)] = Field(default_factory=dict)
