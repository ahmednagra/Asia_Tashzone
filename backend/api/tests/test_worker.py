"""Room maintenance worker: expiry and retention in bounded batches; audit rows are never deleted."""
from datetime import timedelta

from conftest import register


def test_maintenance_pass_expires_and_purges(client, db_session, env):
    from app.Core.enforcement import now
    from app.Models import Feedback, ModerationAudit, Room, RoomSeat
    from app.Workers.expire_rooms import run_once
    _, h = register(client)
    old = client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h).json()["room_code"]
    fresh = client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h).json()["room_code"]
    room = db_session.get(Room, old)
    room.expires_at = now() - timedelta(minutes=1)
    db_session.add(Feedback(player_id=room.host_player_id, category="bug", created_at=now() - timedelta(days=400)))
    db_session.add(ModerationAudit(action="sanction_created", reason="abuse", created_at=now() - timedelta(days=4000)))
    db_session.commit()
    counts = run_once()
    assert counts["rooms_expired"] == 1 and counts["feedback_purged"] == 1
    db_session.expire_all()
    assert db_session.get(Room, old).status == "expired" and db_session.get(Room, fresh).status == "open"
    db_session.get(Room, old).status_changed_at = now() - timedelta(days=31)
    db_session.commit()
    assert run_once()["rooms_purged"] == 1
    db_session.expire_all()
    assert db_session.get(Room, old) is None and db_session.query(RoomSeat).filter_by(room_code=old).count() == 0
    assert db_session.query(ModerationAudit).count() == 1  # never purged
