"""PlayerController: request orchestration (rate limits, service calls) between routes and Services."""

from fastapi import Request

from app.Core.security import DB, AnyPlayer, Config, CurrentPlayer
from app.Middleware.rate_limit import limit
from app.Schemas.identities import IdentityIn, Provider
from app.Schemas.players import AppealIn, BlockIn, ParentalIn, ProfileIn, RegisterIn
from app.Schemas.progress import ProgressIn
from app.Services import IdentityService, ModerationService, PlayerService, ProgressService, SanctionService
from app.Services.AppConfigService import require_feature
from app.Services.IdentityVerifier import configured_providers


def _me(db, p) -> dict:
    ps = PlayerService.parental(db, p)
    return {"player_id": p.id, "display_name": p.display_name, "avatar_id": p.avatar_id, "protected": p.protected,
            "parental": PlayerService.parental_view(ps), "linked_providers": IdentityService.linked_providers(db, p),
            "available_providers": list(configured_providers()), "stats": PlayerService.stats(db, p)}


class PlayerController:
    @staticmethod
    def register(body: RegisterIn, request: Request, db: DB, settings: Config):
        limit(request, "register", per_hour=settings.registrations_per_ip_per_hour)
        p, token = PlayerService.register(db, settings, body.display_name, body.avatar_id, body.birth_year, body.protected)
        return {"player_id": p.id, "token": token, "protected": p.protected}

    @staticmethod
    def restore(body: IdentityIn, request: Request, db: DB, settings: Config):
        """A fresh install trades a provider sign-in for the token of the profile it is linked to."""
        limit(request, "restore", per_hour=settings.restores_per_ip_per_hour)
        require_feature(settings, "account_linking")
        p, token = IdentityService.restore(db, settings, body.provider, body.id_token, body.nonce)
        return {"player_id": p.id, "token": token}

    @staticmethod
    def me(p: CurrentPlayer, db: DB):
        return _me(db, p)

    @staticmethod
    def update_me(body: ProfileIn, p: CurrentPlayer, db: DB):
        PlayerService.update_profile(db, p, body.display_name, body.avatar_id)
        return _me(db, p)

    @staticmethod
    def delete_me(p: AnyPlayer, db: DB):
        """C-28: works for a sanctioned player too; deleting your data is never something a sanction can take away."""
        PlayerService.delete_player(db, p)

    @staticmethod
    def my_sanction(p: AnyPlayer, db: DB):
        return SanctionService.my_sanction(db, p)

    @staticmethod
    def appeal(body: AppealIn, request: Request, p: AnyPlayer, db: DB, settings: Config):
        limit(request, f"appeal:{p.id}", per_hour=settings.appeals_per_hour, per_ip=False)
        return SanctionService.appeal_view(SanctionService.create_appeal(db, p, body.sanction_id, body.message.strip()[: settings.appeal_max_chars]))

    @staticmethod
    def link(body: IdentityIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"link:{p.id}", per_hour=settings.account_links_per_hour, per_ip=False)
        require_feature(settings, "account_linking")
        return IdentityService.link(db, p, body.provider, body.id_token, body.nonce)

    @staticmethod
    def unlink(provider: Provider, p: CurrentPlayer, db: DB):
        IdentityService.unlink(db, p, provider)

    @staticmethod
    def get_progress(p: CurrentPlayer, db: DB):
        return ProgressService.get_progress(db, p)

    @staticmethod
    def put_progress(body: ProgressIn, request: Request, p: CurrentPlayer, db: DB, settings: Config):
        limit(request, f"progress:{p.id}", per_minute=settings.progress_syncs_per_minute, per_ip=False)
        return ProgressService.put_progress(db, p, body.model_dump())

    @staticmethod
    def get_parental(p: CurrentPlayer, db: DB):
        return PlayerService.parental_view(PlayerService.parental(db, p))

    @staticmethod
    def set_parental(body: ParentalIn, request: Request, p: CurrentPlayer, db: DB):
        limit(request, f"parental:{p.id}", per_minute=10, per_ip=False)
        ps = PlayerService.set_parental(db, p, body.model_dump(exclude={"pin", "new_pin"}), body.pin, body.new_pin)
        return PlayerService.parental_view(ps)

    @staticmethod
    def list_blocks(p: CurrentPlayer, db: DB, settings: Config):
        return {"items": ModerationService.list_blocks(db, settings, p)}

    @staticmethod
    def block(body: BlockIn, p: CurrentPlayer, db: DB, settings: Config):
        ModerationService.add_block(db, settings, p, ModerationService.resolve_target(db, p, body.player_id, body.room_code, body.seat))

    @staticmethod
    def unblock(player_id: str, p: CurrentPlayer, db: DB):
        ModerationService.remove_block(db, p, player_id)

    @staticmethod
    def stats(p: CurrentPlayer, db: DB):
        return {"items": PlayerService.stats(db, p)}

    @staticmethod
    def matches(p: CurrentPlayer, db: DB, limit_: int = 20, cursor: str | None = None):
        return PlayerService.history(db, p, limit_, cursor)
