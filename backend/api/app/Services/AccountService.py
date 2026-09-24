import base64
import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.Core.enforcement import aware, banned_error, is_banned
from app.Core.errors import ApiError, conflict, forbidden
from app.Models import AuthCode, Player, PlayerAccount, now
from app.Services import Mailer
from app.Services.PlayerService import token_for
from app.Utils.Logger import logger
from config.settings import Settings

SCRYPT_N, SCRYPT_R, SCRYPT_P, SCRYPT_LEN = 2**14, 8, 5, 32
SCRYPT_MAXMEM = 64 * 1024 * 1024
_DUMMY_HASH: str | None = None


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=SCRYPT_LEN, maxmem=SCRYPT_MAXMEM)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str | None) -> bool:
    global _DUMMY_HASH
    if stored is None:
        if _DUMMY_HASH is None:
            _DUMMY_HASH = hash_password(secrets.token_urlsafe(16))
        stored, result = _DUMMY_HASH, False
    else:
        result = True
    try:
        scheme, n, r, p, salt, expected = stored.split("$")
        if scheme != "scrypt":
            return False
        want = _unb64(expected)
        dk = hashlib.scrypt(password.encode(), salt=_unb64(salt), n=int(n), r=int(r), p=int(p), dklen=len(want), maxmem=SCRYPT_MAXMEM)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk, want) and result


