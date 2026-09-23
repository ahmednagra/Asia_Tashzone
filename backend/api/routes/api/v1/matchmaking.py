from fastapi import APIRouter, Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Http.Controllers.MatchmakingController import MatchmakingController
from app.Schemas.matchmaking import QueueIn

router = APIRouter(prefix="/matchmaking", tags=["Matchmaking"])


@router.post("/queue")
def queue(body: QueueIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return MatchmakingController.queue(body, request, p, db, settings)


@router.get("/ticket")
def ticket(request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return MatchmakingController.ticket(request, p, db, settings)


@router.delete("/queue", status_code=204)
def leave_queue(p: CurrentPlayer, db: DB):
    return MatchmakingController.leave_queue(p, db)
