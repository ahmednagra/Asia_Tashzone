"""Players: Protected Mode, profile, Parent Settings + PIN, progress sync, deletion, account linking (ported from v1)."""
import base64
import json

from conftest import INTERNAL, register


def claims(tok: str) -> dict:
    p = tok.split(".")[0]
    return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))


def test_health_request_id_and_auth(client):
    r = client.get("/health", headers={"x-request-id": "abc12345-req"})
    assert r.json()["ok"] is True and r.headers["x-request-id"] == "abc12345-req"
    assert client.get("/api/v1/players/me").json()["error"]["code"] == "UNAUTHORIZED"
    assert client.get("/api/v1/players/me", headers={"Authorization": "Bearer x.y"}).status_code == 401


def test_protected_mode_from_birth_year_and_never_stored(client):
    adult, ha = register(client, "Adult", adult=True)
    child, hc = register(client, "Kid", adult=False)
    unknown = client.post("/api/v1/players", json={"display_name": "Anon"}).json()
    assert client.get("/api/v1/players/me", headers=ha).json()["protected"] is False
    assert client.get("/api/v1/players/me", headers=hc).json()["protected"] is True
    assert unknown["protected"] is True
    # "18 this year" may still be 17: protected
    from datetime import datetime

    from app.Services.PlayerService import protected_from_birth_year
    assert protected_from_birth_year(2008, datetime(2026, 6, 1)) is True
    assert protected_from_birth_year(2007, datetime(2026, 6, 1)) is False
    me = client.get("/api/v1/players/me", headers=ha).json()
    assert "birth_year" not in json.dumps(me)


def test_profile_update_and_validation(client):
    _, h = register(client)
    r = client.patch("/api/v1/players/me", json={"display_name": "Ahmed", "avatar_id": 7}, headers=h).json()
    assert r["display_name"] == "Ahmed" and r["avatar_id"] == 7
    bad = client.patch("/api/v1/players/me", json={"display_name": ""}, headers=h)
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "INVALID_REQUEST"


def test_parental_settings_with_pin(client):
    _, h = register(client, adult=False)
    p = client.get("/api/v1/players/me/parental", headers=h).json()
    assert p == {"online_play": True, "same_wifi": True, "quick_messages": True, "reactions": True, "free_text_chat": True, "voice": True, "pin_set": False}
    r = client.put("/api/v1/players/me/parental", json={"voice": False, "new_pin": "1234"}, headers=h).json()
    assert r["voice"] is False and r["pin_set"] is True
    assert client.put("/api/v1/players/me/parental", json={"voice": True}, headers=h).json()["error"]["code"] == "PIN_REQUIRED"
    assert client.put("/api/v1/players/me/parental", json={"voice": True, "pin": "9999"}, headers=h).status_code == 403
    assert client.put("/api/v1/players/me/parental", json={"voice": True, "pin": "1234"}, headers=h).json()["voice"] is True
    assert client.put("/api/v1/players/me/parental", json={"pin": "1234", "new_pin": ""}, headers=h).json()["pin_set"] is False


def test_protected_player_with_online_off_cannot_create_rooms_but_adult_switches_do_not_bind(client):
    _, hc = register(client, adult=False)
    client.put("/api/v1/players/me/parental", json={"online_play": False}, headers=hc)
    r = client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=hc)
    assert r.status_code == 403 and r.json()["error"]["code"] == "ONLINE_ROOMS_OFF"
    _, ha = register(client, adult=True)
    client.put("/api/v1/players/me/parental", json={"online_play": False}, headers=ha)
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=ha).status_code == 201


PROGRESS = {"xp": 200, "matches": 10, "wins": 4, "hands_played": 50, "first_out": 5, "times_bhabhi": 3, "best_streak": 2,
            "badges": ["first-match", "first-win", "ten-matches", "three-streak"], "games": {"bhabhi": {"matches": 6, "wins": 2, "hands_played": 30}}}


def test_progress_sync_bounds_rederives_badges_and_takes_maxima(client):
    _, h = register(client)
    empty = client.get("/api/v1/players/me/progress", headers=h).json()
    assert empty["xp"] == 0 and empty["level"] == 1
    r = client.put("/api/v1/players/me/progress", json=PROGRESS, headers=h).json()
    assert r["level"] == 3 and r["titles"] == [1, 3]
    assert r["badges"] == ["first-match", "first-win", "ten-matches"]  # three-streak not justified by best_streak 2
    # a second device with a different offline week: per-counter maximum, nothing lost or counted twice
    other = {**PROGRESS, "xp": 150, "matches": 12, "wins": 3, "best_streak": 3, "badges": ["three-streak"], "games": {"callbreak": {"matches": 4, "wins": 1, "hands_played": 20}}}
    r2 = client.put("/api/v1/players/me/progress", json=other, headers=h).json()
    assert (r2["xp"], r2["matches"], r2["wins"], r2["best_streak"]) == (200, 12, 4, 3)
    assert "three-streak" in r2["badges"] and set(r2["games"]) == {"bhabhi", "callbreak"}
    assert client.put("/api/v1/players/me/progress", json=other, headers=h).json() | {"updated_at": 0} == r2 | {"updated_at": 0}  # idempotent


