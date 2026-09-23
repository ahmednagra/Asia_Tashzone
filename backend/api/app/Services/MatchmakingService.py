"""Quick Match (ported from TashZone v1): one tap, a table in seconds, strangers may only use preset quick chat and
reactions (origin=quick_match). First come, first served; bots fill empty seats after a short wait. No rating.

Matching runs inside the request that needs it (queue / poll), in one transaction. Candidates are taken with
SELECT … FOR UPDATE SKIP LOCKED, so concurrent passes hold disjoint tickets and neither blocks the other; the only
lock that waits is the caller's own ticket. One ticket row per player (primary key) and the room_seats unique
constraints make double-booking impossible even where FOR UPDATE is not (SQLite in tests)."""
from datetime import datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.Core.enforcement import OFFLINE_KINDS, active_kinds, aware, now
from app.Core.errors import ApiError, not_found
from app.Models import MatchmakingTicket, ParentalSettings, Player, Room, RoomSeat
from app.Services.AppConfigService import require_feature
from app.Services.GameConfigService import bundles, seat_count, validate_settings
from app.Services.ModerationService import blocked_pair_exists
from app.Services.RoomService import check_online_allowed, join_ticket, new_code
from config.settings import Settings


def _ticket_not_found() -> ApiError:
    return not_found("TICKET_NOT_FOUND", "You are not in the Quick Match queue")


def quick_room_settings(profile_id: str, seats: int) -> tuple[str, dict]:
    """The app-default preset of the profile; Bhabhi also carries its table size."""
    b = bundles().get(profile_id)
    if b is None:
        raise ApiError(422, "UNKNOWN_PROFILE", "Unknown game")
    settings: dict = {"players": seats} if "players" in b["settings_schema"]["properties"] else {}
    preset = b.get("default_preset", "standard")
    err = validate_settings(profile_id, preset, settings)
    if err or seat_count(profile_id, settings) != seats:
        raise ApiError(422, "INVALID_PLAYER_COUNT", "That game cannot be played with this many players")
    return preset, settings


def queue(db: Session, settings: Settings, p: Player, profile_id: str, seats: int) -> dict:
    """Idempotent: a retry keeps the same place; a different game or size replaces the ticket."""
    require_feature(settings, "quick_match")
    check_online_allowed(db, settings, p, profile_id)
    quick_room_settings(profile_id, seats)
    existing = db.get(MatchmakingTicket, p.id)
    if existing is not None and existing.state == "matched":
        v = _view(db, settings, existing, p)
        if v["status"] == "matched":
            return v
    at = now()
    expires = at + timedelta(seconds=settings.matchmaking_ticket_ttl_seconds)
    same = (existing is not None and existing.state == "waiting" and existing.profile_id == profile_id and existing.seats == seats
            and aware(existing.expires_at) > at)
    if same and existing is not None:
        existing.expires_at, existing.updated_at = expires, at
    else:
        db.merge(MatchmakingTicket(player_id=p.id, profile_id=profile_id, seats=seats, state="waiting", room_code=None,
                                   created_at=at, updated_at=at, expires_at=expires))
    db.commit()
    _match_pass(db, settings, p.id)
    return ticket(db, settings, p, run_pass=False)


def ticket(db: Session, settings: Settings, p: Player, run_pass: bool = True) -> dict:
    """A poll runs a pass: after MATCHMAKING_BOT_BACKFILL_SECONDS that pass seats the player with bots."""
    t = db.get(MatchmakingTicket, p.id)
    if t is None:
        raise _ticket_not_found()
    if run_pass and t.state == "waiting":
        _match_pass(db, settings, p.id)
        db.expire_all()
        t = db.get(MatchmakingTicket, p.id)
        if t is None:
            raise _ticket_not_found()
    return _view(db, settings, t, p)


def leave(db: Session, p: Player) -> None:
    db.execute(delete(MatchmakingTicket).where(MatchmakingTicket.player_id == p.id).execution_options(synchronize_session=False))
    db.commit()


def _match_pass(db: Session, settings: Settings, player_id: str) -> None:
    mine = db.scalar(select(MatchmakingTicket).where(MatchmakingTicket.player_id == player_id).with_for_update())
    at = now()
    if mine is None or mine.state != "waiting":
        db.rollback()
        return
    if aware(mine.expires_at) <= at:
        mine.state, mine.updated_at = "expired", at
        db.commit()
        return
    limit = min(mine.seats * settings.matchmaking_candidate_factor, settings.matchmaking_max_candidates)
    candidates = list(db.scalars(
        select(MatchmakingTicket).where(MatchmakingTicket.state == "waiting", MatchmakingTicket.profile_id == mine.profile_id,
                                        MatchmakingTicket.seats == mine.seats, MatchmakingTicket.player_id != player_id,
                                        MatchmakingTicket.expires_at > at)
        .order_by(MatchmakingTicket.created_at).limit(limit).with_for_update(skip_locked=True)))
    party = _party(db, mine, candidates)
    full = len(party) == mine.seats
    backfill = (at - aware(mine.created_at)).total_seconds() >= settings.matchmaking_bot_backfill_seconds
    if not full and not backfill:
        db.rollback()
        return
    try:
        _seat(db, settings, party, mine.profile_id, mine.seats, at)
    except (IntegrityError, OperationalError):
        db.rollback()


