#!/usr/bin/env python3
"""Admin members privacy projection — regression tests.

Before this pass, GET /api/admin/members ran `SELECT * FROM om_cipher_members`
and returned every column verbatim: the member's real/preferred name and
legal_name, birth_date / birth_time, the derived numerology (life_path,
expression, soul_urge, personality), Gene Keys (gk_gate/gk_line), Human Design
(hd_type/authority/profile), temporal placements, the om_cipher_seed, the
rendered sigil_svg, and full_record_json (the entire OM Cipher source record).
All of that is the member's private OM Cipher identity and is not operationally
required by admin.

These tests boot the real FastAPI app via TestClient and assert that the admin
endpoint:
  * rejects non-admin callers
  * exposes ONLY operational metadata (pseudonymous member_id, visibility_tier,
    timestamps, internal row id)
  * never includes any personal identity / OM Cipher profile field
  * never leaks the known personal strings (name, legal name, birth date/time,
    seed, sigil, or reflection/thread content) via any field or serialized form
  * still returns a record per member plus an aggregate summary

Run: python3 tests/admin-members-privacy.test.py
(env defaults are set below if unset).
"""
import json
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="members_priv_")
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


# Personal strings that must NEVER appear in the admin response, in any field or
# in the raw serialized body.
SECRET_NAME = "Jane Q. Privatename"
SECRET_LEGAL = "Jane Quinhagak Privatename-Legal"
SECRET_BIRTH_DATE = "1987-04-23"
SECRET_BIRTH_TIME = "14:37"
SECRET_SEED = "seed-DEADBEEFsecret0123456789"
SECRET_SIGIL = "<svg id='private-sigil'><circle/></svg>"
SECRET_REFLECTION = "my-private-reflection-text"

# Identity columns that must be projected away.
PERSONAL_FIELDS = (
    "name", "legal_name", "birth_date", "birth_time",
    "life_path", "expression", "soul_urge", "personality",
    "lunar_phase", "solar_quarter", "gk_gate", "gk_line",
    "hd_type", "hd_authority", "hd_profile",
    "om_cipher_seed", "sigil_svg", "full_record_json",
)


def _insert_member(member_id):
    full_record = {
        "member_id": member_id,
        "input": {
            "preferred_name": SECRET_NAME,
            "legal_name": SECRET_LEGAL,
            "birth_date": SECRET_BIRTH_DATE,
            "birth_time": SECRET_BIRTH_TIME,
        },
        "reflection": SECRET_REFLECTION,
    }
    now = server._now_iso()
    with server._admin_db() as conn:
        conn.execute(
            """
            INSERT INTO om_cipher_members
                (member_id, name, birth_date, birth_time, legal_name,
                 life_path, expression, soul_urge, personality,
                 lunar_phase, solar_quarter, gk_gate, gk_line,
                 hd_type, hd_authority, hd_profile, visibility_tier,
                 om_cipher_seed, sigil_svg, full_record_json, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                member_id, SECRET_NAME, SECRET_BIRTH_DATE, SECRET_BIRTH_TIME, SECRET_LEGAL,
                7, 3, 9, 5, 4, 2, 41, 6,
                "Generator", "Sacral", "1/3", "private",
                SECRET_SEED, SECRET_SIGIL, json.dumps(full_record), now, now,
            ),
        )


# Clean slate + two fixture members carrying identity-rich data.
with server._admin_db() as conn:
    conn.execute("DELETE FROM om_cipher_members")
_insert_member("member-uuid-A")
_insert_member("member-uuid-B")

print("1. admin auth is required")
rNo = fresh_client().get("/api/admin/members")
ok(rNo.status_code in (401, 403), "non-admin caller rejected")

print("\n2. admin sees a record per member, metadata only")
rYes = fresh_client().get("/api/admin/members", cookies=admin_cookie())
ok(rYes.status_code == 200, "admin authorized with admin cookie")
body = rYes.json()
members = body["members"]
ok(len(members) == 2, "admin sees one record per member")
ok(body["total"] == 2, "total reflects member count")

print("\n3. no personal identity / OM Cipher profile field is present")
for entry in members:
    for field in PERSONAL_FIELDS:
        ok(field not in entry, f"admin entry omits personal field '{field}'")

print("\n4. known personal strings never leak via any field or serialized form")
raw = rYes.text
for secret in (SECRET_NAME, SECRET_LEGAL, SECRET_BIRTH_DATE, SECRET_BIRTH_TIME,
               SECRET_SEED, SECRET_SIGIL, SECRET_REFLECTION):
    ok(secret not in raw, f"admin response body never contains '{secret}'")

print("\n5. operational metadata that admin IS allowed to see is present and sane")
sample = members[0]
for field in ("id", "member_id", "visibility_tier", "created_at", "updated_at"):
    ok(field in sample, f"admin entry exposes operational field '{field}'")
ok({m["member_id"] for m in members} == {"member-uuid-A", "member-uuid-B"},
   "pseudonymous member_id is the visible key")
ok(all(m["visibility_tier"] == "private" for m in members),
   "visibility_tier operational flag preserved")

print("\n6. aggregate summary is present and content-free")
summary = body["summary"]
ok(summary["total"] == 2, "summary counts all members")
ok(summary["by_visibility_tier"].get("private") == 2,
   "summary aggregates by visibility tier")
ok(SECRET_NAME not in json.dumps(summary), "summary carries no personal data")

print(f"\n{passed} passed")