def _code_hash(settings: Settings, purpose: str, email: str, code: str) -> str:
    key = hmac.new(settings.player_token_secret.encode(), b"tz/auth-code/v1", hashlib.sha256).digest()
    return hmac.new(key, f"{purpose}:{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _require_mail(settings: Settings) -> None:
    if not settings.email_accounts_configured:
        raise ApiError(503, "EMAIL_NOT_CONFIGURED", "Email sign-in is not available right now")


def _account_by_email(db: Session, email: str) -> PlayerAccount | None:
    return db.scalar(select(PlayerAccount).where(PlayerAccount.email == email))


def _live_player(db: Session, account: PlayerAccount | None) -> Player | None:
    if account is None:
        return None
    p = db.get(Player, account.player_id)
    return p if p is not None and p.deleted_at is None else None


def request_code(db: Session, settings: Settings, tasks: BackgroundTasks, email: str, purpose: str, lang: str) -> None:
    _require_mail(settings)
    email = normalize_email(email)
    exists = _live_player(db, _account_by_email(db, email)) is not None
    if purpose == "signup" and exists:
        purpose = "login"
    if purpose in ("login", "reset") and not exists:
        return
    latest = db.scalar(select(func.max(AuthCode.created_at)).where(AuthCode.email == email, AuthCode.purpose == purpose))
    if latest is not None and aware(latest) > now() - timedelta(seconds=settings.auth_code_resend_seconds):
        return
    db.execute(update(AuthCode).where(AuthCode.email == email, AuthCode.purpose == purpose, AuthCode.used_at.is_(None)).values(used_at=now()))
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(AuthCode(purpose=purpose, email=email, code_hash=_code_hash(settings, purpose, email, code),
                    expires_at=now() + timedelta(minutes=settings.auth_code_ttl_minutes)))
    db.commit()
    tasks.add_task(Mailer.send_code, settings, email, purpose, code, lang)


def _consume_code(db: Session, settings: Settings, email: str, purposes: tuple[str, ...], code: str) -> str:
    invalid = ApiError(400, "INVALID_CODE", "That code is wrong or has expired")
    row = db.scalar(
        select(AuthCode)
        .where(AuthCode.email == email, AuthCode.purpose.in_(purposes), AuthCode.used_at.is_(None), AuthCode.expires_at > now())
        .order_by(AuthCode.created_at.desc())
        .limit(1)
        .with_for_update()
    )
    if row is None or row.attempts >= settings.auth_code_max_attempts:
        raise invalid
    row.attempts += 1
    ok = hmac.compare_digest(row.code_hash, _code_hash(settings, row.purpose, email, code))
    if ok:
        row.used_at = now()
    db.commit()
    if not ok:
        raise invalid
    return row.purpose


def _check_password_rules(password: str, email: str) -> None:
    if password.strip().lower() == email or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise ApiError(422, "WEAK_PASSWORD", "Use at least 8 characters with a letter and a number")


def _session(db: Session, settings: Settings, p: Player, account: PlayerAccount) -> dict:
    if is_banned(db, p.id):
        raise banned_error()
    account.last_login_at = now()
    p.last_seen_at = now()
    db.commit()
    return {"player_id": p.id, "token": token_for(settings, p)}


def signup(db: Session, settings: Settings, p: Player, email: str, code: str, password: str) -> dict:
    _require_mail(settings)
    email = normalize_email(email)
    if p.protected:
        raise forbidden("PROTECTED_NO_EMAIL", "A parent must set up sign-in for this profile")
    if db.get(PlayerAccount, p.id) is not None:
        raise conflict("ACCOUNT_EXISTS", "This profile already has an account")
    _check_password_rules(password, email)
    _consume_code(db, settings, email, ("signup",), code)
    account = PlayerAccount(player_id=p.id, email=email, password_hash=hash_password(password), password_changed_at=now())
    db.add(account)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise conflict("EMAIL_TAKEN", "That email already has a TashZone account") from exc
    logger.info("account_created", extra={"player_id": p.id})
    return _session(db, settings, p, account)


def login_password(db: Session, settings: Settings, email: str, password: str) -> dict:
    email = normalize_email(email)
    account = _account_by_email(db, email)
    p = _live_player(db, account)
    if not verify_password(password, account.password_hash if account is not None and p is not None else None) or account is None or p is None:
        raise ApiError(401, "INVALID_CREDENTIALS", "Email or password is wrong")
    return _session(db, settings, p, account)


def login_code(db: Session, settings: Settings, email: str, code: str) -> dict:
    email = normalize_email(email)
    _consume_code(db, settings, email, ("login",), code)
    account = _account_by_email(db, email)
    p = _live_player(db, account)
    if account is None or p is None:
        raise ApiError(400, "INVALID_CODE", "That code is wrong or has expired")
    return _session(db, settings, p, account)


def reset_password(db: Session, settings: Settings, email: str, code: str, new_password: str) -> dict:
    email = normalize_email(email)
    _check_password_rules(new_password, email)
    _consume_code(db, settings, email, ("reset",), code)
    account = _account_by_email(db, email)
    p = _live_player(db, account)
    if account is None or p is None:
        raise ApiError(400, "INVALID_CODE", "That code is wrong or has expired")
    account.password_hash = hash_password(new_password)
    account.password_changed_at = now()
    p.token_generation += 1
    logger.info("password_reset", extra={"player_id": p.id})
    return _session(db, settings, p, account)


def change_password(db: Session, settings: Settings, p: Player, current: str, new_password: str) -> dict:
    account = db.get(PlayerAccount, p.id)
    if account is None:
        raise ApiError(404, "NO_ACCOUNT", "This profile has no email account")
    if not verify_password(current, account.password_hash):
        raise ApiError(401, "INVALID_CREDENTIALS", "Current password is wrong")
    _check_password_rules(new_password, account.email)
    account.password_hash = hash_password(new_password)
    account.password_changed_at = now()
    p.token_generation += 1
    logger.info("password_changed", extra={"player_id": p.id})
    return _session(db, settings, p, account)


def sign_out_everywhere(db: Session, settings: Settings, p: Player) -> dict:
    p.token_generation += 1
    db.commit()
    return {"player_id": p.id, "token": token_for(settings, p)}


def email_of(db: Session, p: Player) -> str | None:
    account = db.get(PlayerAccount, p.id)
    return account.email if account is not None else None


def purge_codes(db: Session, settings: Settings) -> int:
    cutoff = now() - timedelta(hours=settings.auth_code_retention_hours)
    ids = db.scalars(select(AuthCode.id).where(AuthCode.created_at < cutoff).limit(500)).all()
    if ids:
        db.execute(delete(AuthCode).where(AuthCode.id.in_(ids)))
        db.commit()
    return len(ids)