def _party(db: Session, mine: MatchmakingTicket, candidates: list[MatchmakingTicket]) -> list[MatchmakingTicket]:
    """Re-checked now, not trusted from queue time: sanctions, Parent Settings, blocks against anyone already seated."""
    party = [mine]
    if not candidates:
        return party
    ids = [c.player_id for c in candidates]
    sanctioned = active_kinds(db, ids)
    rows = db.execute(select(Player.id, Player.protected, Player.deleted_at, ParentalSettings.online_play)
                      .outerjoin(ParentalSettings, ParentalSettings.player_id == Player.id).where(Player.id.in_(ids))).all()
    online = {r.id: (r.deleted_at is None and (not r.protected or bool(r.online_play if r.online_play is not None else True))) for r in rows}
    for c in candidates:
        if len(party) == mine.seats:
            break
        if OFFLINE_KINDS & sanctioned.get(c.player_id, set()) or not online.get(c.player_id, False):
            continue
        if blocked_pair_exists(db, c.player_id, [t.player_id for t in party]):
            continue
        party.append(c)
    return party


def _seat(db: Session, settings: Settings, party: list[MatchmakingTicket], profile_id: str, seats: int, at: datetime) -> bool:
    """An ordinary room with origin=quick_match and a short TTL; empty seats become bots when the match starts."""
    preset, room_settings = quick_room_settings(profile_id, seats)
    for _ in range(10):
        code = new_code()
        if db.get(Room, code):
            continue
        room = Room(code=code, host_player_id=party[0].player_id, profile_id=profile_id, preset=preset, settings=room_settings,
                    profile_hash=bundles()[profile_id]["profile_hash"], seats=seats, origin="quick_match", status="open",
                    expires_at=at + timedelta(minutes=settings.matchmaking_room_ttl_minutes), status_changed_at=at)
        db.add(room)
        db.flush()
        ids = [t.player_id for t in party]
        claimed = db.execute(update(MatchmakingTicket).where(MatchmakingTicket.player_id.in_(ids), MatchmakingTicket.state == "waiting")
                             .values(state="matched", room_code=code, updated_at=at).execution_options(synchronize_session=False))
        if int(claimed.rowcount or 0) != len(party):
            db.rollback()
            return False
        for seat, t in enumerate(party):
            db.add(RoomSeat(room_code=code, seat=seat, player_id=t.player_id))
        db.commit()
        return True
    raise ApiError(503, "ROOM_CODE_UNAVAILABLE", "Could not start a match, try again")


def _view(db: Session, settings: Settings, t: MatchmakingTicket, p: Player) -> dict:
    common = {"profile_id": t.profile_id, "seats": t.seats}
    if t.state == "matched" and t.room_code is not None:
        room = db.get(Room, t.room_code)
        seat = db.scalar(select(RoomSeat).where(RoomSeat.room_code == t.room_code, RoomSeat.player_id == t.player_id)) if room else None
        usable = room is not None and seat is not None and room.status in ("open", "playing", "finished") and not (room.status == "open" and aware(room.expires_at) <= now())
        if usable:
            return {"status": "matched", "join": join_ticket(db, settings, room, seat.seat, p), **common}
        t.state, t.room_code, t.updated_at = "expired", None, now()
        db.commit()
        return {"status": "expired", **common}
    if t.state != "waiting":
        return {"status": t.state, **common}
    at = now()
    if aware(t.expires_at) <= at:
        t.state, t.updated_at = "expired", at
        db.commit()
        return {"status": "expired", **common}
    waited = (at - aware(t.created_at)).total_seconds()
    ahead = (select(MatchmakingTicket.player_id).where(MatchmakingTicket.state == "waiting", MatchmakingTicket.profile_id == t.profile_id,
                                                        MatchmakingTicket.seats == t.seats, MatchmakingTicket.created_at <= t.created_at,
                                                        MatchmakingTicket.expires_at > at)
             .limit(settings.matchmaking_max_position + 1).subquery())
    counted = int(db.scalar(select(func.count()).select_from(ahead)) or 1)
    return {"status": "waiting", "position": None if counted > settings.matchmaking_max_position else counted,
            "bot_backfill_in_seconds": max(0, int(settings.matchmaking_bot_backfill_seconds - waited)),
            "expires_at": aware(t.expires_at), **common}


def expire_tickets(db: Session, at: datetime | None = None, batch: int = 500) -> int:
    moment = at or now()
    ids = list(db.scalars(select(MatchmakingTicket.player_id).where(MatchmakingTicket.state == "waiting", MatchmakingTicket.expires_at <= moment).limit(batch)))
    if not ids:
        return 0
    r = db.execute(update(MatchmakingTicket).where(MatchmakingTicket.player_id.in_(ids), MatchmakingTicket.state == "waiting",
                                                   MatchmakingTicket.expires_at <= moment)
                   .values(state="expired", updated_at=moment).execution_options(synchronize_session=False))
    db.commit()
    return int(r.rowcount or 0)


def purge_tickets(db: Session, settings: Settings, at: datetime | None = None, batch: int = 500) -> int:
    cutoff = (at or now()) - timedelta(minutes=settings.matchmaking_room_ttl_minutes)
    ids = list(db.scalars(select(MatchmakingTicket.player_id).where(MatchmakingTicket.state != "waiting", MatchmakingTicket.updated_at <= cutoff).limit(batch)))
    if not ids:
        return 0
    db.execute(delete(MatchmakingTicket).where(MatchmakingTicket.player_id.in_(ids), MatchmakingTicket.state != "waiting").execution_options(synchronize_session=False))
    db.commit()
    return len(ids)
