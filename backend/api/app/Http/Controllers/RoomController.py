"""RoomController: request orchestration (rate limits, service calls) between routes and Services."""
from fastapi import Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Middleware.rate_limit import limit
from app.Schemas.rooms import CreateIn
from app.Services import RoomService, VoiceService


class RoomController:
    @staticmethod
    def create(body: CreateIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"room-create:{p.id}", per_minute=settings.room_creates_per_minute, per_ip=False)
        return RoomService.create(db, settings, p, body.profile_id, body.preset, body.settings)

    @staticmethod
    def join(code: str, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"room-join:{p.id}", per_minute=settings.room_join_attempts_per_minute, per_ip=False)
        limit(request, "room-join", per_minute=settings.room_join_attempts_per_ip_per_minute)
        return RoomService.join(db, settings, p, code)

    @staticmethod
    def get(code: str, p: CurrentPlayer, db: DB):
        return RoomService.get(db, p, code)

    @staticmethod
    def leave(code: str, p: CurrentPlayer, db: DB):
        RoomService.leave(db, p, code)

    @staticmethod
    def kick(code: str, seat: int, p: CurrentPlayer, db: DB):
        return RoomService.kick(db, p, code, seat)

    @staticmethod
    def voice(code: str, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"voice:{p.id}", per_hour=settings.voice_tokens_per_hour, per_ip=False)
        return VoiceService.voice_token(db, settings, p, code)
