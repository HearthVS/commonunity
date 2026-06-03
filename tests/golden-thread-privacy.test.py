#!/usr/bin/env python3
"""Golden Thread privacy isolation — regression tests for the cross-user leak.

Before this hotfix, GET /api/golden-thread was keyed by the client-supplied
`companion` (a first name) and fell back to returning the ENTIRE table when no
companion was given. Any beta/invite member could therefore read another
member's saved reflections (which embed their Gene Keys / personal material).

These tests boot the real FastAPI app via TestClient and assert per-user
isolation:
  * user B (different cipher_id) cannot read user A's rows
  * an empty / omitted identity returns no rows (no whole-table dump)
  * a legacy companion-only request does not leak across users
  * legacy rows (no cipher_id) are exposed only on an unambiguous invite-token
    cookie match bound to the caller; an orphan legacy row is never exposed
  * the admin endpoint still returns everything behind admin auth

Run: python3 tests/golden-thread-privacy.test.py
(env defaults are set below if unset).
"""
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="gt_priv_")
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


def invite_cookie(token):
    return {server._INVITE_COOKIE: server._signed_cookie_value(token, "invite")}


def admin_cookie():
    return {server._ADMIN_COOKIE: server._signed_cookie_value("open", "admin")}


def _insert(companion="", cipher_id="", invite_token="", content="x"):
    with server._admin_db() as conn:
        conn.execute(
            "INSERT INTO golden_thread (timestamp, companion, source_app, content, "
            "note, invite_token, cipher_id, unity_point) VALUES (?,?,?,?,?,?,?,?)",
            (server._now_iso(), companion, "test", content, "", invite_token, cipher_id, ""),
        )


def contents(resp):
    return sorted(t["content"] for t in resp.json()["threads"])


# Sanity: signing must be active in this env, else cookie-based checks are moot.
assert server._signed_cookie_value("tokA", "invite"), "cookie signing not configured"

# Clean slate + fixtures: two members who share the first name "Markus".
with server._admin_db() as conn:
    conn.execute("DELETE FROM golden_thread")
_insert(companion="Markus", cipher_id="cipher_A", invite_token="tokA", content="A-secret")
_insert(companion="Markus", cipher_id="cipher_B", invite_token="tokB", content="B-note")
_insert(companion="Markus", cipher_id="", invite_token="tokA", content="legacy-A")
_insert(companion="Markus", cipher_id="", invite_token="", content="orphan")

