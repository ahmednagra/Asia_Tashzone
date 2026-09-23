"""ReportController: request orchestration (rate limits, service calls) between routes and Services."""
from fastapi import Request

from app.Core.security import DB, Config, CurrentPlayer
from app.Middleware.rate_limit import limit
from app.Schemas.moderation import ReportIn
from app.Services import ModerationService


class ReportController:
    @staticmethod
    def report(body: ReportIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"report:{p.id}", per_hour=settings.reports_per_hour, per_ip=False)
        limit(request, "report", per_hour=settings.reports_per_ip_per_hour)
        r = ModerationService.report_from_app(db, settings, p, body.room_code, body.seat, body.player_id, body.reason, body.match_id,
                                [e.model_dump() for e in body.evidence] if body.evidence else None)
        return {"id": r.id, "state": r.state}
