"""Finished online matches reported by the match server: accepted once per match id, refused from an older owner
epoch (C-27); per-seat outcomes for history and online stats per profile."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.Core.errors import conflict
from app.Models import Match, MatchPlayer, PlayerStat
from app.Services import RoomService


def record_result(db: Session, body: dict) -> None:
    if db.get(Match, body["match_id"]):
        raise conflict("DUPLICATE", "Result already recorded")
    newest = db.scalar(select(func.max(Match.epoch)).where(Match.room_code == body["room"]))
    if newest is not None and body["epoch"] < newest:
        raise conflict("STALE_EPOCH", "A newer owner already reported this room")
    db.add(Match(**{k: v for k, v in body.items() if k != "room"}, room_code=body["room"]))
    db.flush()
    for seat, pid in enumerate(body["players"]):
        human = pid is not None and seat not in body["bot_seats"]
        db.add(MatchPlayer(match_id=body["match_id"], seat=seat, kind="human" if human else "bot", player_id=pid if human else None,
                           placement=body["placements"][seat] if body["placements"] else None,
                           score=body["totals"][seat] if seat < len(body["totals"]) else None))
        if not human:
            continue
        st = db.get(PlayerStat, (pid, body["profile_id"])) or PlayerStat(player_id=pid, profile_id=body["profile_id"], played=0, wins=0, interrupted=0)
        if body["outcome"] == "completed":
            st.played += 1
            if body["placements"] and body["placements"][seat] == 1:
                st.wins += 1
        else:
            st.interrupted += 1
        db.add(st)
    RoomService.mark_finished(db, body["room"])
    db.commit()
