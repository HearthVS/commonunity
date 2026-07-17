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


def _create_campaign(admin: TestClient, name: str = "WhatsApp group") -> tuple[int, str, str]:
    res = admin.post("/api/admin/campaigns", json={"name": name})
    assert res.status_code == 200, res.text
    data = res.json()
    assert "campaign_link" in data, "admin create should surface the campaign_link"
    token = data["campaign_link"].split("campaign=", 1)[1]
    return data["campaign"]["id"], token, data["campaign_link"]


def _campaign_visitor(token: str) -> TestClient:
    """Fresh browser that opened the reusable /beta?campaign=<token> link: its
    jar holds the signed beta + pre-admission campaign cookies, but no personal
    invite cookie yet (admission happens at the threshold)."""
    c = TestClient(server.app, follow_redirects=False)
    res = c.get(f"/beta?campaign={token}")
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


# ── Reusable campaign links ─────────────────────────────────────────────────

def test_campaign_link_shape_and_admin_only():
    admin = _admin_client()
    _, _, link = _create_campaign(admin, "Autumn WhatsApp")
    assert "/beta?campaign=" in link
    # Anonymous callers cannot mint a campaign.
    anon = TestClient(server.app)
    assert anon.post("/api/admin/campaigns", json={"name": "nope"}).status_code == 401


def test_campaign_open_serves_threshold_not_hub():
    """Opening a valid campaign link validates server-side and drops the visitor
    at the /beta threshold — invited but NOT admitted (no auto-admission)."""
    admin = _admin_client()
    _, token, _ = _create_campaign(admin)
    v = _campaign_visitor(token)

    page = v.get("/beta")
    assert page.status_code == 200
    assert "X-CommonUnity-Gate" not in page.headers
    assert "/beta/beta.js" in page.text

    sess = v.get("/api/beta/session").json()
    assert sess["invited"] is True
    assert sess["admitted"] is False


def test_invalid_campaign_falls_through_to_gate():
    c = TestClient(server.app, follow_redirects=False)
    res = c.get("/beta?campaign=not-a-real-campaign")
    assert res.status_code == 200
    assert res.headers.get("X-CommonUnity-Gate") == "compass"


def test_campaign_admits_multiple_independent_participants():
    """Many browsers use one campaign link; each gets its own admission record,
    its own signed session cookie, its own name — nothing shared or overwritten."""
    admin = _admin_client()
    campaign_id, token, _ = _create_campaign(admin, "Community group")

    a = _campaign_visitor(token)
    b = _campaign_visitor(token)

    ra = a.post("/api/beta/admit", json={"name": "Ada Lovelace", "email": "ada@example.com"})
    rb = b.post("/api/beta/admit", json={"name": "Grace Hopper", "email": "grace@example.com"})
    assert ra.status_code == 200 and rb.status_code == 200

    # Independent cookies: each browser carries its own distinct invite token.
    ca = a.cookies.get(server._INVITE_COOKIE)
    cb = b.cookies.get(server._INVITE_COOKIE)
    assert ca and cb and ca != cb

    # Independent sessions: each is greeted with their own name, not the other's.
    sa = a.get("/api/beta/session").json()
    sb = b.get("/api/beta/session").json()
    assert sa == {"invited": True, "admitted": True, "name": "Ada Lovelace"}
    assert sb == {"invited": True, "admitted": True, "name": "Grace Hopper"}

    # Two distinct participant rows, both attributed to the campaign, and the
    # campaign template itself is never mutated into a participant identity.
    with server._admin_db() as conn:
        parts = conn.execute(
            "SELECT name, email, kind, campaign_id, beta_admitted_at FROM invites "
            "WHERE kind = 'participant' ORDER BY id"
        ).fetchall()
        campaign = conn.execute(
            "SELECT name, email, kind FROM invites WHERE id = ?", (campaign_id,)
        ).fetchone()
    assert len(parts) == 2
    assert {p["name"] for p in parts} == {"Ada Lovelace", "Grace Hopper"}
    assert {p["email"] for p in parts} == {"ada@example.com", "grace@example.com"}
    assert all(p["campaign_id"] == campaign_id for p in parts)
    assert all((p["beta_admitted_at"] or "").strip() for p in parts)
    # Template untouched: still the campaign, no participant email captured onto it.
    assert campaign["kind"] == "campaign"
    assert campaign["email"] == ""


def test_campaign_does_not_auto_admit_subsequent_visitors():
    """After one participant admits, a brand-new browser opening the same link is
    invited (sees the threshold) but NOT admitted — no admission is shared."""
    admin = _admin_client()
    _, token, _ = _create_campaign(admin)
    first = _campaign_visitor(token)
    first.post("/api/beta/admit", json={"name": "First", "email": "first@example.com"})

    second = _campaign_visitor(token)
    sess = second.get("/api/beta/session").json()
    assert sess["invited"] is True
    assert sess["admitted"] is False


def test_campaign_duplicate_email_creates_separate_records():
    """Two enrollments with the same email are independent records (safe choice:
    never silently overwrite another participant)."""
    admin = _admin_client()
    campaign_id, token, _ = _create_campaign(admin)
    a = _campaign_visitor(token)
    b = _campaign_visitor(token)
    a.post("/api/beta/admit", json={"name": "Same One", "email": "same@example.com"})
    b.post("/api/beta/admit", json={"name": "Same Two", "email": "same@example.com"})
    with server._admin_db() as conn:
        rows = conn.execute(
            "SELECT id FROM invites WHERE kind = 'participant' AND email = ? AND campaign_id = ?",
            ("same@example.com", campaign_id),
        ).fetchall()
    assert len(rows) == 2


