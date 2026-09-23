"""ModerationController: request orchestration (rate limits, service calls) between routes and Services."""
from typing import Literal

from fastapi import Request

from app.Core.errors import forbidden, not_found
from app.Core.security import DB, Config, CurrentModerator
from app.Middleware.rate_limit import limit
from app.Models import Sanction
from app.Schemas.moderation import ActionIn, DecisionIn, ModeratorIn, ResolutionIn, RevokeIn, SanctionIn
from app.Services import ModerationReviewService, SanctionService


def _act(request: Request, m, settings) -> None:
    limit(request, f"mod:{m.player_id}", per_minute=settings.moderation_actions_per_minute, per_ip=False)


class ModerationController:
    @staticmethod
    def reports(db: DB, settings: Config, state: Literal["open", "dismissed", "actioned"] = "open",
                limit_: int | None = None, offset: int | None = None):
        return ModerationReviewService.queue(db, settings, state, limit_, offset)

    @staticmethod
    def player(player_id: str, db: DB):
        return ModerationReviewService.dossier(db, player_id)

    @staticmethod
    def dismiss(report_id: str, body: ResolutionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
        _act(request, m, settings)
        return ModerationReviewService.dismiss(db, m, report_id, body.reason, body.note, body.resolve_all)

    @staticmethod
    def action(report_id: str, body: ActionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
        _act(request, m, settings)
        return ModerationReviewService.action(db, settings, m, report_id, body.kind, body.reason, body.days, body.note, body.resolve_all)

    @staticmethod
    def sanction(player_id: str, body: SanctionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
        _act(request, m, settings)
        if player_id == m.player_id:
            raise forbidden("CANNOT_SANCTION_SELF", "You cannot sanction yourself")
        return SanctionService.sanction_view(SanctionService.create_sanction(db, settings, subject=player_id, kind=body.kind, reason=body.reason, moderator=m.player_id, days=body.days))

    @staticmethod
    def revoke(sanction_id: str, body: RevokeIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
        _act(request, m, settings)
        s = db.get(Sanction, sanction_id)
        if s is None:
            raise not_found("SANCTION_NOT_FOUND", "No sanction with that id")
        return SanctionService.sanction_view(SanctionService.revoke_sanction(db, s, moderator=m.player_id, reason=body.reason))

    @staticmethod
    def appeals(db: DB, settings: Config, state: Literal["open", "granted", "rejected"] | None = "open",
                limit_: int | None = None, offset: int | None = None):
        return {"items": ModerationReviewService.appeals_queue(db, settings, state, limit_, offset)}

    @staticmethod
    def decide(sanction_id: str, body: DecisionIn, request: Request, m: CurrentModerator, db: DB, settings: Config):
        _act(request, m, settings)
        return SanctionService.appeal_view(SanctionService.decide_appeal(db, m.player_id, sanction_id, body.granted, body.note))

    @staticmethod
    def grant(player_id: str, body: ModeratorIn, m: CurrentModerator, db: DB):
        if m.role != "admin":
            raise forbidden("ADMIN_ONLY", "Only an admin can appoint moderators")
        g = SanctionService.grant_moderator(db, player_id, body.role, m.player_id)
        return {"player_id": g.player_id, "role": g.role}

    @staticmethod
    def remove(player_id: str, m: CurrentModerator, db: DB):
        if m.role != "admin":
            raise forbidden("ADMIN_ONLY", "Only an admin can remove moderators")
        SanctionService.revoke_moderator(db, player_id, m.player_id)
