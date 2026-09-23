"""Online rooms: create/join/leave/kick/view, join tokens, started/finished from the match server, expiry and
retention. Live play happens on the match server, not here."""
import secrets
from datetime import datetime, timedelta

from sqlalchemy import and_, delete, exists, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.Core.enforcement import aware, is_silenced, now, require_online_allowed
from app.Core.errors import ApiError, conflict, forbidden, not_found
from app.Core.security import sign_join_token
from app.Models import MatchmakingTicket, Player, Room, RoomDirectory, RoomKick, RoomSeat
from app.Services import PlayerService as player_svc
from app.Services.AppConfigService import feature_enabled, require_online
from app.Services.GameConfigService import bundles, seat_count, validate_settings
from app.Services.ModerationService import blocked_error, blocked_pair_exists
from config.settings import Settings

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0/O/1/I/L


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def room_not_found() -> ApiError:
    return not_found("ROOM_NOT_FOUND", "No room with that code")


def free_speech_allowed(room: Room) -> bool:
    """Typed chat and voice only among people who exchanged a code (owner decision 18 Sep 2026); never in Quick Match.
    ANDed with Parent Settings and sanctions by every caller; no age is read here."""
    return room.origin == "code"


def check_online_allowed(db: Session, settings: Settings, p: Player, profile_id: str | None) -> None:
    """Kill switch first, then the player's sanctions (answered plainly), then Parent Settings."""
    require_online(settings, profile_id)
    require_online_allowed(db, p.id)
    if not player_svc.effective(p, player_svc.parental(db, p), "online_play"):
        raise forbidden("ONLINE_ROOMS_OFF", "Online rooms are turned off in Parent Settings")


def _seats(db: Session, room: Room) -> list[RoomSeat]:
    return list(db.scalars(select(RoomSeat).where(RoomSeat.room_code == room.code).order_by(RoomSeat.seat)))


def view(db: Session, room: Room) -> dict:
    seats = _seats(db, room)
    players = {p.id: p for p in db.scalars(select(Player).where(Player.id.in_([s.player_id for s in seats])))} if seats else {}
    host = next((s.seat for s in seats if s.player_id == room.host_player_id), None)
    return {"code": room.code, "profile_id": room.profile_id, "preset": room.preset, "settings": room.settings, "seats": room.seats,
            "origin": room.origin, "status": room.status, "host_seat": host, "expires_at": aware(room.expires_at),
            "members": [{"seat": s.seat, "display_name": players[s.player_id].display_name, "avatar_id": players[s.player_id].avatar_id} for s in seats]}


def join_ticket(db: Session, settings: Settings, room: Room, seat: int, p: Player) -> dict:
    ps = player_svc.parental(db, p)
    silenced = is_silenced(db, p.id)
    speech = free_speech_allowed(room)
    claims = {
        "room": room.code, "player_id": p.id, "seat": seat, "name": p.display_name, "avatar_id": p.avatar_id,
        "host": room.host_player_id == p.id, "profile_id": room.profile_id, "preset": room.preset, "settings": room.settings,
        "origin": room.origin,
        "quick_chat": player_svc.effective(p, ps, "quick_messages") and not silenced,
        "reactions": player_svc.effective(p, ps, "reactions"),
        "free_text": player_svc.effective(p, ps, "free_text_chat") and not silenced and speech and feature_enabled(settings, "free_text"),
        "voice": player_svc.effective(p, ps, "voice") and not silenced and speech and feature_enabled(settings, "voice") and settings.voice_configured,
    }
    return {"room_code": room.code, "seat": seat, "match_url": settings.match_server_url,
            "join_token": sign_join_token(settings.join_token_secret, claims, settings.join_token_ttl_s),
            "join_token_expires_in": settings.join_token_ttl_s, "profile_hash": room.profile_hash, "room": view(db, room)}


