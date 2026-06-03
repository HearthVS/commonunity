#!/usr/bin/env python3
"""Invite / contact-layer privacy separation — regression tests.

This is the third privacy pass after PR #71 (admin Golden Thread metadata-only)
and PR #72 (admin members metadata-only). It guards the *separation* between the
real-world contact identity layer (invite name/email/token, one-on-one
orientation asks) and the OM Cipher / private-identity layer (numerology, Gene
Keys, Human Design, reflections / Golden Thread content).

The contract, in both directions:

  A. Invite / contact / orientation admin surfaces must NOT carry OM Cipher
     private fields (life_path, gk_gate, hd_type, om_cipher_seed, sigil_svg,
     full_record_json …) and must NOT carry Golden Thread / reflection content.

  B. The shared admin metrics *events* feed must NOT broadcast contact identity
     (invitee name / recipient email) in its verbatim `detail` line. Contact
     identity stays in the invites table behind admin auth, linked by id/token.

  C. The one-on-one orientation admin surface is purpose-bound: it exposes the
     workflow fields (name, volunteered birth_date, invite linkage, status,
     timestamp) but withholds network identifiers (ip, user_agent).

  D. OM Cipher member-owned reads must NOT carry email / invite contact fields.

Run: python3 tests/invite-contact-privacy.test.py
"""
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="invite_priv_")
os.environ.setdefault("COMMONUNITY_ADMIN_DB_PATH", os.path.join(_tmp_dir, "admin.sqlite3"))
os.environ.setdefault("COMMONUNITY_MAGIC_LINK_TOKENS", "tokA,tokB")
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


# OM Cipher private fields that must never appear on a contact/invite surface,
# nor in the OM Cipher member read alongside contact identity. Mirrors the
# columns withheld by PR #72's _om_admin_metadata.
_OM_PRIVATE_FIELDS = (
    "legal_name", "life_path", "expression", "soul_urge", "personality",
    "lunar_phase", "solar_quarter", "gk_gate", "gk_line",
    "hd_type", "hd_authority", "hd_profile",
    "om_cipher_seed", "sigil_svg", "full_record_json", "birth_time",
)
# Golden Thread / reflection content fields.
_REFLECTION_FIELDS = ("content", "note", "companion", "unity_point")
# Real-world contact identity fields.
_CONTACT_FIELDS = ("email", "name", "notes")

assert server._signed_cookie_value("tokA", "invite"), "cookie signing not configured"

# ── Fixtures ──────────────────────────────────────────────────────────────────
# A contact-layer invite carrying real-world identity.
SECRET_EMAIL = "alice@example.com"
SECRET_NAME = "Alice Realname"
with server._admin_db() as conn:
    conn.execute("DELETE FROM invites")
    conn.execute("DELETE FROM events")
    conn.execute("DELETE FROM orientation_request")
    conn.execute("DELETE FROM om_cipher_members")
    conn.execute("DELETE FROM golden_thread")

c = fresh_client()

print("1. invite create/send/revoke do NOT broadcast contact identity in the events feed")
created = c.post(
    "/api/admin/invites",
    json={"name": SECRET_NAME, "email": SECRET_EMAIL, "notes": "vip"},
    cookies=admin_cookie(),
)
ok(created.status_code == 200, "admin can create an invite")
invite = created.json()["invite"]
invite_id = invite["id"]
# The invites surface itself legitimately carries contact fields (admin needs
# them operationally) — but it must NOT carry OM Cipher private fields.
for f in _OM_PRIVATE_FIELDS:
    ok(f not in invite, f"created invite row carries no OM Cipher field '{f}'")
for f in _REFLECTION_FIELDS:
    if f == "companion":
        continue  # not a column on invites; skip the generic name collision
    ok(f not in invite, f"created invite row carries no reflection field '{f}'")

c.post(f"/api/admin/invites/{invite_id}/revoke", json={}, cookies=admin_cookie())

metrics = c.get("/api/admin/metrics", cookies=admin_cookie())
ok(metrics.status_code == 200, "admin metrics authorized")
metrics_raw = metrics.text
ok(SECRET_EMAIL not in metrics_raw,
   "recipient email never appears in the metrics events feed")
