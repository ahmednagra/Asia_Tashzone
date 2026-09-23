"""Rooms, join tokens, voice, kill switch, started/finished lifecycle (ported from v1 + Phase 5 contracts)."""
import base64
import json

import jwt
from conftest import INTERNAL, register


def claims(tok: str) -> dict:
    p = tok.split(".")[0]
    return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))


def make_room(client, h, profile="callbreak.np@1", **settings):
    r = client.post("/api/v1/rooms", json={"profile_id": profile, "settings": settings}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_validates_settings_and_issues_join_token(client):
    _, h = register(client)
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1", "settings": {"rounds": 7}}, headers=h).status_code == 422
    assert client.post("/api/v1/rooms", json={"profile_id": "nope@1"}, headers=h).status_code == 422
    d = make_room(client, h, rounds=3, relaxed_play=True)
    c = claims(d["join_token"])
    assert c["seat"] == 0 and c["host"] is True and c["settings"] == {"rounds": 3, "relaxed_play": True}
    assert c["origin"] == "code" and c["free_text"] is True and c["quick_chat"] is True and c["voice"] is False  # voice not configured
    assert len(d["room_code"]) == 6 and not set(d["room_code"]) & set("01OIL")
    assert d["room"]["status"] == "open" and d["room"]["members"][0]["seat"] == 0


def test_join_rejoin_capacity_and_blocks_both_ways(client):
    _, hh = register(client, "Host")
    code = make_room(client, hh)["room_code"]
    seats = []
    for i in range(3):
        _, h = register(client, f"P{i}")
        seats.append(client.post(f"/api/v1/rooms/{code}/join", headers=h).json()["seat"])
        assert client.post(f"/api/v1/rooms/{code}/join", headers=h).json()["seat"] == seats[-1]
    assert seats == [1, 2, 3]
    assert client.post(f"/api/v1/rooms/{code}/join", headers=register(client, "Late")[1]).json()["error"]["code"] == "ROOM_FULL"
    code2 = make_room(client, hh)["room_code"]
    bad, hb = register(client, "Blocked")
    client.post("/api/v1/players/me/blocks", json={"player_id": bad}, headers=hh)
    assert client.post(f"/api/v1/rooms/{code2}/join", headers=hb).json()["error"]["code"] == "BLOCKED"
    # the blocked player hosting: the blocker cannot join them either
    code3 = make_room(client, hb)["room_code"]
    assert client.post(f"/api/v1/rooms/{code3}/join", headers=hh).status_code == 403
    assert client.post("/api/v1/rooms/ZZZZZZ/join", headers=hh).json()["error"]["code"] == "ROOM_NOT_FOUND"


def test_leave_passes_host_and_kick_prevents_rejoin(client):
    _, hh = register(client, "Host")
    code = make_room(client, hh)["room_code"]
    _, h1 = register(client, "One")
    _, h2 = register(client, "Two")
    client.post(f"/api/v1/rooms/{code}/join", headers=h1)
    client.post(f"/api/v1/rooms/{code}/join", headers=h2)
    assert client.delete(f"/api/v1/rooms/{code}/members/2", headers=h1).json()["error"]["code"] == "NOT_HOST"
    assert client.delete(f"/api/v1/rooms/{code}/members/0", headers=hh).json()["error"]["code"] == "CANNOT_REMOVE_SELF"
    assert [m["seat"] for m in client.delete(f"/api/v1/rooms/{code}/members/2", headers=hh).json()["members"]] == [0, 1]
    assert client.post(f"/api/v1/rooms/{code}/join", headers=h2).json()["error"]["code"] == "ROOM_NOT_FOUND"
    assert client.post(f"/api/v1/rooms/{code}/leave", headers=hh).status_code == 204
    assert client.get(f"/api/v1/rooms/{code}", headers=h1).json()["host_seat"] == 1
    assert client.get(f"/api/v1/rooms/{code}", headers=hh).status_code == 404


def test_bhabhi_seats_by_player_count_and_handicap_refused(client):
    _, hh = register(client, "Host")
    six = make_room(client, hh, "bhabhi.tz@1", players=6)["room_code"]
    seats = [client.post(f"/api/v1/rooms/{six}/join", headers=register(client, f"B{i}")[1]).json()["seat"] for i in range(5)]
    assert seats == [1, 2, 3, 4, 5]
    assert client.post(f"/api/v1/rooms/{six}/join", headers=register(client, "Late")[1]).status_code == 409
    r = client.post("/api/v1/rooms", json={"profile_id": "bhabhi.tz@1", "settings": {"handicap": 3}}, headers=hh)
    assert r.status_code == 422 and r.json()["error"]["code"] == "HANDICAP_OFFLINE_ONLY"
    assert client.post("/api/v1/rooms", json={"profile_id": "bhabhi.tz@1", "settings": {"players": 8, "decks": 1}}, headers=hh).status_code == 422
    make_room(client, hh, "bhabhi.tz@1", players=8)
    assert client.post("/api/v1/rooms", json={"profile_id": "courtpiece.tz@1", "preset": "double-ace", "settings": {"target_points": 5}}, headers=hh).status_code == 201


def test_started_closes_joins_and_results_finish_the_room(client):
    p0, hh = register(client, "Host")
    code = make_room(client, hh)["room_code"]
    assert client.post(f"/api/v1/internal/rooms/{code}/started").status_code == 401
    assert client.post(f"/api/v1/internal/rooms/{code}/started", headers=INTERNAL).status_code == 204
    assert client.post(f"/api/v1/internal/rooms/{code}/started", headers=INTERNAL).status_code == 204  # idempotent
    assert client.post(f"/api/v1/rooms/{code}/join", headers=register(client, "Late")[1]).status_code == 404
    body = {"match_id": "mx", "room": code, "epoch": 1, "profile_id": "callbreak.np@1", "effective_profile_hash": "a" * 64,
            "engine_build_hash": "b" * 64, "outcome": "completed", "totals": [40, 10, -20, 5], "placements": [1, 2, 4, 3],
            "players": [p0, None, None, None], "bot_seats": [1, 2, 3], "sealed_hand_ids": ["h1"]}
    assert client.post("/api/v1/internal/results", json=body, headers=INTERNAL).status_code == 201
    assert client.post("/api/v1/internal/results", json=body, headers=INTERNAL).json()["error"]["code"] == "DUPLICATE"
    assert client.post("/api/v1/internal/results", json={**body, "match_id": "old", "epoch": 0}, headers=INTERNAL).json()["error"]["code"] == "STALE_EPOCH"
    assert client.get(f"/api/v1/rooms/{code}", headers=hh).json()["status"] == "finished"
    assert client.post(f"/api/v1/internal/rooms/{code}/started", headers=INTERNAL).status_code == 204  # rematch


def test_voice_tokens_are_gated_by_origin_parental_mute_and_configuration(client, env, db_session):
    pid, h = register(client, "Host")
    code = make_room(client, h)["room_code"]
    assert client.post(f"/api/v1/rooms/{code}/voice", headers=h).json()["error"]["code"] == "NOT_CONFIGURED"
    env(LIVEKIT_URL="wss://voice.example", LIVEKIT_API_KEY="key1", LIVEKIT_API_SECRET="s" * 40)
    v = client.post(f"/api/v1/rooms/{code}/voice", headers=h).json()
    decoded = jwt.decode(v["token"], "s" * 40, algorithms=["HS256"])
    assert decoded["video"]["room"] == code and decoded["sub"] == pid and decoded["video"]["canPublishSources"] == ["microphone"]
    assert claims(client.post(f"/api/v1/rooms/{code}/join", headers=h).json()["join_token"])["voice"] is True
    # protected player whose parent switched voice off
    _, hk = register(client, "Kid", adult=False)
    client.post(f"/api/v1/rooms/{code}/join", headers=hk)
    client.put("/api/v1/players/me/parental", json={"voice": False}, headers=hk)
    assert client.post(f"/api/v1/rooms/{code}/voice", headers=hk).json()["error"]["code"] == "VOICE_OFF"
    # a muted player
    from app.Services.SanctionService import create_sanction
    from config.settings import get_settings
    mute, hm = register(client, "Loud")
    client.post(f"/api/v1/rooms/{code}/join", headers=hm)
    create_sanction(db_session, get_settings(), subject=mute, kind="chat_muted", reason="abuse", moderator=None)
    assert client.post(f"/api/v1/rooms/{code}/voice", headers=hm).json()["error"]["code"] == "CHAT_MUTED"
    assert claims(client.post(f"/api/v1/rooms/{code}/join", headers=hm).json()["join_token"])["free_text"] is False
    env(DISABLED_FEATURES="voice")
    assert client.post(f"/api/v1/rooms/{code}/voice", headers=h).json()["error"]["code"] == "FEATURE_DISABLED"


def test_kill_switch_and_disabled_profiles(client, env):
    _, h = register(client)
    env(ONLINE_ENABLED="false", MAINTENANCE_MESSAGE_EN="Back at 6 pm")
    r = client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h)
    assert r.status_code == 503 and r.json()["error"] == {"code": "ONLINE_DISABLED", "message": "Back at 6 pm"}
    cfg = client.get("/api/v1/app-config").json()
    assert cfg["online"] == {"enabled": False, "disabled_profiles": [], "message": {"en": "Back at 6 pm"}}
    assert cfg["features"]["quick_match"] is False
    env(ONLINE_ENABLED="true", DISABLED_PROFILES="bhabhi.tz@1")
    assert client.post("/api/v1/rooms", json={"profile_id": "bhabhi.tz@1"}, headers=h).json()["error"]["code"] == "GAME_DISABLED"
    assert client.post("/api/v1/rooms", json={"profile_id": "courtpiece.tz@1"}, headers=h).status_code == 201
    assert client.get("/api/v1/app-config").json()["profiles"]["bhabhi.tz@1"]["online"] is False