def _find(db: Session, code: str, lock: bool = False) -> Room | None:
    stmt = select(Room).where(Room.code == code.strip().upper()).execution_options(populate_existing=True)
    if lock:
        stmt = stmt.with_for_update()
    room = db.scalar(stmt)
    if room is not None and room.status == "open" and aware(room.expires_at) <= now():
        room.status, room.status_changed_at = "expired", now()
        db.commit()
    return room


def create(db: Session, settings: Settings, p: Player, profile_id: str, preset: str, room_settings: dict) -> dict:
    check_online_allowed(db, settings, p, profile_id)
    err = validate_settings(profile_id, preset, room_settings)
    if err:
        raise ApiError(422, err.upper(), "Those room settings are not valid")
    for _ in range(20):
        code = new_code()
        if db.get(Room, code):
            continue
        room = Room(code=code, host_player_id=p.id, profile_id=profile_id, preset=preset, settings=room_settings,
                    profile_hash=bundles()[profile_id]["profile_hash"], seats=seat_count(profile_id, room_settings), origin="code",
                    status="open", expires_at=now() + timedelta(minutes=settings.room_ttl_minutes), status_changed_at=now())
        db.add(room)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            continue
        db.add(RoomSeat(room_code=code, seat=0, player_id=p.id))
        db.commit()
        return join_ticket(db, settings, room, 0, p)
    raise ApiError(503, "ROOM_CODE_UNAVAILABLE", "Could not create a room, try again")


def member_room(db: Session, p: Player, code: str, lock: bool = False) -> tuple[Room, RoomSeat]:
    room = _find(db, code, lock)
    seat = db.scalar(select(RoomSeat).where(RoomSeat.room_code == room.code, RoomSeat.player_id == p.id)) if room else None
    if room is None or seat is None:
        raise room_not_found()
    return room, seat


def get(db: Session, p: Player, code: str) -> dict:
    room, _ = member_room(db, p, code)
    return view(db, room)