ok(SECRET_NAME not in metrics_raw,
   "invitee name never appears in the metrics events feed")
for ev in metrics.json()["events"]:
    ok((ev.get("detail") or "") == "" or SECRET_NAME not in ev["detail"],
       f"event '{ev.get('type')}' detail carries no contact name")
    ok((ev.get("detail") or "") == "" or SECRET_EMAIL not in ev["detail"],
       f"event '{ev.get('type')}' detail carries no contact email")

print("\n2. /api/admin/invites exposes contact metadata but NO OM Cipher / reflection fields")
inv_list = c.get("/api/admin/invites", cookies=admin_cookie())
ok(inv_list.status_code == 200, "admin invites list authorized")
for row in inv_list.json()["invites"]:
    for f in _OM_PRIVATE_FIELDS:
        ok(f not in row, f"invite list row carries no OM Cipher field '{f}'")
    for f in ("content", "note", "unity_point"):
        ok(f not in row, f"invite list row carries no reflection field '{f}'")

print("\n3. one-on-one orientation surface is purpose-bound (no network identity, no OM Cipher)")
with server._admin_db() as conn:
    conn.execute(
        "INSERT INTO orientation_request (timestamp, name, birth_date, invite_token, "
        "user_agent, ip, status) VALUES (?,?,?,?,?,?, 'new')",
        (server._now_iso(), "Bob Companion", "1990-01-01", "tokA",
         "Mozilla/5.0 secret-ua", "203.0.113.7"),
    )
orient = c.get("/api/admin/orientation-requests", cookies=admin_cookie())
ok(orient.status_code == 200, "admin orientation surface authorized")
orient_raw = orient.text
ok("203.0.113.7" not in orient_raw, "orientation surface never leaks requester IP")
ok("secret-ua" not in orient_raw, "orientation surface never leaks user_agent")
entry = orient.json()["entries"][0]
ok("ip" not in entry, "orientation entry omits 'ip'")
ok("user_agent" not in entry, "orientation entry omits 'user_agent'")
for f in _OM_PRIVATE_FIELDS:
    ok(f not in entry, f"orientation entry carries no OM Cipher field '{f}'")
for f in _REFLECTION_FIELDS:
    if f == "companion":
        continue
    ok(f not in entry, f"orientation entry carries no reflection field '{f}'")
# Purpose-bound fields the workflow needs ARE present.
for f in ("id", "timestamp", "name", "birth_date", "invite_token", "status"):
    ok(f in entry, f"orientation entry exposes workflow field '{f}'")

print("\n4. OM Cipher (members) admin surface carries NO email / contact identity")
# The om_cipher_members table has no email/notes/invite_token columns by schema
# (PR #72), and the admin projection further restricts to operational metadata.
# Seed a member row and assert the admin members surface exposes no contact
# identity — closing the reverse direction (OM Cipher must not bundle contact).
now = server._now_iso()
with server._admin_db() as conn:
    conn.execute(
        "INSERT INTO om_cipher_members (member_id, name, birth_date, legal_name, "
        "life_path, gk_gate, hd_type, om_cipher_seed, sigil_svg, full_record_json, "
        "visibility_tier, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ("member_X", "Carol", "1992-05-05", "Carol Legalname", 7, 25, "Generator",
         "seed-secret", "<svg>sigil</svg>", '{"private":"record"}', "private", now, now),
    )
members = c.get("/api/admin/members", cookies=admin_cookie())
ok(members.status_code == 200, "admin members surface authorized")
members_raw = members.text
ok(SECRET_EMAIL not in members_raw,
   "admin members surface never contains any invite email")
ok("seed-secret" not in members_raw and "Legalname" not in members_raw,
   "admin members surface never contains OM Cipher private material")
for m in members.json()["members"]:
    for f in _CONTACT_FIELDS:
        ok(f not in m, f"members row carries no contact field '{f}'")
    ok("invite_token" not in m, "members row carries no invite_token linkage")
    for f in _OM_PRIVATE_FIELDS:
        ok(f not in m, f"members row carries no OM Cipher private field '{f}'")

print(f"\n{passed} passed")
