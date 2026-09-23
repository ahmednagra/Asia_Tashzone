from fastapi import APIRouter, Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Http.Controllers.RoomController import RoomController
from app.Schemas.rooms import CreateIn

router = APIRouter(prefix="/rooms", tags=["Rooms"])


@router.post("", status_code=201)
def create(body: CreateIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return RoomController.create(body, request, p, db, settings)


@router.post("/{code}/join")
def join(code: str, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return RoomController.join(code, request, p, db, settings)


@router.get("/{code}")
def get(code: str, p: CurrentPlayer, db: DB):
    return RoomController.get(code, p, db)


@router.post("/{code}/leave", status_code=204)
def leave(code: str, p: CurrentPlayer, db: DB):
    return RoomController.leave(code, p, db)


@router.delete("/{code}/members/{seat}")
def kick(code: str, seat: int, p: CurrentPlayer, db: DB):
    return RoomController.kick(code, seat, p, db)


@router.post("/{code}/voice")
def voice(code: str, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return RoomController.voice(code, request, p, db, settings)
