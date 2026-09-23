"""Voice tokens for self-hosted LiveKit: room name = room code, identity = player id. Only in rooms joined with a
code, never Quick Match; Parent Settings, mutes and the kill switch all apply."""
import uuid
from datetime import timedelta

import jwt
from sqlalchemy.orm import Session

from app.Core.enforcement import is_silenced, now
from app.Core.errors import ApiError, conflict, forbidden
from app.Models import Player
from app.Services import PlayerService as player_svc
from app.Services.AppConfigService import require_feature, require_online
from app.Services.RoomService import free_speech_allowed, member_room
from config.settings import Settings


def voice_token(db: Session, settings: Settings, p: Player, code: str) -> dict:
    """LiveKit token: room name = room code, identity = player id (the match server and LiveKit agree who is who)."""
    require_online(settings)
    require_feature(settings, "voice")
    room, _ = member_room(db, p, code)
    if room.status not in ("open", "playing"):
        raise conflict("ROOM_NOT_OPEN", "This room is not accepting voice chat")
    if is_silenced(db, p.id):
        raise forbidden("CHAT_MUTED", "Your chat is muted")
    if not free_speech_allowed(room):
        raise forbidden("VOICE_QUICK_MATCH", "Voice chat is only available in rooms you joined with a code")
    if not player_svc.effective(p, player_svc.parental(db, p), "voice"):
        raise forbidden("VOICE_OFF", "Voice chat is turned off in Parent Settings")
    if not settings.voice_configured:
        raise ApiError(503, "NOT_CONFIGURED", "Voice chat is not available")
    at = now()
    exp = at + timedelta(minutes=settings.voice_token_minutes)
    claims = {"iss": settings.livekit_api_key, "sub": p.id, "name": p.display_name, "jti": uuid.uuid4().hex,
              "nbf": int(at.timestamp()), "exp": int(exp.timestamp()),
              "video": {"room": room.code, "roomJoin": True, "canPublish": True, "canSubscribe": True, "canPublishData": False,
                        "canPublishSources": ["microphone"]}}
    return {"url": settings.livekit_url, "token": jwt.encode(claims, settings.livekit_api_secret, algorithm="HS256"),
            "room": room.code, "identity": p.id, "expires_at": exp}
