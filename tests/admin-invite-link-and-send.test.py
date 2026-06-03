#!/usr/bin/env python3
"""Admin invite Copy-Link reveal + email-send behavior — regression tests.

Follow-up to PR #74, which masked raw magic-link tokens in the admin invite
payload and added GET /api/admin/invites/{id}/link as the deliberate reveal
path the "Copy link" button calls. Two reported defects motivate this suite:

  A. Copy-link: the button must obtain a full, usable magic link from the
     reveal endpoint (the list payload no longer carries the raw token), only
     for an authenticated admin, and only report a live link for an active
     invite. The static checks assert the panel uses a clipboard helper with a
     non-clipboard fallback (so a non-secure-context browser cannot leave the
     admin with a button that claims success while copying nothing).

  B. Email send/resend: a send must hit the SMTP path, and an SMTP failure
     must surface as an error WITHOUT recording an invite_email_sent event or
     returning success — otherwise an invite looks "sent" when the recipient
     (e.g. Eda) never received anything. No real email is sent: SMTP is mocked.

Run: python3 tests/admin-invite-link-and-send.test.py
"""
import os
import sys
import smtplib
import tempfile
from unittest import mock

_tmp_dir = tempfile.mkdtemp(prefix="admin_invite_link_")
os.environ.setdefault("COMMONUNITY_ADMIN_DB_PATH", os.path.join(_tmp_dir, "admin.sqlite3"))
os.environ.setdefault("COMMONUNITY_MAGIC_LINK_TOKENS", "envtokA,envtokB")
os.environ.setdefault("ADMIN_ACCESS_CODE", "rootadmin")
# SMTP env so _send_invite_email passes its config gate and reaches the
# (mocked) smtplib.SMTP path rather than short-circuiting on missing config.
os.environ.setdefault("SMTP_HOST", "smtp.example.com")
os.environ.setdefault("SMTP_USER", "mailer@example.com")
os.environ.setdefault("SMTP_PASSWORD", "secret")
os.environ.setdefault("SMTP_FROM", "CommonUnity <mailer@example.com>")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

passed = 0


def ok(cond, label):
    global passed
    if not cond:
        raise AssertionError("FAILED: " + label)
    print("  ok  " + label)
    passed += 1


def fresh_client():
    c = TestClient(server.app)
    c.cookies.clear()
    return c


def admin_cookie():
    return {server._ADMIN_COOKIE: server._signed_cookie_value("open", "admin")}


with server._admin_db() as conn:
    conn.execute("DELETE FROM invites")
    conn.execute("DELETE FROM events")

c = fresh_client()

# ── A. Copy-link reveal endpoint ───────────────────────────────────────────────
print("A. copy-link reveal returns a usable full link only for an admin, only when active")
created = c.post(
    "/api/admin/invites",
    json={"name": "Eda", "email": "eda@example.com"},
    cookies=admin_cookie(),
)
ok(created.status_code == 200, "admin can create an invite")
invite = created.json()["invite"]
invite_id = invite["id"]

# List still masks the token (privacy guarantee preserved).
with server._admin_db() as conn:
    real_token = conn.execute(
        "SELECT token FROM invites WHERE id=?", (invite_id,)
    ).fetchone()["token"]
inv_list = c.get("/api/admin/invites", cookies=admin_cookie())
ok(real_token not in inv_list.text, "raw token never appears in the invites list payload")
listed = next(r for r in inv_list.json()["invites"] if r["id"] == invite_id)
ok("token" not in listed, "list row carries no raw 'token' field")
ok(listed.get("token_present") is True, "list row flags a token is present so Copy link renders")

# Reveal endpoint hands back the full, working link for the active invite.
reveal = c.get(f"/api/admin/invites/{invite_id}/link", cookies=admin_cookie())
ok(reveal.status_code == 200, "reveal endpoint authorized for admin")
body = reveal.json()
ok(body.get("active") is True, "reveal reports the active invite as active")
link = body.get("magic_link", "")
ok(link.endswith("/invite/" + server.quote(real_token, safe="")),
   "reveal returns the full path-based magic link containing the real token")
ok(server._valid_invite_token(real_token) is True,
   "the revealed link's token validates server-side (link actually works)")

# Reveal is admin-gated — a non-admin caller cannot reveal the link.
ok(fresh_client().get(f"/api/admin/invites/{invite_id}/link").status_code == 401,
   "reveal endpoint rejects non-admin callers")

# Revoked invite: reveal must report inactive rather than hand back a dead link
# as if it were live (UI shows "Link inactive" instead of copying).
c.post(f"/api/admin/invites/{invite_id}/revoke", json={}, cookies=admin_cookie())
rev = c.get(f"/api/admin/invites/{invite_id}/link", cookies=admin_cookie())
ok(rev.json().get("active") is False, "reveal reports a revoked invite as inactive")

# ── B. Email send surfaces failure and never falsely marks "sent" ───────────────
print("\nB. send/resend surfaces SMTP failure without recording a sent event or success")
sendable = c.post(
    "/api/admin/invites",
    json={"name": "Eda", "email": "eda@example.com"},
    cookies=admin_cookie(),
).json()["invite"]
send_id = sendable["id"]


def _sent_event_count(inv_id):
    with server._admin_db() as conn:
        return conn.execute(
            "SELECT COUNT(*) AS n FROM events WHERE invite_id=? AND type='invite_email_sent'",
            (inv_id,),
        ).fetchone()["n"]


ok(_sent_event_count(send_id) == 0, "no sent event before any send attempt")

# Failure path: SMTP raises. The endpoint must NOT return success and must NOT
# write an invite_email_sent event. No real email leaves the process.
with mock.patch("server.smtplib.SMTP", side_effect=smtplib.SMTPAuthenticationError(535, b"bad creds")):
    fail = c.post(f"/api/admin/invites/{send_id}/send", json={}, cookies=admin_cookie())
ok(fail.status_code == 502, "SMTP failure surfaces as a 502 error, not a 200")
ok("could not be sent" in fail.json().get("detail", "").lower() or
   "unreachable" in fail.json().get("detail", "").lower(),
   "error detail is admin-actionable about the email failing")
ok(_sent_event_count(send_id) == 0,
   "a failed send records NO invite_email_sent event (invite is not falsely marked sent)")

# Success path: SMTP accepts. Exactly one sent event is recorded and the
# response reports the recipient. smtplib is fully mocked — nothing is sent.
fake_smtp = mock.MagicMock()
fake_smtp.__enter__.return_value = fake_smtp
with mock.patch("server.smtplib.SMTP", return_value=fake_smtp):
    good = c.post(f"/api/admin/invites/{send_id}/send", json={}, cookies=admin_cookie())
ok(good.status_code == 200, "send succeeds when SMTP accepts the message")
ok(good.json().get("sent_to") == "eda@example.com", "send response reports the recipient")
ok(fake_smtp.send_message.called, "send actually invoked the SMTP send_message path")
ok(_sent_event_count(send_id) == 1, "a successful send records exactly one invite_email_sent event")

# Send is admin-gated.
ok(fresh_client().post(f"/api/admin/invites/{send_id}/send", json={}).status_code == 401,
   "send endpoint rejects non-admin callers")

# Revoked invites cannot be (re)sent.
c.post(f"/api/admin/invites/{send_id}/revoke", json={}, cookies=admin_cookie())
with mock.patch("server.smtplib.SMTP", return_value=fake_smtp):
    revoked_send = c.post(f"/api/admin/invites/{send_id}/send", json={}, cookies=admin_cookie())
ok(revoked_send.status_code == 400, "a revoked invite cannot be sent/resent")

print(f"\n{passed} passed")
