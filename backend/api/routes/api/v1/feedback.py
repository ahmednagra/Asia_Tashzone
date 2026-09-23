from fastapi import APIRouter, Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Http.Controllers.FeedbackController import FeedbackController
from app.Schemas.feedback import FeedbackIn

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post("", status_code=201)
def feedback(body: FeedbackIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
    return FeedbackController.feedback(body, request, p, db, settings)