def test_progress_refuses_impossible_claims(client):
    _, h = register(client)
    for bad, code in (({**PROGRESS, "wins": 11}, "INVALID_PROGRESS"), ({**PROGRESS, "xp": 10_000}, "INVALID_PROGRESS"),
                      ({**PROGRESS, "badges": ["gold-crown"]}, "UNKNOWN_BADGE"),
                      ({**PROGRESS, "games": {"bhabhi": {"matches": 20, "wins": 1, "hands_played": 1}}}, "INVALID_PROGRESS")):
        r = client.put("/api/v1/players/me/progress", json=bad, headers=h)
        assert r.status_code == 422 and r.json()["error"]["code"] == code
    assert client.put("/api/v1/players/me/progress", json={**PROGRESS, "xp": -1}, headers=h).status_code == 422


def test_delete_revokes_tokens_and_removes_personal_data(client, db_session):
    from app.Models import Feedback, PlayerProgress
    pid, h = register(client)
    client.put("/api/v1/players/me/progress", json=PROGRESS, headers=h)
    client.post("/api/v1/feedback", json={"category": "idea", "text": "more games"}, headers=h)
    assert client.delete("/api/v1/players/me", headers=h).status_code == 204
    assert client.get("/api/v1/players/me", headers=h).status_code == 401
    assert db_session.get(PlayerProgress, pid) is None
    assert db_session.query(Feedback).filter_by(player_id=pid).count() == 0


class FakeVerifier:
    def __init__(self, provider): self.provider = provider
    def configured(self): return True
    def verify(self, token, nonce):
        from app.Services.IdentityVerifier import VerifiedIdentity
        return VerifiedIdentity(self.provider, token)


def test_account_linking_restore_and_never_merging(client, monkeypatch):
    import app.Services.IdentityService as ps
    monkeypatch.setattr(ps, "get_verifier", lambda provider: FakeVerifier(provider))
    pid, h = register(client, "Owner")
    assert client.post("/api/v1/players/me/link", json={"provider": "google", "id_token": "sub-1"}, headers=h).status_code == 200
    assert client.post("/api/v1/players/me/link", json={"provider": "google", "id_token": "sub-1"}, headers=h).status_code == 200  # idempotent
    assert client.get("/api/v1/players/me", headers=h).json()["linked_providers"] == ["google"]
    assert client.post("/api/v1/players/me/link", json={"provider": "google", "id_token": "sub-2"}, headers=h).json()["error"]["code"] == "PROVIDER_ALREADY_LINKED"
    _, h2 = register(client, "Other")
    assert client.post("/api/v1/players/me/link", json={"provider": "google", "id_token": "sub-1"}, headers=h2).json()["error"]["code"] == "IDENTITY_ALREADY_LINKED"
    restored = client.post("/api/v1/players/restore", json={"provider": "google", "id_token": "sub-1"}).json()
    assert restored["player_id"] == pid
    assert client.get("/api/v1/players/me", headers={"Authorization": f"Bearer {restored['token']}"}).status_code == 200
    assert client.post("/api/v1/players/restore", json={"provider": "google", "id_token": "nobody"}).json()["error"]["code"] == "IDENTITY_NOT_LINKED"
    client.delete("/api/v1/players/me/link/google", headers=h)
    assert client.post("/api/v1/players/restore", json={"provider": "google", "id_token": "sub-1"}).status_code == 404


def test_unconfigured_provider_is_refused(client):
    _, h = register(client)
    r = client.post("/api/v1/players/me/link", json={"provider": "apple", "id_token": "x"}, headers=h)
    assert r.status_code == 503 and r.json()["error"]["code"] == "PROVIDER_NOT_CONFIGURED"


def test_registration_rate_limit(client, env):
    env(REGISTRATIONS_PER_IP_PER_HOUR=3)
    codes = [client.post("/api/v1/players", json={"display_name": f"P{i}"}).status_code for i in range(4)]
    assert codes == [201, 201, 201, 429]


def test_stats_and_match_history_from_results(client):
    p0, h0 = register(client, "A")
    room = client.post("/api/v1/rooms", json={"profile_id": "courtpiece.tz@1"}, headers=h0).json()["room_code"]
    for i, mid in enumerate(["m1", "m2", "m3"]):
        body = {"match_id": mid, "room": room, "epoch": i + 1, "profile_id": "courtpiece.tz@1", "effective_profile_hash": "a" * 64,
                "engine_build_hash": "b" * 64, "outcome": "completed", "totals": [3, 0, 3, 0], "placements": [1, 2, 1, 2] if i != 1 else [2, 1, 2, 1],
                "players": [p0, None, None, None], "bot_seats": [1, 2, 3], "sealed_hand_ids": ["h1"]}
        assert client.post("/api/v1/internal/results", json=body, headers=INTERNAL).status_code == 201
    assert client.get("/api/v1/players/me/stats", headers=h0).json()["items"] == [{"profile_id": "courtpiece.tz@1", "played": 3, "wins": 2, "interrupted": 0}]
    page1 = client.get("/api/v1/players/me/matches?limit=2", headers=h0).json()
    assert [m["match_id"] for m in page1["items"]] == ["m3", "m2"] and page1["items"][1]["won"] is False
    page2 = client.get(f"/api/v1/players/me/matches?limit=2&cursor={page1['next_cursor']}", headers=h0).json()
    assert [m["match_id"] for m in page2["items"]] == ["m1"] and page2["next_cursor"] is None
    assert client.get("/api/v1/players/me/matches?cursor=%%%", headers=h0).json()["error"]["code"] == "INVALID_CURSOR"
