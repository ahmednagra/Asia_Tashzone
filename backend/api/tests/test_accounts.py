import pytest
from conftest import register

SENT: list[dict] = []


@pytest.fixture()
def mail(env, monkeypatch):
    from app.Services import Mailer

    SENT.clear()
    env(MAIL_BACKEND="console")
    monkeypatch.setattr(Mailer, "send_code", lambda settings, to, purpose, code, lang: SENT.append({"to": to, "purpose": purpose, "code": code, "lang": lang}))
    return SENT


def ask(client, email, purpose, lang="en"):
    r = client.post("/api/v1/auth/email/code", json={"email": email, "purpose": purpose, "lang": lang})
    assert r.status_code == 202 and r.json() == {"sent": True}


def signed_up(client, mail, email="asha@example.com", password="cards2026"):
    pid, h = register(client, "Asha")
    ask(client, email, "signup")
    r = client.post("/api/v1/auth/signup", json={"email": email, "code": mail[-1]["code"], "password": password}, headers=h)
    assert r.status_code == 201, r.text
    return pid, {"Authorization": f"Bearer {r.json()['token']}"}


def test_signup_attaches_email_to_the_guest_and_password_login_returns_the_same_player(client, mail):
    pid, h = signed_up(client, mail, "Asha@Example.com")
    assert mail[-1]["purpose"] == "signup" and mail[-1]["to"] == "asha@example.com"
    assert client.get("/api/v1/players/me", headers=h).json()["email"] == "asha@example.com"
    r = client.post("/api/v1/auth/login", json={"email": "ASHA@example.com", "password": "cards2026"}).json()
    assert r["player_id"] == pid
    assert client.get("/api/v1/players/me", headers={"Authorization": f"Bearer {r['token']}"}).status_code == 200


def test_wrong_password_and_unknown_email_look_the_same(client, mail):
    signed_up(client, mail)
    wrong = client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": "nope12345"})
    unknown = client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "nope12345"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["error"]["code"] == unknown.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_code_requests_never_reveal_whether_an_account_exists(client, mail):
    ask(client, "ghost@example.com", "login")
    ask(client, "ghost@example.com", "reset")
    assert mail == []
    signed_up(client, mail)
    count = len(mail)
    ask(client, "asha@example.com", "signup")
    assert len(mail) == count + 1 and mail[-1]["purpose"] == "login"


def test_code_login_resend_cooldown_and_attempt_cap(client, mail, env):
    pid, _ = signed_up(client, mail)
    env(MAIL_BACKEND="console", AUTH_CODE_RESEND_SECONDS="10")
    ask(client, "asha@example.com", "login")
    before = len(mail)
    ask(client, "asha@example.com", "login")
    assert len(mail) == before
    code = mail[-1]["code"]
    wrong = "000000" if code != "000000" else "111111"
    for _ in range(5):
        assert client.post("/api/v1/auth/login/code", json={"email": "asha@example.com", "code": wrong}).json()["error"]["code"] == "INVALID_CODE"
    assert client.post("/api/v1/auth/login/code", json={"email": "asha@example.com", "code": code}).json()["error"]["code"] == "INVALID_CODE"


def test_code_login_works_once(client, mail):
    pid, _ = signed_up(client, mail)
    ask(client, "asha@example.com", "login")
    code = mail[-1]["code"]
    assert client.post("/api/v1/auth/login/code", json={"email": "asha@example.com", "code": code}).json()["player_id"] == pid
    assert client.post("/api/v1/auth/login/code", json={"email": "asha@example.com", "code": code}).status_code == 400


def test_signup_codes_do_not_work_for_login(client, mail):
    _, h = register(client, "Bilal")
    ask(client, "bilal@example.com", "signup")
    code = mail[-1]["code"]
    assert client.post("/api/v1/auth/login/code", json={"email": "bilal@example.com", "code": code}).status_code == 400


def test_password_reset_revokes_old_sessions(client, mail):
    _, old = signed_up(client, mail)
    ask(client, "asha@example.com", "reset")
    r = client.post("/api/v1/auth/password/reset", json={"email": "asha@example.com", "code": mail[-1]["code"], "new_password": "fresh2027"})
    assert r.status_code == 200
    assert client.get("/api/v1/players/me", headers=old).status_code == 401
    assert client.get("/api/v1/players/me", headers={"Authorization": f"Bearer {r.json()['token']}"}).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": "fresh2027"}).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": "cards2026"}).status_code == 401


