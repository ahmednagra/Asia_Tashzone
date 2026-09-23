"""InternalController: request orchestration (rate limits, service calls) between routes and Services."""
from app.Core.security import DB, Config
from app.Schemas.internal import InternalReportIn, ResultIn
from app.Services import MatchService, ModerationService, RoomService


class InternalController:
    @staticmethod
    def results(body: ResultIn, db: DB):
        """Accepted once per match id; results from an older epoch than one already recorded are refused (C-27)."""
        MatchService.record_result(db, body.model_dump())
        return {"ok": True}

    @staticmethod
    def started(code: str, db: DB):
        RoomService.mark_started(db, code)

    @staticmethod
    def report(body: InternalReportIn, db: DB, settings: Config):
        r = ModerationService.report_from_server(db, settings, body.room, body.reporter_player_id, body.subject_player_id, body.reason, body.match_id)
        return {"id": r.id}
