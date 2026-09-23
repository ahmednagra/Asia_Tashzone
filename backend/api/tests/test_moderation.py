"""Reports, blocks, sanctions, appeals, moderator review and the audit trail (ported from v1)."""
from conftest import INTERNAL, register


def seated_room(client, n=3):
    players = [register(client, f"S{i}") for i in range(n)]
    code = client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=players[0][1]).json()["room_code"]
    for _, h in players[1:]:
        client.post(f"/api/v1/rooms/{code}/join", headers=h)
    return code, players


def test_reports_need_membership_and_evidence_is_refused_by_default(client):
    code, [(a, ha), (b, hb), (c, hc)] = seated_room(client)
    assert client.post("/api/v1/reports", json={"room_code": code, "seat": 1, "reason": "rude"}, headers=ha).status_code == 201
    assert client.post("/api/v1/reports", json={"room_code": code, "seat": 0, "reason": "rude"}, headers=ha).json()["error"]["code"] == "INVALID_REPORT"
    _, stranger = register(client, "X")
    assert client.post("/api/v1/reports", json={"room_code": code, "seat": 1, "reason": "rude"}, headers=stranger).status_code == 404
    ev = client.post("/api/v1/reports", json={"room_code": code, "seat": 2, "reason": "rude", "evidence": [{"text": "hi"}]}, headers=ha)
    assert ev.json()["error"]["code"] == "EVIDENCE_DISABLED"
    assert client.post("/api/v1/internal/reports", json={"room": code, "reporter_player_id": c, "subject_player_id": b, "reason": "cheating"}, headers=INTERNAL).status_code == 201


def test_block_by_seat_list_and_unblock(client):
    code, [(a, ha), (b, hb), _] = seated_room(client)
    assert client.post("/api/v1/players/me/blocks", json={"room_code": code, "seat": 1}, headers=ha).status_code == 204
    items = client.get("/api/v1/players/me/blocks", headers=ha).json()["items"]
    assert [i["player_id"] for i in items] == [b]
    assert client.post("/api/v1/players/me/blocks", json={"room_code": code, "seat": 0}, headers=ha).json()["error"]["code"] == "CANNOT_BLOCK_SELF"
    assert client.post("/api/v1/players/me/blocks", json={"room_code": code, "seat": 3}, headers=ha).json()["error"]["code"] == "SEAT_EMPTY"
    assert client.delete(f"/api/v1/players/me/blocks/{b}", headers=ha).status_code == 204
    assert client.get("/api/v1/players/me/blocks", headers=ha).json()["items"] == []


def test_moderation_routes_need_a_moderator(client):
    _, h = register(client)
    assert client.get("/api/v1/moderation/reports", headers=h).json()["error"]["code"] == "FORBIDDEN"


def test_queue_dossier_action_with_resolve_all_and_audit(client, moderator):
    mid, hm = moderator
    code, [(a, ha), (b, hb), (c, hc)] = seated_room(client)
    client.post("/api/v1/reports", json={"room_code": code, "seat": 2, "reason": "rude"}, headers=ha)
    client.post("/api/v1/reports", json={"room_code": code, "seat": 2, "reason": "cheating"}, headers=hb)
    queue = client.get("/api/v1/moderation/reports", headers=hm).json()["items"]
    assert len(queue) == 1 and queue[0]["subject_id"] == c and queue[0]["reports"] == 2 and queue[0]["reporters"] == 2
    assert queue[0]["reasons"] == {"rude": 1, "cheating": 1}
    s = client.post(f"/api/v1/moderation/reports/{queue[0]['newest_report_id']}/action",
                    json={"kind": "chat_muted", "reason": "abuse", "days": 3, "resolve_all": True}, headers=hm).json()
    assert s["kind"] == "chat_muted" and s["active"] is True and len(s["report_ids"]) == 2
    assert client.get("/api/v1/moderation/reports", headers=hm).json()["items"] == []
    d = client.get(f"/api/v1/moderation/players/{c}", headers=hm).json()
    assert d["reports"]["total"] == 2 and d["active_sanctions"][0]["kind"] == "chat_muted"
    assert {x["action"] for x in d["audit"]} == {"sanction_created", "report_actioned"}
    assert client.post(f"/api/v1/moderation/reports/{queue[0]['newest_report_id']}/dismiss", json={"reason": "duplicate"}, headers=hm).json()["error"]["code"] == "REPORT_ALREADY_RESOLVED"
    assert client.get("/api/v1/players/me/sanction", headers=hc).json()["kind"] == "chat_muted"