def test_change_password_needs_the_current_one(client, mail):
    _, h = signed_up(client, mail)
    bad = client.put("/api/v1/auth/password", json={"current_password": "wrong999", "new_password": "fresh2027"}, headers=h)
    assert bad.status_code == 401
    ok = client.put("/api/v1/auth/password", json={"current_password": "cards2026", "new_password": "fresh2027"}, headers=h)
    assert ok.status_code == 200
    assert client.get("/api/v1/players/me", headers=h).status_code == 401


def test_weak_passwords_are_refused(client, mail):
    _, h = register(client)
    ask(client, "weak@example.com", "signup")
    r = client.post("/api/v1/auth/signup", json={"email": "weak@example.com", "code": mail[-1]["code"], "password": "abcdefgh"}, headers=h)
    assert r.json()["error"]["code"] == "WEAK_PASSWORD"


def test_protected_profiles_cannot_attach_an_email(client, mail):
    _, h = register(client, "Kid", adult=False)
    ask(client, "kid@example.com", "signup")
    r = client.post("/api/v1/auth/signup", json={"email": "kid@example.com", "code": mail[-1]["code"], "password": "cards2026"}, headers=h)
    assert r.status_code == 403 and r.json()["error"]["code"] == "PROTECTED_NO_EMAIL"


def test_one_account_per_profile_and_per_email(client, mail):
    _, h = signed_up(client, mail)
    ask(client, "other@example.com", "signup")
    r = client.post("/api/v1/auth/signup", json={"email": "other@example.com", "code": mail[-1]["code"], "password": "cards2026"}, headers=h)
    assert r.json()["error"]["code"] == "ACCOUNT_EXISTS"


def test_sign_out_everywhere_revokes_every_token(client, mail):
    _, h = signed_up(client, mail)
    fresh = client.post("/api/v1/auth/sign-out-everywhere", headers=h).json()["token"]
    assert client.get("/api/v1/players/me", headers=h).status_code == 401
    assert client.get("/api/v1/players/me", headers={"Authorization": f"Bearer {fresh}"}).status_code == 200


def test_deleting_the_profile_frees_the_email(client, mail):
    _, h = signed_up(client, mail)
    assert client.delete("/api/v1/players/me", headers=h).status_code == 204
    assert client.post("/api/v1/auth/login", json={"email": "asha@example.com", "password": "cards2026"}).status_code == 401
    signed_up(client, mail)


def test_email_sign_in_is_off_until_mail_is_configured(client, env):
    env(MAIL_BACKEND="disabled")
    r = client.post("/api/v1/auth/email/code", json={"email": "a@example.com", "purpose": "signup"})
    assert r.status_code == 503 and r.json()["error"]["code"] == "EMAIL_NOT_CONFIGURED"
    assert client.get("/api/v1/app-config").json()["email_accounts"] is False


def test_console_mail_is_refused_in_production(monkeypatch):
    from config.settings import Settings

    s = Settings(environment="production", mail_backend="console", player_token_secret="a" * 40, join_token_secret="b" * 40,
                 internal_api_token="c" * 40)
    with pytest.raises(ValueError):
        s.check()


def test_passwords_are_salted_scrypt_hashes():
    from app.Services.AccountService import hash_password, verify_password

    a, b = hash_password("cards2026"), hash_password("cards2026")
    assert a != b and a.startswith("scrypt$") and "cards2026" not in a
    assert verify_password("cards2026", a) and not verify_password("cards2027", a) and not verify_password("x", None)


def test_startup_creates_missing_tables_only(client):
    from sqlalchemy import inspect, text

    from app.Core.bootstrap import create_missing_tables
    from config.database import engine

    assert create_missing_tables() == []
    with engine().begin() as conn:
        conn.execute(text("DROP TABLE auth_codes"))
    assert create_missing_tables() == ["auth_codes"]
    assert "auth_codes" in inspect(engine()).get_table_names()
