"""Online tables need a signed-in player; guests keep offline play. Sign-up prompt rules come from app-config."""
from conftest import register
from test_accounts import mail, signed_up  # noqa: F401  (fixture)
from test_players import FakeVerifier


def gate_on(env):
    env(ONLINE_REQUIRES_ACCOUNT="true", MAIL_BACKEND="console")  # the gate needs a way to sign up


def code_of(r):
    return r.json()["error"]["code"]


def test_guests_cannot_create_join_or_queue(client, env):
    gate_on(env)
    _, h = register(client, "Guest")
    r = client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h)
    assert r.status_code == 403 and code_of(r) == "ACCOUNT_REQUIRED"
    r = client.post("/api/v1/rooms/BK7Q2M/join", headers=h)
    assert r.status_code == 403 and code_of(r) == "ACCOUNT_REQUIRED"
    r = client.post("/api/v1/matchmaking/queue", json={"profile_id": "callbreak.np@1", "seats": 4}, headers=h)
    assert r.status_code == 403 and code_of(r) == "ACCOUNT_REQUIRED"


def test_a_guest_who_links_google_plays_online_as_the_same_player(client, env, monkeypatch):
    import app.Services.IdentityService as ids
    gate_on(env)
    monkeypatch.setattr(ids, "get_verifier", lambda provider: FakeVerifier(provider))
    pid, h = register(client, "Asha")
    assert client.post("/api/v1/players/me/link", json={"provider": "google", "id_token": "sub-9"}, headers=h).status_code == 200
    r = client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h)
    assert r.status_code == 201, r.text
    _, h2 = register(client, "Bilal")
    assert code_of(client.post(f"/api/v1/rooms/{r.json()['room_code']}/join", headers=h2)) == "ACCOUNT_REQUIRED"


def test_an_email_account_plays_online(client, env, mail):  # noqa: F811
    gate_on(env)
    _, signed = signed_up(client, mail)
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=signed).status_code == 201


def test_unlinking_the_last_identity_closes_online_again(client, env, monkeypatch):
    import app.Services.IdentityService as ids
    gate_on(env)
    monkeypatch.setattr(ids, "get_verifier", lambda provider: FakeVerifier(provider))
    _, h = register(client, "Asha")
    client.post("/api/v1/players/me/link", json={"provider": "google", "id_token": "sub-3"}, headers=h)
    client.delete("/api/v1/players/me/link/google", headers=h)
    assert code_of(client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h)) == "ACCOUNT_REQUIRED"


def test_no_sign_in_method_means_no_gate(client, env):
    env(ONLINE_REQUIRES_ACCOUNT="true", MAIL_BACKEND="disabled")
    _, h = register(client, "Guest")
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h).status_code == 201
    assert client.get("/api/v1/app-config").json()["online"]["requires_account"] is False


def test_switching_the_requirement_off_lets_guests_in(client, env):
    env(ONLINE_REQUIRES_ACCOUNT="false")
    _, h = register(client, "Guest")
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h).status_code == 201


def test_app_config_carries_the_gate_and_the_prompt_rules(client, env):
    gate_on(env)
    env(SIGNUP_COOLDOWN_GAMES="3, 10, x, 999", SIGNUP_COOLDOWN_DAYS="", SIGNUP_PLAY_MINUTES="0")
    cfg = client.get("/api/v1/app-config").json()
    assert cfg["online"]["requires_account"] is True
    sp = cfg["signup_prompt"]
    assert sp["enabled"] is True and sp["first_after_games"] == 3 and sp["max_sheets"] == 3 and sp["card_max_views"] == 10
    assert sp["cooldown_games"] == [3, 10, 100]  # unreadable parts dropped, values clamped
    assert sp["cooldown_days"] == [0] and sp["play_minutes"] == 0
