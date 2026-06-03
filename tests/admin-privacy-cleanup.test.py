#!/usr/bin/env python3
"""Admin privacy/operations cleanup pass — regression tests.

Fourth privacy/ops pass after PR #71/#72/#73. Covers four guarantees:

  1. Historical invite-event scrub: legacy events.detail that still carries the
     old invitee name/email (written before PR #73 separated contact identity)
     is blanked idempotently on DB init. Non-sensitive columns (type,
     timestamp, invite_id, token) survive. New rows are already content-free.

  2. Magic-link token masking: the admin invite list / create payloads never
     ship the raw token — only a masked reference + a token_present flag. The
     full token stays server-side, so existing emailed links keep verifying,
     and a deliberate reveal endpoint reconstructs the live link on demand.

  3. Revoke: revoking a DB invite makes its token stop validating, while an
     untouched active invite keeps working.

  4. Feedback delete: an admin-only hard delete removes a single received
     comment from the register without touching unrelated rows.

Run: python3 tests/admin-privacy-cleanup.test.py
"""
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="admin_cleanup_")
os.environ.setdefault("COMMONUNITY_ADMIN_DB_PATH", os.path.join(_tmp_dir, "admin.sqlite3"))
os.environ.setdefault("COMMONUNITY_MAGIC_LINK_TOKENS", "envtokA,envtokB")
os.environ.setdefault("ADMIN_ACCESS_CODE", "rootadmin")

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


SECRET_EMAIL = "alice@example.com"
SECRET_NAME = "Alice Realname"

with server._admin_db() as conn:
    conn.execute("DELETE FROM invites")
    conn.execute("DELETE FROM events")
    conn.execute("DELETE FROM feedback")

c = fresh_client()

# ── 1. Historical events.detail scrub ──────────────────────────────────────────
print("1. legacy invite-event detail carrying name/email is scrubbed idempotently")
with server._admin_db() as conn:
    # Backing invite the legacy events link to (events.invite_id is a FK).
    conn.execute(
        "INSERT INTO invites (id, token, name, email, status, created_at) "
        "VALUES (5, 'tok-legacy', ?, ?, 'active', ?)",
        (SECRET_NAME, SECRET_EMAIL, server._now_iso()),
    )
    # Simulate pre-PR#73 rows that leaked contact identity into detail, plus a
    # non-invite event whose detail is legitimately retained.
    conn.execute(
        "INSERT INTO events (timestamp, type, invite_id, token, route, source, user_agent, detail) "
        "VALUES (?, 'invite_created', 5, 'tok-legacy', '/admin', 'admin', '', ?)",
        (server._now_iso(), f"{SECRET_NAME} <{SECRET_EMAIL}>"),
    )
    conn.execute(
        "INSERT INTO events (timestamp, type, invite_id, token, route, source, user_agent, detail) "
        "VALUES (?, 'invite_email_sent', 5, 'tok-legacy', '/admin', 'admin', '', ?)",
        (server._now_iso(), f"sent to {SECRET_EMAIL}"),
    )
    conn.execute(
        "INSERT INTO events (timestamp, type, invite_id, token, route, source, user_agent, detail) "
        "VALUES (?, 'invite_revoked', 5, 'tok-legacy', '/admin', 'admin', '', ?)",
        (server._now_iso(), f"revoked {SECRET_NAME}"),
    )
    conn.execute(
        "INSERT INTO events (timestamp, type, invite_id, token, route, source, user_agent, detail) "
        "VALUES (?, 'admin_login_failed', NULL, '', '/admin', 'admin', '', 'bad code from 203.0.113.9')",
        (server._now_iso(),),
    )

# Re-opening the DB runs _init_admin_db, which carries the idempotent scrub.
with server._admin_db() as conn:
    rows = conn.execute(
        "SELECT type, invite_id, token, detail FROM events ORDER BY id"
    ).fetchall()

by_type = {}
for r in rows:
    by_type.setdefault(r["type"], []).append(r)