def test_campaign_participant_refresh_and_resubmit_is_idempotent():
    """A participant's own signed cookie keeps them admitted across refresh, and
    re-submitting does NOT fork a second record."""
    admin = _admin_client()
    campaign_id, token, _ = _create_campaign(admin)
    p = _campaign_visitor(token)
    p.post("/api/beta/admit", json={"name": "Kat", "email": "kat@example.com"})

    # Fresh client carrying only the participant's signed invite cookie.
    invite_cookie = p.cookies.get(server._INVITE_COOKIE)
    assert invite_cookie
    c2 = TestClient(server.app)
    c2.cookies.set(server._INVITE_COOKIE, invite_cookie)
    sess = c2.get("/api/beta/session").json()
    assert sess["admitted"] is True and sess["name"] == "Kat"

    # Re-submitting from the original browser updates the same row, no fork.
    p.post("/api/beta/admit", json={"name": "Kat", "email": "kat@example.com"})
    with server._admin_db() as conn:
        n = conn.execute(
            "SELECT COUNT(*) AS n FROM invites WHERE kind = 'participant' AND campaign_id = ?",
            (campaign_id,),
        ).fetchone()["n"]
    assert n == 1


def test_campaign_library_is_admission_gated():
    admin = _admin_client()
    _, token, _ = _create_campaign(admin)
    v = _campaign_visitor(token)
    # Pre-admission (campaign cookie only) the library is closed.
    assert v.get("/api/beta/library").status_code == 403
    v.post("/api/beta/admit", json={"name": "Libby", "email": "libby@example.com"})
    assert v.get("/api/beta/library").status_code == 200


def test_revoked_campaign_stops_new_enrollment_but_keeps_participants():
    admin = _admin_client()
    campaign_id, token, _ = _create_campaign(admin)
    # An early participant enrolls while the campaign is live.
    early = _campaign_visitor(token)
    early.post("/api/beta/admit", json={"name": "Early", "email": "early@example.com"})

    # Revoke via the existing invite mechanism.
    assert admin.post(f"/api/admin/invites/{campaign_id}/revoke", json={}).status_code == 200

    # New visitors can no longer open the link (falls through to the gate).
    dead = TestClient(server.app, follow_redirects=False)
    res = dead.get(f"/beta?campaign={token}")
    assert res.status_code == 200
    assert res.headers.get("X-CommonUnity-Gate") == "compass"

    # The existing participant keeps their own admission.
    assert early.get("/api/beta/session").json()["admitted"] is True


def test_campaign_token_on_invite_param_is_not_captured_as_identity():
    """A campaign token pushed onto the personal ?invite= param must be rerouted
    as a campaign (shared campaign cookie), never adopted as a personal identity
    that admission could overwrite."""
    admin = _admin_client()
    campaign_id, token, _ = _create_campaign(admin)
    c = TestClient(server.app, follow_redirects=False)
    res = c.get(f"/beta?invite={token}")
    assert res.status_code == 303 and res.headers["location"] == "/beta"
    # It set the campaign cookie, not a personal invite cookie.
    assert server._CAMPAIGN_COOKIE in res.cookies
    assert server._INVITE_COOKIE not in res.cookies
    # Admitting mints a participant; the campaign template stays a template.
    c.post("/api/beta/admit", json={"name": "Router", "email": "router@example.com"})
    with server._admin_db() as conn:
        camp = conn.execute("SELECT kind, email FROM invites WHERE id = ?", (campaign_id,)).fetchone()
    assert camp["kind"] == "campaign" and camp["email"] == ""


def test_admin_list_shows_campaign_attribution():
    admin = _admin_client()
    campaign_id, token, _ = _create_campaign(admin, "Attributed group")
    v = _campaign_visitor(token)
    v.post("/api/beta/admit", json={"name": "Member", "email": "member@example.com"})

    listing = admin.get("/api/admin/invites").json()["invites"]
    campaign_row = next(i for i in listing if i["id"] == campaign_id)
    participant_row = next(i for i in listing if i.get("kind") == "participant")
    assert campaign_row["kind"] == "campaign"
    assert participant_row["campaign_id"] == campaign_id
    assert participant_row["campaign_label"] == "Attributed group"


def test_personal_invite_unaffected_by_campaign_changes():
    """Regression: the historical one-person invite flow still admits onto its
    own row (no participant fork, no campaign involvement)."""
    admin = _admin_client()
    invite_id, token, link = _create_invite(admin, "Solo")
    assert "/beta?invite=" in link
    p = _participant(token)
    p.post("/api/beta/admit", json={"name": "Solo Person", "email": "solo@example.com"})
    with server._admin_db() as conn:
        row = conn.execute(
            "SELECT name, email, kind, campaign_id FROM invites WHERE id = ?", (invite_id,)
        ).fetchone()
        # No participant fork was created for this personal admission.
        forks = conn.execute(
            "SELECT COUNT(*) AS n FROM invites WHERE kind = 'participant' AND email = ?",
            ("solo@example.com",),
        ).fetchone()["n"]
    assert row["name"] == "Solo Person" and row["email"] == "solo@example.com"
    assert (row["kind"] or "personal") == "personal"
    assert row["campaign_id"] is None
    assert forks == 0


if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-v"]))
