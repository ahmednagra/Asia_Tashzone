"""Players: registration (Protected Mode), profile, Parent Settings with PIN, stats and history, deletion (v1 PlayerService)."""
import base64
import binascii
import hashlib
import hmac
import secrets
from datetime import datetime

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.Core.enforcement import aware
from app.Core.errors import ApiError, unprocessable
from app.Models import (
    AuthCode,
    Block,
    Feedback,
    Match,
    MatchmakingTicket,
    MatchPlayer,
    ParentalSettings,
    Player,
    PlayerAccount,
    PlayerIdentity,
    PlayerProgress,
    PlayerSession,
    PlayerStat,
    Report,
    ReportEvidence,
    RoomSeat,
    now,
)
from app.Services import SessionService
from config.settings import Settings

ADULT_AGE = 18


def protected_from_birth_year(birth_year: int | None, today: datetime | None = None) -> bool:
    """Protected unless certainly 18+: only the year is known, so `year - 18` may still be 17. Unknown → protected."""
    if birth_year is None:
        return True
    return (today or now()).year - birth_year <= ADULT_AGE


def register(db: Session, settings: Settings, display_name: str, avatar_id: int, birth_year: int | None, protected: bool | None) -> tuple[Player, str]:
    if protected is None:
        prot = protected_from_birth_year(birth_year)
    elif birth_year is None:
        prot = protected
    else:
        prot = protected or protected_from_birth_year(birth_year)
    p = Player(display_name=display_name.strip(), avatar_id=avatar_id, protected=prot, token_generation=1)
    db.add(p)
    db.flush()  # the player row must exist before rows that reference it
    db.add(ParentalSettings(player_id=p.id))
    db.commit()
    return p, SessionService.issue(db, settings, p)


def parental(db: Session, p: Player) -> ParentalSettings:
    ps = db.get(ParentalSettings, p.id)
    if ps is None:
        ps = ParentalSettings(player_id=p.id)
        db.add(ps)
        db.commit()
    return ps


def effective(p: Player, ps: ParentalSettings | None, switch: str) -> bool:
    """Parent Settings bind protected players only; an adult's switches are preferences the app applies itself."""
    if not p.protected:
        return True
    return bool(getattr(ps, switch)) if ps is not None else True


def _hash_pin(pin: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(8)
    return f"{salt}${hashlib.pbkdf2_hmac('sha256', pin.encode(), salt.encode(), 100_000).hex()}"


def _pin_ok(stored: str, pin: str) -> bool:
    salt = stored.split("$", 1)[0]
    return hmac.compare_digest(_hash_pin(pin, salt), stored)
SWITCHES = ("online_play", "same_wifi", "quick_messages", "reactions", "free_text_chat", "voice")


def set_parental(db: Session, p: Player, values: dict, pin: str | None, new_pin: str | None) -> ParentalSettings:
    """A PIN, once set, is required to change anything (the app also locks after 5 wrong tries for 1 minute)."""
    ps = parental(db, p)
    if ps.pin_hash and (pin is None or not _pin_ok(ps.pin_hash, pin)):
        raise ApiError(403, "PIN_REQUIRED", "The parent PIN is not correct")
    for k in SWITCHES:
        if k in values and values[k] is not None:
            setattr(ps, k, bool(values[k]))
    if new_pin is not None:
        ps.pin_hash = _hash_pin(new_pin) if new_pin else None
    ps.updated_at = now()
    db.commit()
    return ps


def parental_view(ps: ParentalSettings) -> dict:
    return {**{k: getattr(ps, k) for k in SWITCHES}, "pin_set": ps.pin_hash is not None}


def update_profile(db: Session, p: Player, display_name: str | None, avatar_id: int | None) -> Player:
    if display_name is not None:
        p.display_name = display_name.strip()
    if avatar_id is not None:
        p.avatar_id = avatar_id
    p.last_seen_at = now()
    db.commit()
    return p


def stats(db: Session, p: Player) -> list[dict]:
    rows = db.scalars(select(PlayerStat).where(PlayerStat.player_id == p.id).order_by(PlayerStat.profile_id))
    return [{"profile_id": s.profile_id, "played": s.played, "wins": s.wins, "interrupted": s.interrupted} for s in rows]


def _encode_cursor(at: datetime, match_id: str) -> str:
    return base64.urlsafe_b64encode(f"{aware(at).isoformat()}|{match_id}".encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()
        stamp, match_id = raw.split("|", 1)
        return aware(datetime.fromisoformat(stamp)), match_id
    except (ValueError, UnicodeDecodeError, binascii.Error) as exc:
        raise unprocessable("INVALID_CURSOR", "The page cursor is not valid") from exc


def history(db: Session, p: Player, limit: int, cursor: str | None) -> dict:
    """Newest first, keyset-paginated on (created_at, match_id)."""
    limit = max(1, min(limit, 50))
    stmt = (select(MatchPlayer.seat, MatchPlayer.placement, MatchPlayer.score, Match.match_id, Match.profile_id, Match.created_at, Match.outcome, Match.players)
            .join(Match, Match.match_id == MatchPlayer.match_id).where(MatchPlayer.player_id == p.id))
    if cursor:
        before, before_id = _decode_cursor(cursor)
        stmt = stmt.where(or_(Match.created_at < before, and_(Match.created_at == before, Match.match_id < before_id)))
    rows = db.execute(stmt.order_by(Match.created_at.desc(), Match.match_id.desc()).limit(limit + 1)).all()
    page = rows[:limit]
    items = [{"match_id": r.match_id, "profile_id": r.profile_id, "played_at": aware(r.created_at), "players": len(r.players),
              "seat": r.seat, "placement": r.placement, "won": r.placement == 1, "score": r.score, "outcome": r.outcome} for r in page]
    return {"items": items, "next_cursor": _encode_cursor(page[-1].created_at, page[-1].match_id) if len(rows) > limit else None}


def delete_player(db: Session, p: Player) -> None:
    """Soft-delete, anonymise, revoke every token, and remove everything that is theirs alone: feedback, their block
    list, reports they filed (and any evidence), progress, identities, tickets, open seats, stats and Parent Settings.
    Sealed hands and match results keep only anonymous seat data."""
    account = db.get(PlayerAccount, p.id)
    if account is not None:
        db.execute(delete(AuthCode).where(AuthCode.email == account.email).execution_options(synchronize_session=False))
    for stmt in (
        delete(PlayerAccount).where(PlayerAccount.player_id == p.id),
        delete(PlayerSession).where(PlayerSession.player_id == p.id),
        delete(Feedback).where(Feedback.player_id == p.id),
        delete(MatchmakingTicket).where(MatchmakingTicket.player_id == p.id),
        delete(Block).where(Block.player_id == p.id),
        delete(ReportEvidence).where(ReportEvidence.report_id.in_(select(Report.id).where(Report.reporter_id == p.id))),
        delete(PlayerIdentity).where(PlayerIdentity.player_id == p.id),
        delete(PlayerProgress).where(PlayerProgress.player_id == p.id),
        delete(PlayerStat).where(PlayerStat.player_id == p.id),
        delete(ParentalSettings).where(ParentalSettings.player_id == p.id),
    ):
        db.execute(stmt.execution_options(synchronize_session=False))
    db.execute(delete(RoomSeat).where(RoomSeat.player_id == p.id).execution_options(synchronize_session=False))
    p.display_name = "Deleted Player"
    p.token_generation += 1
    p.deleted_at = now()
    db.commit()
