"""FeedbackController: request orchestration (rate limits, service calls) between routes and Services."""
from fastapi import Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Middleware.rate_limit import limit
from app.Schemas.feedback import FeedbackIn
from app.Services import FeedbackService


class FeedbackController:
    @staticmethod
    def feedback(body: FeedbackIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"feedback:{p.id}", per_minute=settings.feedback_per_minute, per_ip=False)
        limit(request, "feedback", per_minute=settings.feedback_per_ip_per_minute)
        f = FeedbackService.create(db, settings, p, body.category, body.profile_id, body.match_id, body.text, body.record, body.app_version)
        return {"id": f.id, "created_at": f.created_at}
