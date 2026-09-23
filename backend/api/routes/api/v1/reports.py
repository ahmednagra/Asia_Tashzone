from fastapi import APIRouter, Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Http.Controllers.ReportController import ReportController
from app.Schemas.moderation import ReportIn

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("", status_code=201)
def report(body: ReportIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return ReportController.report(body, request, p, db, settings)
