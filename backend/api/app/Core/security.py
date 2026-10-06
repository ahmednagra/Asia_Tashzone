"""Player tokens (HMAC, revocable by token_generation) and join tokens compatible with
backend/match-server/src/tokens.ts: base64url(JSON) "." base64url(HMAC-SHA-256(secret, "tz/join/v1." + payload))."""
import base64
import hashlib
import hmac
import json
import time
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.Core.enforcement import aware, banned_error, is_banned
from app.Core.errors import ApiError, forbidden
from app.Models import Moderator, Player, PlayerSession, now
from config.database import get_db
from config.settings import Settings, get_settings


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def sign_player_token(secret: str, player_id: str, generation: int, days: int = 180, session_id: str | None = None) -> str:
    body = {"pid": player_id, "gen": generation, "exp": int(time.time()) + days * 86400}
    if session_id is not None:
        body["sid"] = session_id
    payload = _b64(json.dumps(body, separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), ("tz/player/v1." + payload).encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64(sig)}"


def verify_player_token(secret: str, token: str) -> tuple[str, int, str | None] | None:
    try:
        payload, sig = token.split(".")
        expect = hmac.new(secret.encode(), ("tz/player/v1." + payload).encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expect, _unb64(sig)):
            return None
        d = json.loads(_unb64(payload))
        if "exp" in d and int(d["exp"]) < time.time():
            return None
        sid = d.get("sid")
        return str(d["pid"]), int(d["gen"]), str(sid) if sid is not None else None
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


def sign_join_token(secret: str, claims: dict, ttl_s: int) -> str:
    body = {**claims, "exp": int(time.time()) + ttl_s}
    payload = _b64(json.dumps(body, separators=(",", ":")).encode())
    sig = hmac.new(secret.encode(), ("tz/join/v1." + payload).encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64(sig)}"


# ── auth dependencies ──────────────────────────────────────────────────────────────────────────────────────────
# A ban is enforced here once, so a route added tomorrow is covered by default. The three things a banned player
# may still do — read their sanction, appeal it, delete their data — use AnyPlayer.


SESSION_TOUCH_SECONDS = 600


def authenticated_player(request: Request, authorization: str | None = Header(default=None), db: Session = Depends(get_db),
                         settings: Settings = Depends(get_settings)) -> Player:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(401, "UNAUTHORIZED", "Missing bearer token")
    parsed = verify_player_token(settings.player_token_secret, authorization[7:].strip())
    if not parsed:
        raise ApiError(401, "UNAUTHORIZED", "Invalid or expired token")
    pid, gen, sid = parsed
    p = db.get(Player, pid)
    if p is None or p.deleted_at is not None or p.token_generation != gen:
        raise ApiError(401, "UNAUTHORIZED", "Player not found")
    if sid is not None:
        s = db.get(PlayerSession, sid)
        if s is None or s.player_id != pid or s.revoked_at is not None:
            raise ApiError(401, "UNAUTHORIZED", "Session ended")
        if (now() - aware(s.last_seen_at)).total_seconds() > SESSION_TOUCH_SECONDS:
            s.last_seen_at = now()
            db.commit()
    request.state.session_id = sid
    return p


def current_player(player: Player = Depends(authenticated_player), db: Session = Depends(get_db)) -> Player:
    if is_banned(db, player.id):
        raise banned_error()
    return player


def current_moderator(player: Player = Depends(authenticated_player), db: Session = Depends(get_db)) -> Moderator:
    if is_banned(db, player.id):
        raise banned_error()
    m = db.get(Moderator, player.id)
    if m is None or m.revoked_at is not None:
        raise forbidden("FORBIDDEN", "You do not have access to this")
    return m


def internal_only(authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> None:
    if not authorization or not hmac.compare_digest(authorization, f"Bearer {settings.internal_api_token}"):
        raise ApiError(401, "UNAUTHORIZED", "Invalid service token")


CurrentPlayer = Annotated[Player, Depends(current_player)]
AnyPlayer = Annotated[Player, Depends(authenticated_player)]
CurrentModerator = Annotated[Moderator, Depends(current_moderator)]
DB = Annotated[Session, Depends(get_db)]
Config = Annotated[Settings, Depends(get_settings)]