print("1. per-user isolation by cipher_id")
c = fresh_client()
rA = c.get("/api/golden-thread", params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA"))
ok(rA.status_code == 200, "member A request authorized")
ok(contents(rA) == ["A-secret"], "A sees only its own cipher_A row")

rB = c.get("/api/golden-thread", params={"cipher_id": "cipher_B"}, cookies=invite_cookie("tokB"))
ok(contents(rB) == ["B-note"], "B sees only its own cipher_B row")
ok("A-secret" not in contents(rB), "B CANNOT read A's row (cross-user leak closed)")

print("\n2. no whole-table dump when identity is omitted")
# A caller authorized via ?invite= query only (no cookie, no cipher_id) has no
# resolvable per-user key, so they must get an EMPTY list — never the whole
# table. This is the exact branch that previously dumped every member's rows.
rQuery = fresh_client().get("/api/golden-thread", params={"invite": "tokB"})
ok(rQuery.status_code == 200, "query-authorized request still authorized")
ok(rQuery.json()["threads"] == [],
   "no cipher_id and no invite cookie -> NO rows (the old all-rows branch is gone)")
ok("A-secret" not in contents(rQuery) and "orphan" not in contents(rQuery),
   "the unfiltered whole-table dump is impossible")

# A cookie caller with no cipher_id resolves only to THEIR OWN token's rows,
# never another member's.
rCookieOnly = fresh_client().get("/api/golden-thread", cookies=invite_cookie("tokB"))
ok(contents(rCookieOnly) == ["B-note"],
   "cookie-only caller sees only their own token-bound rows, not the table")
ok("A-secret" not in contents(rCookieOnly), "cookie-only caller cannot read A's rows")

print("\n3. legacy companion-only request does not leak across users")
# Authorized via query token, NO cookie, only a companion first-name supplied
# (the old leak shape). companion must not resolve any rows.
rCompanion = fresh_client().get(
    "/api/golden-thread", params={"invite": "tokB", "companion": "Markus"}
)
ok(rCompanion.json()["threads"] == [],
   "companion='Markus' alone returns nothing (first-name key no longer reads rows)")
# Even a cookie caller's result is unaffected by companion — it never widens.
rCookie = fresh_client().get("/api/golden-thread", cookies=invite_cookie("tokB"))
rCookiePlusName = fresh_client().get(
    "/api/golden-thread", params={"companion": "Markus"}, cookies=invite_cookie("tokB")
)
ok(contents(rCookie) == contents(rCookiePlusName),
   "adding companion='Markus' does not widen a cookie caller's own result set")

print("\n4. legacy rows (no cipher_id) exposed only on unambiguous invite-token match")
# Cookie-only caller (no cipher_id query) resolves by their own invite token:
# they see every row bound to tokA — the cipher_id-less legacy row AND any of
# their own cipher_id rows that carry the same token — but never another
# member's rows and never the unbound orphan.
rLegacy = fresh_client().get("/api/golden-thread", cookies=invite_cookie("tokA"))
ok("legacy-A" in contents(rLegacy),
   "tokA caller sees its own cipher_id-less legacy row by invite-token match")
ok("orphan" not in contents(rLegacy),
   "orphan legacy row (no cipher_id, no invite_token) is never exposed")
ok("B-note" not in contents(rLegacy),
   "invite-token fallback never returns another member's rows")

print("\n5. admin endpoint exposes metadata only — never thread content")
rAdminNo = fresh_client().get("/api/admin/golden-thread")
ok(rAdminNo.status_code in (401, 403), "admin endpoint rejects non-admin")
rAdminYes = fresh_client().get("/api/admin/golden-thread", cookies=admin_cookie())
ok(rAdminYes.status_code == 200, "admin authorized with admin cookie")
admin_body = rAdminYes.json()
admin_threads = admin_body["threads"]
ok(len(admin_threads) >= 4, "admin sees a metadata record for every row across members")

# Content fields must NOT appear anywhere in the admin response.
_CONTENT_FIELDS = ("content", "note", "companion")
for entry in admin_threads:
    for field in _CONTENT_FIELDS:
        ok(field not in entry, f"admin entry omits content field '{field}'")
# The known secret/personal strings must not leak via any field or serialized form.
admin_raw = rAdminYes.text
for secret in ("A-secret", "B-note", "legacy-A", "orphan", "Markus"):
    ok(secret not in admin_raw, f"admin response body never contains '{secret}'")

# Metadata that admin IS allowed to see is present and sane.
sample = admin_threads[0]
for field in ("id", "timestamp", "source_app", "cipher_id", "unity_point",
              "char_count", "byte_size", "token_estimate"):
    ok(field in sample, f"admin entry exposes metadata field '{field}'")
ok(all(isinstance(e["char_count"], int) and e["char_count"] >= 0 for e in admin_threads),
   "char_count is a non-negative integer for every entry")
ok(all(e["token_estimate"] >= 0 for e in admin_threads),
   "token_estimate is non-negative for every entry")

# Aggregate summary is present and content-free.
summary = admin_body["summary"]
for field in ("total_entries", "returned", "distinct_members",
              "total_byte_size", "total_char_count", "total_token_estimate"):
    ok(field in summary, f"summary exposes metadata field '{field}'")
ok(summary["total_entries"] >= 4, "summary counts all stored entries")

print(f"\n{passed} passed")