def test_app_config_update_fields_and_catalogue(client, env):
    cfg = client.get("/api/v1/app-config").json()
    assert cfg["latest"] is None and cfg["protocol"] == {"min": 2, "max": 2}
    assert set(cfg["profiles"]) == {"callbreak.np@1", "callbridge.bd@1", "courtpiece.tz@1", "bhabhi.tz@1"}
    assert cfg["profiles"]["courtpiece.tz@1"]["default_preset"] == "double"
    env(APP_LATEST_VERSION="2.1.0", APP_LATEST_VERSION_CODE=21, APP_DOWNLOAD_URL="https://api.example/download/tashzone.apk",
        APP_DOWNLOAD_SHA256="ab" * 32, APP_DOWNLOAD_SIZE_BYTES=4242, APP_RELEASE_NOTES_UR="نیا ورژن", MIN_VERSION_CODE=18)
    cfg = client.get("/api/v1/app-config").json()
    assert cfg["latest"] == {"version": "2.1.0", "version_code": 21, "download_url": "https://api.example/download/tashzone.apk",
                             "sha256": "ab" * 32, "size_bytes": 4242, "notes": {"ur": "نیا ورژن"}}
    assert cfg["min_version_code"] == 18
    games = {g["profile_id"]: g for g in client.get("/api/v1/catalogue").json()["games"]}
    assert games["bhabhi.tz@1"]["seat_counts"] == [3, 4, 5, 6, 7, 8] and games["callbreak.np@1"]["seat_counts"] == [4]