def test_ban_blocks_everything_except_sanction_appeal_and_deletion_and_a_granted_appeal_lifts_it(client, moderator):
    mid, hm = moderator
    bad, hb = register(client, "Bad")
    s = client.post(f"/api/v1/moderation/players/{bad}/sanctions", json={"kind": "banned", "reason": "cheating"}, headers=hm).json()
    assert s["expires_at"] is None  # a ban is permanent unless asked otherwise
    assert client.get("/api/v1/players/me", headers=hb).json()["error"]["code"] == "ACCOUNT_BANNED"
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=hb).status_code == 403
    mine = client.get("/api/v1/players/me/sanction", headers=hb).json()
    assert mine["kind"] == "banned" and mine["can_appeal"] is True
    assert client.post("/api/v1/players/me/appeal", json={"message": "It was my brother"}, headers=hb).status_code == 201
    assert client.post("/api/v1/players/me/appeal", json={"message": "again"}, headers=hb).json()["error"]["code"] == "APPEAL_ALREADY_SUBMITTED"
    appeals = client.get("/api/v1/moderation/appeals", headers=hm).json()["items"]
    assert len(appeals) == 1 and appeals[0]["message"] == "It was my brother"
    assert client.post(f"/api/v1/moderation/appeals/{s['id']}", json={"granted": True, "note": "ok"}, headers=hm).json()["state"] == "granted"
    assert client.get("/api/v1/players/me", headers=hb).status_code == 200
    assert client.post(f"/api/v1/moderation/appeals/{s['id']}", json={"granted": False}, headers=hm).json()["error"]["code"] == "APPEAL_ALREADY_DECIDED"


def test_suspension_expiry_revoke_and_self_sanction(client, moderator):
    mid, hm = moderator
    p, h = register(client, "P")
    s = client.post(f"/api/v1/moderation/players/{p}/sanctions", json={"kind": "online_suspended", "reason": "abuse", "days": 7}, headers=hm).json()
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h).json()["error"]["code"] == "ACCOUNT_SUSPENDED"
    assert client.get("/api/v1/players/me", headers=h).status_code == 200  # suspended, not banned
    client.post(f"/api/v1/moderation/sanctions/{s['id']}/revoke", json={"reason": "not_a_violation"}, headers=hm)
    assert client.post("/api/v1/rooms", json={"profile_id": "callbreak.np@1"}, headers=h).status_code == 201
    assert client.post(f"/api/v1/moderation/players/{mid}/sanctions", json={"kind": "warning", "reason": "spam"}, headers=hm).json()["error"]["code"] == "CANNOT_SANCTION_SELF"
    assert client.post(f"/api/v1/moderation/players/{p}/sanctions", json={"kind": "warning", "reason": "spam", "days": 9999}, headers=hm).status_code == 422


def test_only_admins_appoint_moderators(client, moderator, db_session):
    mid, hm = moderator
    p, h = register(client, "NewMod")
    assert client.put(f"/api/v1/moderation/moderators/{p}", json={"role": "moderator"}, headers=hm).json() == {"player_id": p, "role": "moderator"}
    assert client.get("/api/v1/moderation/reports", headers=h).status_code == 200
    q, _ = register(client, "Other")
    assert client.put(f"/api/v1/moderation/moderators/{q}", json={}, headers=h).json()["error"]["code"] == "ADMIN_ONLY"
    assert client.delete(f"/api/v1/moderation/moderators/{p}", headers=hm).status_code == 204
    assert client.get("/api/v1/moderation/reports", headers=h).status_code == 403
    from app.Models import ModerationAudit
    assert {a.action for a in db_session.query(ModerationAudit).all()} >= {"moderator_granted", "moderator_revoked"}
