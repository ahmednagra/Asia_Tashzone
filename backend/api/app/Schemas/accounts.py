from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EMAIL_PATTERN = r"^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$"
Email = Field(min_length=3, max_length=254, pattern=EMAIL_PATTERN)
Password = Field(min_length=8, max_length=128)
Code = Field(pattern=r"^\d{6}$")


class CodeRequestIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Email
    purpose: Literal["signup", "login", "reset"]
    lang: Literal["en", "ur", "hi", "ne", "bn"] = "en"


class SignupIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Email
    code: str = Code
    password: str = Password


class PasswordLoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Email
    password: str = Field(min_length=1, max_length=128)


class CodeLoginIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Email
    code: str = Code


class PasswordResetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Email
    code: str = Code
    new_password: str = Password


class PasswordChangeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Password
