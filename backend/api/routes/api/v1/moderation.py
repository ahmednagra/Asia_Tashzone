from typing import Literal

from fastapi import APIRouter, Depends, Query, Request

from app.Core.security import DB, Config, CurrentModerator, current_moderator
from app.Http.Controllers.ModerationController import ModerationController
from app.Schemas.moderation import ActionIn, DecisionIn, ModeratorIn, ResolutionIn, RevokeIn, SanctionIn

router = APIRouter(prefix="/moderation", tags=["Moderation"], dependencies=[Depends(current_moderator)])  # the gate is on the router: no route can be added without it


@router.get("/reports")
def reports(db: DB, settings: Config, state: Literal["open", "dismissed", "actioned"] = "open",
            limit_: int | None = Query(default=None, alias="limit", ge=1, le=200), offset: int | None = Query(default=None, ge=0)):
    return ModerationController.reports(db, settings, state, limit_, offset)


@router.get("/players/{player_id}")
def player(player_id: str, db: DB):
    return ModerationController.player(player_id, db)


@router.post("/reports/{report_id}/dismiss")
def dismiss(report_id: str, body: ResolutionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
    return ModerationController.dismiss(report_id, body, request, m, db, settings)


@router.post("/reports/{report_id}/action")
def action(report_id: str, body: ActionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
    return ModerationController.action(report_id, body, request, m, db, settings)


@router.post("/players/{player_id}/sanctions", status_code=201)
def sanction(player_id: str, body: SanctionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
    return ModerationController.sanction(player_id, body, request, m, db, settings)


@router.post("/sanctions/{sanction_id}/revoke")
def revoke(sanction_id: str, body: RevokeIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
    return ModerationController.revoke(sanction_id, body, request, m, db, settings)


@router.get("/appeals")
def appeals(db: DB, settings: Config, state: Literal["open", "granted", "rejected"] | None = "open",
            limit_: int | None = Query(default=None, alias="limit", ge=1, le=200), offset: int | None = Query(default=None, ge=0)):
    return ModerationController.appeals(db, settings, state, limit_, offset)


@router.post("/appeals/{sanction_id}")
def decide(sanction_id: str, body: DecisionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
    return ModerationController.decide(sanction_id, body, request, m, db, settings)


@router.put("/moderators/{player_id}")
def grant(player_id: str, body: ModeratorIn, m: CurrentModerator, db: DB):
    return ModerationController.grant(player_id, body, m, db)


@router.delete("/moderators/{player_id}", status_code=204)
def remove(player_id: str, m: CurrentModerator, db: DB):
    return ModerationController.remove(player_id, m, db)
