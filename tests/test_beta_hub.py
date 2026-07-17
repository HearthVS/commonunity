"""Tests for the CommonUnity private beta threshold + hub (/beta).

Covers the full magic-link flow reusing the existing invite/beta infrastructure:
missing/invalid link, valid link handoff, session state, threshold admission
(name + email capture), refresh/direct hub access, data capture on the invite
row, member-gated hub data endpoints, and preservation of the historical
shared-code gate at /beta for callers without an invitation.

SMTP is intentionally unconfigured; no email is required for this flow.
"""
import os
import pathlib
import tempfile

# Env must be set before importing the server module (module-level config reads).
_TMP_DB = pathlib.Path(tempfile.mkdtemp()) / "test_admin.sqlite3"
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = str(_TMP_DB)
os.environ["ADMIN_ACCESS_CODE"] = "test-admin-code"
os.environ["ADMIN_COOKIE_SECRET"] = "test-cookie-secret"
os.environ["COMMONUNITY_BETA_CODE"] = "shared-beta-code"
for _k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"):
    os.environ.pop(_k, None)

import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

import server


def _admin_client() -> TestClient:
    c = TestClient(server.app)
    res = c.post("/api/admin/login", json={"code": "test-admin-code"})
    assert res.status_code == 200, res.text
    return c


def _create_invite(admin: TestClient, name: str = "Invitee", email: str = "") -> tuple[int, str, str]:
    res = admin.post("/api/admin/invites", json={"name": name, "email": email})
    assert res.status_code == 200, res.text
    data = res.json()
    assert "beta_link" in data, "admin create should surface the beta_link"
    token = data["beta_link"].split("invite=", 1)[1]
    return data["invite"]["id"], token, data["beta_link"]


def _participant(token: str) -> TestClient:
    """Fresh client that has walked the /beta?invite=<token> magic-link handoff,
    so its jar holds the signed beta + invite cookies."""
    c = TestClient(server.app, follow_redirects=False)
    res = c.get(f"/beta?invite={token}")
    assert res.status_code == 303, res.text
    assert res.headers["location"] == "/beta"
    return c


def test_beta_link_shape():
    admin = _admin_client()
    _, token, link = _create_invite(admin, "Ada")
    assert "/beta?invite=" in link


def test_invalid_link_falls_through_to_gate():
    """An unknown token must not admit anyone; /beta falls back to the shared
    gate (never bypasses the threshold)."""
    c = TestClient(server.app, follow_redirects=False)
    res = c.get("/beta?invite=not-a-real-token")
    # No redirect/handoff; the gate page is served (200 with gate header).
    assert res.status_code == 200
    assert res.headers.get("X-CommonUnity-Gate") == "compass"


def test_missing_link_shows_shared_gate():
    """Plain /beta with no invitation preserves the historical shared-code gate."""
    c = TestClient(server.app, follow_redirects=False)
    res = c.get("/beta")
    assert res.status_code == 200
    assert res.headers.get("X-CommonUnity-Gate") == "compass"


def test_valid_link_serves_beta_surface_and_session_pre_admission():
    admin = _admin_client()
    _, token, _ = _create_invite(admin, "Grace")
    p = _participant(token)

    # Clean /beta now serves the CommonUnity beta surface (not the gate).
    page = p.get("/beta")
    assert page.status_code == 200
    assert "X-CommonUnity-Gate" not in page.headers
    assert "/beta/beta.js" in page.text

    # Session: invited but not yet admitted.
    sess = p.get("/api/beta/session").json()
    assert sess["invited"] is True
    assert sess["admitted"] is False


def test_admission_captures_name_email_and_grants_hub():
    admin = _admin_client()
    invite_id, token, _ = _create_invite(admin, "Placeholder")
    p = _participant(token)

    # Validation: missing name / bad email are rejected.
    assert p.post("/api/beta/admit", json={"name": "", "email": "a@b.co"}).status_code == 400
    assert p.post("/api/beta/admit", json={"name": "Ada", "email": "nope"}).status_code == 400

    res = p.post("/api/beta/admit", json={"name": "Ada Lovelace", "email": "ada@example.com"})
    assert res.status_code == 200, res.text
    assert res.json()["admitted"] is True

    # Session now reports admitted, greeting with the participant's own name.
    sess = p.get("/api/beta/session").json()
    assert sess["admitted"] is True
    assert sess["name"] == "Ada Lovelace"

    # Data capture verified on the invite row (participant's own name + email).
    with server._admin_db() as conn:
        row = conn.execute("SELECT name, email, beta_admitted_at FROM invites WHERE id = ?", (invite_id,)).fetchone()
    assert row["name"] == "Ada Lovelace"
    assert row["email"] == "ada@example.com"
    assert (row["beta_admitted_at"] or "").strip() != ""


def test_direct_hub_access_after_refresh_persists():
    admin = _admin_client()
    _, token, _ = _create_invite(admin, "Persist")
    p = _participant(token)
    p.post("/api/beta/admit", json={"name": "Kat", "email": "kat@example.com"})

    # A brand-new client carrying only the signed invite cookie (simulating a
    # later visit / refresh) still resolves as admitted.
    cookies = p.cookies
    c2 = TestClient(server.app)
    for name in (server._INVITE_COOKIE, server._BETA_COOKIE):
        if name in cookies:
            c2.cookies.set(name, cookies[name])
    sess = c2.get("/api/beta/session").json()
    assert sess["admitted"] is True
    assert sess["name"] == "Kat"


def test_admit_requires_valid_invitation():
    """No invite cookie -> admission is refused server-side (not a client check)."""
    c = TestClient(server.app)
    res = c.post("/api/beta/admit", json={"name": "Eve", "email": "eve@example.com"})
    assert res.status_code == 403


def test_library_is_admission_gated():
    admin = _admin_client()
    _, token, _ = _create_invite(admin, "Libby")
    p = _participant(token)

    # Before admission the library is closed.
    assert p.get("/api/beta/library").status_code == 403

    p.post("/api/beta/admit", json={"name": "Libby", "email": "libby@example.com"})
    lib = p.get("/api/beta/library")
    assert lib.status_code == 200
    assert "items" in lib.json()


def test_beta_assets_served_and_allowlisted():
    c = TestClient(server.app)
    assert c.get("/beta/beta.js").status_code == 200
    assert c.get("/beta/beta.css").status_code == 200
    # Anything off the allowlist is refused.
    assert c.get("/beta/beta.html").status_code == 404
    assert c.get("/beta/secret.py").status_code == 404


if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-v"]))
