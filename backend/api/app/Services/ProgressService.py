"""Durable progress for a player: a convenience sync, never an authority. A PUT is a claim from an untrusted device:
bounded, checked for consistency, badges re-derived, then the higher of stored and claimed kept per counter (v1)."""
from collections.abc import Mapping

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.Core.enforcement import aware
from app.Core.errors import ApiError, unprocessable
from app.Models import Player, PlayerProgress, now

LEVEL_XP = (0, 60, 150, 280, 460, 700, 1000, 1400, 1900, 2500, 3300, 4300, 5500, 7000, 9000)
TITLE_LEVELS = (1, 3, 5, 7, 9, 11, 13)
BADGE_REQUIREMENTS: dict[str, tuple[str, int]] = {
    "first-match": ("matches", 1), "first-win": ("wins", 1), "ten-matches": ("matches", 10), "fifty-matches": ("matches", 50),
    "three-streak": ("best_streak", 3), "quick-escape": ("first_out", 10), "good-sport": ("times_bhabhi", 10), "hundred-hands": ("hands_played", 100),
}
XP_PER_MATCH_CEILING = 46
XP_PER_HAND_CEILING = 2
COUNTERS = ("xp", "matches", "wins", "hands_played", "first_out", "times_bhabhi", "best_streak")
GAME_COUNTERS = ("matches", "wins", "hands_played")


def level_of(xp: int) -> int:
    return sum(1 for need in LEVEL_XP if xp >= need)


def _invalid(message: str) -> ApiError:
    return unprocessable("INVALID_PROGRESS", message)


def _check_claim(body: dict) -> None:
    if body["wins"] > body["matches"]:
        raise _invalid("More wins than games played")
    if body["best_streak"] > body["wins"]:
        raise _invalid("A winning streak longer than the number of wins")
    if body["first_out"] + body["times_bhabhi"] > body["hands_played"]:
        raise _invalid("More hand outcomes than hands played")
    if body["xp"] > XP_PER_MATCH_CEILING * body["matches"] + XP_PER_HAND_CEILING * body["hands_played"]:
        raise _invalid("More XP than that many games and hands can be worth")
    for game, c in body["games"].items():
        if c["wins"] > c["matches"]:
            raise _invalid(f"More wins than games played for {game}")
    for f in GAME_COUNTERS:
        if sum(c[f] for c in body["games"].values()) > body[f]:
            raise _invalid(f"Per-game {f} adds up to more than the total")


def _progress_view(row: PlayerProgress) -> dict:
    level = level_of(row.xp)
    return {**{f: getattr(row, f) for f in COUNTERS}, "level": level, "titles": [t for t in TITLE_LEVELS if level >= t],
            "badges": list(row.badges), "games": dict(row.games), "updated_at": aware(row.updated_at)}


def _empty(player_id: str) -> PlayerProgress:
    return PlayerProgress(player_id=player_id, badges=[], games={}, updated_at=now(), **dict.fromkeys(COUNTERS, 0))


def get_progress(db: Session, p: Player) -> dict:
    return _progress_view(db.get(PlayerProgress, p.id) or _empty(p.id))


def put_progress(db: Session, p: Player, body: dict) -> dict:
    """Bounds and re-derives an untrusted claim, then keeps the higher of stored and claimed, counter by counter
    (idempotent; two devices never lose each other's offline week); badges only when the counters justify them."""
    unknown = sorted(set(body["badges"]) - set(BADGE_REQUIREMENTS))
    if unknown:
        raise unprocessable("UNKNOWN_BADGE", f"Unknown badge ids: {', '.join(unknown[:5])}")
    _check_claim(body)
    for attempt in (1, 2):
        row = db.scalar(select(PlayerProgress).where(PlayerProgress.player_id == p.id).with_for_update())
        created = row is None
        if row is None:
            row = _empty(p.id)
            db.add(row)
        values = {f: max(getattr(row, f), body[f]) for f in COUNTERS}
        for f, v in values.items():
            setattr(row, f, v)
        earned = {b for b in body["badges"] if values[BADGE_REQUIREMENTS[b][0]] >= BADGE_REQUIREMENTS[b][1]}
        row.badges = sorted(set(row.badges) | earned)
        row.games = _merge_games(row.games, body["games"])
        row.updated_at = now()
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if attempt == 2 or not created:
                raise
            continue
        return _progress_view(row)
    raise AssertionError("unreachable")


def _merge_games(stored: dict, submitted: Mapping[str, dict]) -> dict:
    out: dict[str, dict[str, int]] = {}
    for game in sorted(set(stored) | set(submitted)):
        have = stored.get(game) or {}
        claim = submitted.get(game) or {}
        out[game] = {f: max(int(have.get(f, 0)), int(claim.get(f, 0))) for f in GAME_COUNTERS}
    return out
