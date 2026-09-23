"""Quick Match: first-come pairing, bot backfill, idempotent queue, strangers get no free text or voice (v1)."""
import base64
import json

from conftest import register


def claims(tok):
    p = tok.split(".")[0]
    return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))


def q(client, h, profile="callbreak.np@1", seats=4):
    return client.post("/api/v1/matchmaking/queue", json={"profile_id": profile, "seats": seats}, headers=h).json()


def test_four_players_are_paired_into_one_quick_match_room(client):
    hs = [register(client, f"Q{i}")[1] for i in range(4)]
    first = [q(client, h) for h in hs[:3]]
    assert [t["status"] for t in first] == ["waiting"] * 3 and first[0]["position"] == 1 and first[2]["position"] == 3
    last = q(client, hs[3])
    assert last["status"] == "matched"
    joins = [client.get("/api/v1/matchmaking/ticket", headers=h).json()["join"] for h in hs]
    assert len({j["room_code"] for j in joins}) == 1 and sorted(j["seat"] for j in joins) == [0, 1, 2, 3]
    c = claims(joins[0]["join_token"])
    assert c["origin"] == "quick_match" and c["free_text"] is False and c["voice"] is False and c["quick_chat"] is True
    assert c["preset"] == "classic"  # the app-default preset of callbreak.np@1


def test_queue_is_idempotent_and_leaving_is_never_an_error(client):
    _, h = register(client)
    a = q(client, h)
    b = q(client, h)
    assert a["position"] == b["position"] == 1
    assert client.delete("/api/v1/matchmaking/queue", headers=h).status_code == 204
    assert client.delete("/api/v1/matchmaking/queue", headers=h).status_code == 204
    assert client.get("/api/v1/matchmaking/ticket", headers=h).json()["error"]["code"] == "TICKET_NOT_FOUND"


def test_bots_backfill_after_the_wait(client, env):
    env(MATCHMAKING_BOT_BACKFILL_SECONDS=0)
    _, h = register(client)
    t = q(client, h, "courtpiece.tz@1")
    assert t["status"] == "matched"
    room = t["join"]["room"]
    assert room["origin"] == "quick_match" and room["preset"] == "double" and len(room["members"]) == 1


def test_bhabhi_table_size_and_invalid_sizes(client, env):
    env(MATCHMAKING_BOT_BACKFILL_SECONDS=0)
    _, h = register(client)
    t = q(client, h, "bhabhi.tz@1", 6)
    assert t["status"] == "matched" and t["join"]["room"]["seats"] == 6 and t["join"]["room"]["settings"] == {"players": 6}
    _, h2 = register(client, "B")
    assert client.post("/api/v1/matchmaking/queue", json={"profile_id": "callbreak.np@1", "seats": 6}, headers=h2).json()["error"]["code"] == "INVALID_PLAYER_COUNT"


def test_blocked_and_sanctioned_candidates_are_skipped(client, db_session):
    from app.Services.SanctionService import create_sanction
    from config.settings import get_settings
    a, ha = register(client, "A")
    b, hb = register(client, "B")
    c, hc = register(client, "C")
    d, hd = register(client, "D")
    e, he = register(client, "E")
    client.post("/api/v1/players/me/blocks", json={"player_id": b}, headers=ha)
    q(client, ha)
    q(client, hb)
    q(client, hc)
    create_sanction(db_session, get_settings(), subject=c, kind="online_suspended", reason="abuse", moderator=None)
    q(client, hd)
    t = q(client, he)  # E's pass: A (oldest) seated first, B blocked by A skipped, C suspended skipped → not full yet
    assert t["status"] == "waiting"


def test_quick_match_can_be_switched_off(client, env):
    _, h = register(client)
    env(DISABLED_FEATURES="quick_match")
    assert client.post("/api/v1/matchmaking/queue", json={"profile_id": "callbreak.np@1"}, headers=h).json()["error"]["code"] == "FEATURE_DISABLED"
