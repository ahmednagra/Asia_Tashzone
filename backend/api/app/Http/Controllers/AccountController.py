import hashlib

from fastapi import BackgroundTasks, Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Middleware.rate_limit import limit, limit_key
from app.Schemas.accounts import CodeLoginIn, CodeRequestIn, PasswordChangeIn, PasswordLoginIn, PasswordResetIn, SignupIn
from app.Services import AccountService
from app.Services.AccountService import normalize_email

FIFTEEN_MINUTES = 15 * 60


def _per_email(prefix: str, email: str, allowed: int, window: int) -> None:
    limit_key(f"{prefix}:{hashlib.sha256(normalize_email(email).encode()).hexdigest()[:24]}", allowed, window)


class AccountController:
    @staticmethod
    def request_code(body: CodeRequestIn, request: Request, tasks: BackgroundTasks, db: DB, settings: Config):
        limit(request, "auth_code", per_hour=settings.auth_codes_per_ip_per_hour)
        _per_email("auth_code", body.email, settings.auth_codes_per_email_per_hour, 3600)
        AccountService.request_code(db, settings, tasks, body.email, body.purpose, body.lang)
        return {"sent": True}

    @staticmethod
    def signup(body: SignupIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, "signup", per_hour=settings.logins_per_ip_per_hour)
        _per_email("verify", body.email, settings.logins_per_email_per_15_minutes, FIFTEEN_MINUTES)
        return AccountService.signup(db, settings, p, body.email, body.code, body.password)

    @staticmethod
    def login_password(body: PasswordLoginIn, request: Request, db: DB, settings: Config):
        limit(request, "login", per_hour=settings.logins_per_ip_per_hour)
        _per_email("login", body.email, settings.logins_per_email_per_15_minutes, FIFTEEN_MINUTES)
        return AccountService.login_password(db, settings, body.email, body.password)

    @staticmethod
    def login_code(body: CodeLoginIn, request: Request, db: DB, settings: Config):
        limit(request, "login", per_hour=settings.logins_per_ip_per_hour)
        _per_email("verify", body.email, settings.logins_per_email_per_15_minutes, FIFTEEN_MINUTES)
        return AccountService.login_code(db, settings, body.email, body.code)

    @staticmethod
    def reset_password(body: PasswordResetIn, request: Request, db: DB, settings: Config):
        limit(request, "reset", per_hour=settings.logins_per_ip_per_hour)
        _per_email("verify", body.email, settings.logins_per_email_per_15_minutes, FIFTEEN_MINUTES)
        return AccountService.reset_password(db, settings, body.email, body.code, body.new_password)

    @staticmethod
    def change_password(body: PasswordChangeIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"password:{p.id}", per_hour=10, per_ip=False)
        return AccountService.change_password(db, settings, p, body.current_password, body.new_password)

    @staticmethod
    def sign_out_everywhere(p: CurrentPlayer, db: DB, settings: Config):
        return AccountService.sign_out_everywhere(db, settings, p)
