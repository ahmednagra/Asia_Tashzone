from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.Core.security import DB, AnyPlayer, Config, CurrentPlayer
from app.Http.Controllers.PlayerController import PlayerController
from app.Schemas.identities import IdentityIn, Provider
from app.Schemas.players import AppealIn, BlockIn, ParentalIn, ProfileIn, RegisterIn
from app.Schemas.progress import ProgressIn

router = APIRouter(prefix="/players", tags=["Players"])


@router.post("", status_code=201)
def register(body: RegisterIn, request: Request, db: DB, settings: Config):
    return PlayerController.register(body, request, db, settings)


@router.post("/restore")
def restore(body: IdentityIn, request: Request, db: DB, settings: Config):
    """A fresh install trades a provider sign-in for the token of the profile it is linked to."""
    return PlayerController.restore(body, request, db, settings)


@router.get("/me")
def me(p: CurrentPlayer, db: DB):
    return PlayerController.me(p, db)


@router.patch("/me")
def update_me(body: ProfileIn, p: CurrentPlayer, db: DB):
    return PlayerController.update_me(body, p, db)


@router.delete("/me", status_code=204)
def delete_me(p: AnyPlayer, db: DB):
    """C-28: works for a sanctioned player too; deleting your data is never something a sanction can take away."""
    return PlayerController.delete_me(p, db)


@router.get("/me/sanction")
def my_sanction(p: AnyPlayer, db: DB):
    return PlayerController.my_sanction(p, db)


@router.post("/me/appeal", status_code=201)
def appeal(body: AppealIn, request: Request, p: AnyPlayer, db: DB, settings: Config):
    return PlayerController.appeal(body, request, p, db, settings)


@router.post("/me/link")
def link(body: IdentityIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return PlayerController.link(body, request, p, db, settings)


@router.delete("/me/link/{provider}", status_code=204)
def unlink(provider: Provider, p: CurrentPlayer, db: DB):
    return PlayerController.unlink(provider, p, db)


@router.get("/me/progress")
def get_progress(p: CurrentPlayer, db: DB):
    return PlayerController.get_progress(p, db)


@router.put("/me/progress")
def put_progress(body: ProgressIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return PlayerController.put_progress(body, request, p, db, settings)


@router.get("/me/parental")
def get_parental(p: CurrentPlayer, db: DB):
    return PlayerController.get_parental(p, db)


@router.put("/me/parental")
def set_parental(body: ParentalIn, request: Request, p: CurrentPlayer, db: DB):
    return PlayerController.set_parental(body, request, p, db)


@router.get("/me/blocks")
def list_blocks(p: CurrentPlayer, db: DB, settings: Config):
    return PlayerController.list_blocks(p, db, settings)


@router.post("/me/blocks", status_code=204)
def block(body: BlockIn, p: CurrentPlayer, db: DB, settings: Config):
    return PlayerController.block(body, p, db, settings)


@router.delete("/me/blocks/{player_id}", status_code=204)
def unblock(player_id: str, p: CurrentPlayer, db: DB):
    return PlayerController.unblock(player_id, p, db)


@router.get("/me/stats")
def stats(p: CurrentPlayer, db: DB):
    return PlayerController.stats(p, db)


@router.get("/me/matches")
def matches(p: CurrentPlayer, db: DB, limit_: Annotated[int, Query(alias="limit", ge=1, le=50)] = 20, cursor: str | None = Query(default=None, max_length=200)):
    return PlayerController.matches(p, db, limit_, cursor)