def join(db: Session, settings: Settings, p: Player, code: str) -> dict:
    """Idempotent rejoin keeps the seat. A full, started, expired room or a kick all look like no room at all."""
    for _ in range(3):
        room = _find(db, code, lock=True)
        if room is None:
            raise room_not_found()
        check_online_allowed(db, settings, p, room.profile_id)
        seats = _seats(db, room)
        mine = next((s for s in seats if s.player_id == p.id), None)
        if mine:
            if room.status == "expired":
                raise conflict("ROOM_CLOSED", "This room has closed")
            return join_ticket(db, settings, room, mine.seat, p)
        taken = {s.seat for s in seats}
        free = next((s for s in range(room.seats) if s not in taken), None)
        kicked = db.scalar(select(exists().where(RoomKick.room_code == room.code, RoomKick.player_id == p.id)))
        if room.status != "open" or kicked:
            raise room_not_found()
        if free is None:
            raise conflict("ROOM_FULL", "That room is full")
        if blocked_pair_exists(db, p.id, [s.player_id for s in seats]):
            raise blocked_error()
        db.add(RoomSeat(room_code=room.code, seat=free, player_id=p.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            continue
        return join_ticket(db, settings, room, free, p)
    raise conflict("ROOM_BUSY", "Too many people joined at once, try again")


def leave(db: Session, p: Player, code: str) -> None:
    """Before the match (or after it, before a rematch). Host passes to the lowest seat; an empty room closes."""
    room, seat = member_room(db, p, code, lock=True)
    if room.status not in ("open", "finished"):
        raise conflict("ROOM_NOT_OPEN", "You can only leave a room before the match starts")
    remaining = [s for s in _seats(db, room) if s.player_id != p.id]
    db.delete(seat)
    if not remaining:
        room.status, room.status_changed_at = "expired", now()
    elif room.host_player_id == p.id:
        room.host_player_id = min(remaining, key=lambda s: s.seat).player_id
    db.commit()


def kick(db: Session, p: Player, code: str, seat_no: int) -> dict:
    room, _ = member_room(db, p, code, lock=True)
    if room.host_player_id != p.id:
        raise forbidden("NOT_HOST", "Only the host can remove players")
    if room.status != "open":
        raise conflict("ROOM_NOT_OPEN", "Players can only be removed before the match starts")
    target = db.scalar(select(RoomSeat).where(RoomSeat.room_code == room.code, RoomSeat.seat == seat_no))
    if target is None:
        raise not_found("SEAT_EMPTY", "Nobody is sitting in that seat")
    if target.player_id == p.id:
        raise ApiError(422, "CANNOT_REMOVE_SELF", "Leave the room instead")
    db.delete(target)
    db.merge(RoomKick(room_code=room.code, player_id=target.player_id))
    db.commit()
    return view(db, room)


def mark_started(db: Session, code: str) -> None:
    """From the match server when play begins (first start or a rematch): the room stops accepting joins."""
    room = _find(db, code)
    if room is None:
        raise room_not_found()
    if room.status in ("open", "finished"):
        seated = [s.player_id for s in _seats(db, room)]
        for i, pid in enumerate(seated):
            if blocked_pair_exists(db, pid, seated[i + 1:]):
                raise blocked_error()
    result = db.execute(update(Room).where(Room.code == room.code, Room.status.in_(("open", "finished")))
                        .values(status="playing", status_changed_at=now()).execution_options(synchronize_session=False))
    db.commit()
    if result.rowcount:
        return
    status = db.scalar(select(Room.status).where(Room.code == room.code))
    if status != "playing":
        raise conflict("ROOM_CLOSED", "This room has closed")


def mark_finished(db: Session, code: str) -> None:
    db.execute(update(Room).where(Room.code == code, Room.status == "playing").values(status="finished", status_changed_at=now())
               .execution_options(synchronize_session=False))


def _expired(settings: Settings, at: datetime):
    return or_(
        and_(Room.status == "open", Room.expires_at <= at),
        and_(Room.status == "playing", Room.status_changed_at <= at - timedelta(minutes=settings.room_playing_max_minutes)),
        and_(Room.status == "finished", Room.status_changed_at <= at - timedelta(minutes=settings.room_finished_idle_minutes)),
    )


def expire_old(db: Session, settings: Settings, at: datetime | None = None, batch: int = 500) -> int:
    cutoff = at or now()
    codes = list(db.scalars(select(Room.code).where(_expired(settings, cutoff)).limit(batch)))
    if not codes:
        return 0
    r = db.execute(update(Room).where(Room.code.in_(codes), _expired(settings, cutoff)).values(status="expired", status_changed_at=cutoff)
                   .execution_options(synchronize_session=False))
    db.commit()
    return int(r.rowcount or 0)


def purge_expired(db: Session, settings: Settings, at: datetime | None = None, batch: int = 500) -> int:
    """Retention: rooms expired more than ROOM_RETENTION_DAYS ago, with seats, kicks and stale directory rows.
    Matches, hands and input records are kept (verification); they reference the code, not the row."""
    cutoff = (at or now()) - timedelta(days=settings.room_retention_days)
    codes = list(db.scalars(select(Room.code).where(Room.status == "expired", Room.status_changed_at <= cutoff).limit(batch)))
    if not codes:
        return 0
    ns = {"synchronize_session": False}
    db.execute(delete(RoomKick).where(RoomKick.room_code.in_(codes)).execution_options(**ns))
    db.execute(delete(RoomSeat).where(RoomSeat.room_code.in_(codes)).execution_options(**ns))
    db.execute(delete(RoomDirectory).where(RoomDirectory.room_code.in_(codes), RoomDirectory.lease_until < now()).execution_options(**ns))
    db.execute(update(MatchmakingTicket).where(MatchmakingTicket.room_code.in_(codes)).values(state="expired", room_code=None).execution_options(**ns))
    r = db.execute(delete(Room).where(Room.code.in_(codes), Room.status == "expired").execution_options(**ns))
    db.commit()
    return int(r.rowcount or 0)
