"""MatchmakingController: request orchestration (rate limits, service calls) between routes and Services."""
from fastapi import Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Middleware.rate_limit import limit
from app.Schemas.matchmaking import QueueIn
from app.Services import MatchmakingService


class MatchmakingController:
    @staticmethod
    def queue(body: QueueIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"mm-queue:{p.id}", per_minute=settings.matchmaking_queues_per_minute, per_ip=False)
        limit(request, "mm-queue", per_minute=settings.matchmaking_queues_per_ip_per_minute)
        return MatchmakingService.queue(db, settings, p, body.profile_id, body.seats)

    @staticmethod
    def ticket(request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"mm-poll:{p.id}", per_minute=settings.matchmaking_polls_per_minute, per_ip=False)
        return MatchmakingService.ticket(db, settings, p)

    @staticmethod
    def leave_queue(p: CurrentPlayer, db: DB):
        MatchmakingService.leave(db, p)
