from fastapi import APIRouter, Depends

from app.Core.security import DB, Config, internal_only
from app.Http.Controllers.InternalController import InternalController
from app.Schemas.internal import InternalReportIn, ResultIn

router = APIRouter(prefix="/internal", tags=["Internal"], dependencies=[Depends(internal_only)], include_in_schema=False)


@router.post("/results", status_code=201)
def results(body: ResultIn, db: DB):
    return InternalController.results(body, db)


@router.post("/rooms/{code}/started", status_code=204)
def started(code: str, db: DB):
    return InternalController.started(code, db)


@router.post("/reports", status_code=201)
def report(body: InternalReportIn, db: DB, settings: Config):
    return InternalController.report(body, db, settings)
