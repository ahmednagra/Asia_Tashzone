"""Player request bodies."""

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str = Field(min_length=1, max_length=40)
    avatar_id: int = Field(default=0, ge=0, le=255)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)  # used once, never stored
    protected: bool | None = None


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=1, max_length=40)
    avatar_id: int | None = Field(default=None, ge=0, le=255)


class AppealIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=500)
    sanction_id: str | None = None


class ParentalIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    online_play: bool | None = None
    same_wifi: bool | None = None
    quick_messages: bool | None = None
    reactions: bool | None = None
    free_text_chat: bool | None = None
    voice: bool | None = None
    pin: str | None = Field(default=None, pattern=r"^\d{4,6}$")
    new_pin: str | None = Field(default=None, pattern=r"^(\d{4,6})?$")  # "" clears the PIN


class BlockIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    player_id: str | None = Field(default=None, max_length=36)
    room_code: str | None = Field(default=None, pattern=r"^[A-Za-z0-9]{6}$")
    seat: int | None = Field(default=None, ge=0, le=7)

    @model_validator(mode="after")
    def _one_form(self) -> "BlockIn":
        if (self.player_id is None) == (self.room_code is None or self.seat is None):
            raise ValueError("give either player_id or room_code with seat")
        return self