for t in ("invite_created", "invite_email_sent", "invite_revoked"):
    row = by_type[t][0]
    ok(row["detail"] == "", f"legacy '{t}' detail blanked")
    ok(row["invite_id"] == 5, f"legacy '{t}' keeps invite_id linkage")
    ok(row["token"] == "tok-legacy", f"legacy '{t}' keeps token-column linkage")

ok(SECRET_NAME not in str([dict(r) for r in rows]),
   "no scrubbed row still carries the contact name anywhere")
ok(SECRET_EMAIL not in str([dict(r) for r in rows]),
   "no scrubbed row still carries the contact email anywhere")
# Non-invite events keep their (non-contact) detail.
ok(by_type["admin_login_failed"][0]["detail"] == "bad code from 203.0.113.9",
   "non-invite event detail is preserved by the scrub")

# Idempotence: running init again changes nothing further.
with server._admin_db() as conn:
    again = conn.execute("SELECT detail FROM events WHERE type LIKE 'invite_%'").fetchall()
ok(all((r["detail"] or "") == "" for r in again), "scrub is idempotent (re-run is a no-op)")

print("\n2. new invite lifecycle rows are written content-free (no detail leak)")
created = c.post(
    "/api/admin/invites",
    json={"name": SECRET_NAME, "email": SECRET_EMAIL, "notes": "vip"},
    cookies=admin_cookie(),
)
ok(created.status_code == 200, "admin can create an invite")
new_invite = created.json()["invite"]
new_invite_id = new_invite["id"]
with server._admin_db() as conn:
    new_rows = conn.execute(
        "SELECT detail FROM events WHERE invite_id=? AND type LIKE 'invite_%'", (new_invite_id,)
    ).fetchall()
ok(len(new_rows) >= 1, "new invite_created event row exists")
ok(all((r["detail"] or "") == "" for r in new_rows),
   "new invite lifecycle events carry empty detail")

# ── 2. Token masking ───────────────────────────────────────────────────────────
print("\n3. admin invite payloads mask the raw token but keep it verifiable server-side")
# Pull the real token straight from the DB (server-side still has the full value).
with server._admin_db() as conn:
    real_token = conn.execute(
        "SELECT token FROM invites WHERE id=?", (new_invite_id,)
    ).fetchone()["token"]
ok(bool(real_token) and len(real_token) > 12, "server stored a full raw token")

# The create response masks the token and hands back a server-built link.
ok("token" not in new_invite, "create response carries no raw 'token' field")
ok("token_masked" in new_invite, "create response exposes a masked token reference")
ok(new_invite["token_masked"] != real_token, "masked reference is not the raw token")
ok(real_token not in server.json.dumps(new_invite),
   "raw token never appears in the persisted-shape invite object")
# The create response deliberately includes the live link once (the admin needs
# it to copy at creation), built server-side from the stored token.
ok(server.quote(real_token, safe="") in created.json().get("magic_link", ""),
   "create response returns the live magic link built server-side")

# The list payload also masks.
inv_list = c.get("/api/admin/invites", cookies=admin_cookie())
ok(inv_list.status_code == 200, "admin invites list authorized")
ok(real_token not in inv_list.text, "raw token never appears in the invites list payload")
listed = next(r for r in inv_list.json()["invites"] if r["id"] == new_invite_id)
ok("token" not in listed, "list row carries no raw 'token' field")
ok(listed.get("token_present") is True, "list row flags that a token exists")
ok(listed.get("token_masked", "").startswith(real_token[:4]) and
   listed.get("token_masked", "").endswith(real_token[-4:]),
   "masked reference shows only prefix/suffix of the real token")

# Backend verification still works with the existing (un-rotated) token.
ok(server._valid_invite_token(real_token) is True,
   "existing token still validates server-side (emailed links keep working)")
landing = fresh_client().get(f"/invite/{real_token}", follow_redirects=False)
ok(landing.status_code in (302, 303), "existing magic link still lands an invitee (not gated)")
ok(landing.headers.get("location") == "/threshold",
   "existing magic link still routes into the threshold flow")

