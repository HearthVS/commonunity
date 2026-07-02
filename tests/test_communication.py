"""Tests for CommonUnity cOMmunication v1.

Covers admin individual messages, broadcast fan-out, participant in-app fetch,
token isolation, read-marking, and privacy of the participant projection. SMTP
is intentionally unconfigured, so email deliveries resolve to 'pending' — the
in-app record is the durable artifact and the flow must not hard-fail.
"""
import os
import pathlib
import tempfile

# Env must be set before importing the server module (module-level config reads).
_TMP_DB = pathlib.Path(tempfile.mkdtemp()) / "test_admin.sqlite3"
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = str(_TMP_DB)
os.environ["ADMIN_ACCESS_CODE"] = "test-admin-code"
os.environ["ADMIN_COOKIE_SECRET"] = "test-cookie-secret"
# Ensure no SMTP config leaks in from the environment.
for _k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"):
    os.environ.pop(_k, None)

import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

import server


def _admin_client() -> TestClient:
    c = TestClient(server.app)
    res = c.post("/api/admin/login", json={"code": "test-admin-code"})
    assert res.status_code == 200, res.text
    return c


def _create_invite(admin: TestClient, name: str, email: str = "") -> tuple[int, str]:
    """Create an invite; return (invite_id, raw_token) parsed from the magic link."""
    res = admin.post("/api/admin/invites", json={"name": name, "email": email})
    assert res.status_code == 200, res.text
    data = res.json()
    invite_id = data["invite"]["id"]
    token = data["magic_link"].rsplit("/invite/", 1)[1]
    return invite_id, token


def _participant_client(token: str) -> TestClient:
    """A fresh client whose invite cookie is set by walking the /invite/{token} flow."""
    c = TestClient(server.app)
    c.get(f"/invite/{token}")  # sets signed invite cookie in this client's jar
    return c


def test_admin_can_create_individual_in_app_message():
    admin = _admin_client()
    invite_id, token = _create_invite(admin, "Ada")
    res = admin.post(f"/api/admin/invites/{invite_id}/message",
                     json={"subject": "Welcome", "body": "A quiet hello.", "channel": "in_app"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["in_app"] == 1
    assert body["email_sent"] == 0

    # The participant sees exactly this message.
    p = _participant_client(token)
    msgs = p.get("/api/messages").json()
    assert msgs["context"] == "invite"
    assert len(msgs["messages"]) == 1
    assert msgs["messages"][0]["subject"] == "Welcome"
    assert msgs["messages"][0]["body"] == "A quiet hello."
    assert msgs["unread"] == 1


def test_individual_email_channel_is_pending_without_smtp():
    admin = _admin_client()
    invite_id, _ = _create_invite(admin, "Grace", email="grace@example.com")
    res = admin.post(f"/api/admin/invites/{invite_id}/message",
                     json={"subject": "Note", "body": "Body", "channel": "both"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["in_app"] == 1
    # SMTP unconfigured -> graceful pending, not a hard failure.
    assert body["email_pending"] == 1
    assert body["email_sent"] == 0


def test_broadcast_creates_deliveries_for_active_invites():
    admin = _admin_client()
    _, t1 = _create_invite(admin, "Cohort-A")
    _, t2 = _create_invite(admin, "Cohort-B")

    preview = admin.get("/api/admin/broadcast/recipients").json()
    assert preview["total"] >= 2

    res = admin.post("/api/admin/broadcast",
                     json={"subject": "Field note", "body": "To the cohort.", "channel": "in_app"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["recipients"] == preview["total"]
    assert body["in_app"] == preview["total"]

    # Each participant sees the broadcast.
    for tok in (t1, t2):
        p = _participant_client(tok)
        msgs = p.get("/api/messages").json()["messages"]
        assert any(m["kind"] == "broadcast" and m["subject"] == "Field note" for m in msgs)


def test_token_sees_only_its_own_individual_message():
    admin = _admin_client()
    id_a, token_a = _create_invite(admin, "Alpha")
    id_b, token_b = _create_invite(admin, "Beta")

    admin.post(f"/api/admin/invites/{id_a}/message",
               json={"subject": "For Alpha only", "body": "secret-a", "channel": "in_app"})

    # Beta must not see Alpha's individual message.
    pb = _participant_client(token_b)
    beta_msgs = pb.get("/api/messages").json()["messages"]
    assert all(m["subject"] != "For Alpha only" for m in beta_msgs)

    # Alpha does see it.
    pa = _participant_client(token_a)
    alpha_msgs = pa.get("/api/messages").json()["messages"]
    assert any(m["subject"] == "For Alpha only" for m in alpha_msgs)


def test_unrelated_token_cannot_mark_anothers_message_read():
    admin = _admin_client()
    id_a, token_a = _create_invite(admin, "One")
    _, token_b = _create_invite(admin, "Two")
    admin.post(f"/api/admin/invites/{id_a}/message",
               json={"subject": "S", "body": "b", "channel": "in_app"})

    pa = _participant_client(token_a)
    delivery_id = pa.get("/api/messages").json()["messages"][0]["id"]

    # Token B tries to mark A's delivery read -> 404 (scoped to caller invite).
    pb = _participant_client(token_b)
    res = pb.post(f"/api/messages/{delivery_id}/read")
    assert res.status_code == 404

    # Token A can mark its own read.
    ok = pa.post(f"/api/messages/{delivery_id}/read")
    assert ok.status_code == 200
    after = pa.get("/api/messages").json()
    assert after["unread"] == 0


def test_no_token_context_returns_empty():
    c = TestClient(server.app)  # no invite cookie
    msgs = c.get("/api/messages").json()
    assert msgs["messages"] == []
    assert msgs["context"] == "none"


def test_participant_projection_exposes_no_private_fields():
    admin = _admin_client()
    invite_id, token = _create_invite(admin, "Private-check")
    admin.post(f"/api/admin/invites/{invite_id}/message",
               json={"subject": "s", "body": "b", "channel": "in_app"})
    p = _participant_client(token)
    m = p.get("/api/messages").json()["messages"][0]
    # Only the message artifact + delivery state — never invite token/email or
    # any private participant record fields.
    assert set(m.keys()) == {"id", "message_id", "kind", "subject", "body", "created_at", "read", "from"}


def test_message_requires_body():
    admin = _admin_client()
    invite_id, _ = _create_invite(admin, "NoBody")
    res = admin.post(f"/api/admin/invites/{invite_id}/message",
                     json={"subject": "only subject", "body": "", "channel": "in_app"})
    assert res.status_code == 400


def test_message_endpoints_require_admin():
    c = TestClient(server.app)  # unauthenticated
    assert c.post("/api/admin/broadcast", json={"body": "x"}).status_code == 401
    assert c.get("/api/admin/broadcast/recipients").status_code == 401
    assert c.post("/api/admin/invites/1/message", json={"body": "x"}).status_code == 401