# The reveal endpoint reconstructs the live link on deliberate admin action.
reveal = c.get(f"/api/admin/invites/{new_invite_id}/link", cookies=admin_cookie())
ok(reveal.status_code == 200, "reveal-link endpoint authorized for admin")
ok(reveal.json().get("active") is True, "reveal reports an active invite as active")
ok(server.quote(real_token, safe="") in reveal.json()["magic_link"],
   "reveal endpoint returns the full working magic link")
# Reveal endpoint is admin-gated.
ok(fresh_client().get(f"/api/admin/invites/{new_invite_id}/link").status_code == 401,
   "reveal-link endpoint rejects non-admin callers")

# ── 3. Revoke ───────────────────────────────────────────────────────────────────
print("\n4. revoking an invite stops its link; an untouched invite keeps working")
# A second, independent active invite that must stay operational.
other = c.post("/api/admin/invites", json={"name": "Keep Me"}, cookies=admin_cookie()).json()["invite"]
with server._admin_db() as conn:
    other_token = conn.execute("SELECT token FROM invites WHERE id=?", (other["id"],)).fetchone()["token"]

ok(server._valid_invite_token(real_token) is True, "target invite valid before revoke")
rev = c.post(f"/api/admin/invites/{new_invite_id}/revoke", json={}, cookies=admin_cookie())
ok(rev.status_code == 200, "revoke endpoint succeeds")
ok(server._valid_invite_token(real_token) is False,
   "revoked token no longer validates server-side")
gated = fresh_client().get(f"/invite/{real_token}", follow_redirects=False)
ok(gated.headers.get("location") != "/threshold",
   "revoked magic link no longer routes into the flow")
ok(server._valid_invite_token(other_token) is True,
   "the untouched invite still validates (revoke is scoped to one invite)")
# Reveal on a revoked invite reports inactive rather than handing back a dead link as live.
rev_reveal = c.get(f"/api/admin/invites/{new_invite_id}/link", cookies=admin_cookie())
ok(rev_reveal.json().get("active") is False, "reveal reports a revoked invite as inactive")

# ── 4. Feedback delete ──────────────────────────────────────────────────────────
print("\n5. admin can hard-delete a received comment without touching other records")
with server._admin_db() as conn:
    conn.execute("DELETE FROM feedback")
    conn.execute(
        "INSERT INTO feedback (timestamp, type, app, message, name, status) "
        "VALUES (?, 'general', 'compass', 'test comment from my son', 'Son', 'new')",
        (server._now_iso(),),
    )
    conn.execute(
        "INSERT INTO feedback (timestamp, type, app, message, name, status) "
        "VALUES (?, 'bug', 'studio', 'real bug report', 'Tester', 'new')",
        (server._now_iso(),),
    )
    son_id = conn.execute(
        "SELECT id FROM feedback WHERE message='test comment from my son'"
    ).fetchone()["id"]
    keep_id = conn.execute(
        "SELECT id FROM feedback WHERE message='real bug report'"
    ).fetchone()["id"]

before = c.get("/api/admin/feedback", cookies=admin_cookie()).json()
ok(len(before["entries"]) == 2, "two feedback records present before delete")

deleted = c.delete(f"/api/admin/feedback/{son_id}", cookies=admin_cookie())
ok(deleted.status_code == 200, "admin delete endpoint succeeds")

after = c.get("/api/admin/feedback", cookies=admin_cookie()).json()
ids_after = {e["id"] for e in after["entries"]}
ok(son_id not in ids_after, "deleted comment is gone from the register")
ok(keep_id in ids_after, "unrelated feedback record is untouched")
ok(len(after["entries"]) == 1, "exactly one record removed")

# Re-deleting a now-missing id is a clean 404, not a silent wipe.
ok(c.delete(f"/api/admin/feedback/{son_id}", cookies=admin_cookie()).status_code == 404,
   "deleting a missing record returns 404")
# Delete is admin-gated.
ok(fresh_client().delete(f"/api/admin/feedback/{keep_id}").status_code == 401,
   "feedback delete rejects non-admin callers")

print(f"\n{passed} passed")
