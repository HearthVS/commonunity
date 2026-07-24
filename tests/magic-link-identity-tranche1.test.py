#!/usr/bin/env python3
"""Magic-link identity security (Tranche 1) — server-side regression tests.

Launch-blocking incident: a companion's cOMpass session read the account owner
(Markus) as its identity, because identity came from client-supplied JSON with
no server-side binding. Tranche 1 makes the invite the authoritative, server-
side identity record and resolves WHO a session belongs to from the signed
HttpOnly invite cookie — never from a URL claim, imported JSON, or an owner
default.

This suite exercises the real FastAPI app + a temp SQLite admin DB with three
actors — Markus (Guide/admin), Eda (Companion), and Amara (a second clean
Companion) — and asserts:

  * a valid companion magic link exchanges into a session whose
    /api/session/identity is the bound companion (Eda), with role='companion';
  * unknown / revoked / expired secrets are denied (fail closed);
  * the magic-link SECRET is never persisted in plaintext — only SHA-256(secret)
    lives at rest, and the `token` column is a non-secret public reference;
  * the invite/beta cookies are HttpOnly + SameSite=Lax (and Secure under
    https);
  * cross-companion isolation — Eda's session never resolves to Amara and vice
    versa;
  * NO owner/Markus fallback — a legacy invite or a session with no companion
    binding resolves to authenticated:false / role:None;
  * admin-gated create / revoke / reissue, and that reissue rotates the secret
    (old link dies, new link works).

No real email or network is used. Run:
    python3 tests/magic-link-identity-tranche1.test.py
"""
import hashlib
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="magic_link_tranche1_")
os.environ.setdefault("COMMONUNITY_ADMIN_DB_PATH", os.path.join(_tmp_dir, "admin.sqlite3"))
os.environ.setdefault("COMMONUNITY_MAGIC_LINK_TOKENS", "legacyEnvToken")
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


def secret_from_link(link):
    # magic link is .../invite/<secret>
    return link.rsplit("/invite/", 1)[1]


def create_companion(c, **kw):
    r = c.post("/api/admin/invites/companion", json=kw, cookies=admin_cookie())
    assert r.status_code == 200, r.text
    body = r.json()
    return body["invite"], secret_from_link(body["magic_link"])


with server._admin_db() as conn:
    conn.execute("DELETE FROM invites")
    conn.execute("DELETE FROM events")

# ── 1. Admin creates a companion invite for Eda, bound to Guide Markus ─────────
print("1. companion invite creation binds authoritative identity + role")
eda_invite, eda_secret = create_companion(
    fresh_client(),
    companion_name="Eda Çarmıklı",
    companion_id="cmp-eda-001",
    guide_name="Markus Lehto",
    guide_id="guide-markus",
    circle="First Beta Circle",
)
ok(eda_invite["kind"] == "companion", "invite is kind='companion'")
ok(eda_invite["role"] == "companion", "invite role is forced to 'companion'")
ok(eda_invite["companion_name"] == "Eda Çarmıklı", "companion_name is bound on the invite")
ok(eda_invite["guide_name"] == "Markus Lehto", "guide identity is bound on the invite")
ok("token" not in eda_invite, "admin row never carries the raw token column")
ok(eda_invite.get("secret_bound") is True, "admin row flags a hashed secret is bound")

# ── 2. No plaintext secret at rest — only its hash ─────────────────────────────
print("\n2. the magic-link secret is never persisted in plaintext")
with server._admin_db() as conn:
    row = dict(conn.execute("SELECT * FROM invites WHERE id=?", (eda_invite["id"],)).fetchone())
ok(eda_secret and len(eda_secret) >= 20, "a real secret was minted and returned once")
ok(row["token"] != eda_secret, "the `token` column is NOT the secret")
ok(row["token"].startswith("cmp_"), "the `token` column is a non-secret public reference")
ok(row["token_hash"] == hashlib.sha256(eda_secret.encode()).hexdigest(),
   "token_hash is exactly SHA-256(secret)")
# The secret must not appear anywhere in the persisted row.
ok(eda_secret not in "".join(str(v) for v in row.values()),
   "the plaintext secret appears in NO column of the invite row")

# ── 3. Valid exchange establishes a fail-closed server session as Eda ──────────
print("\n3. valid magic link exchanges into a session bound to Eda")
eda = fresh_client()
hop = eda.get(f"/invite/{server.quote(eda_secret, safe='')}", follow_redirects=False)
ok(hop.status_code == 303 and hop.headers.get("location") == "/threshold",
   "companion magic link redirects to /threshold")
set_cookie = hop.headers.get("set-cookie", "")
ok(server._BETA_COOKIE in set_cookie and server._INVITE_COOKIE in set_cookie,
   "exchange sets both the beta and invite cookies")
ok("httponly" in set_cookie.lower(), "session cookies are HttpOnly")
ok("samesite=lax" in set_cookie.lower(), "session cookies are SameSite=Lax")
# The public reference (not the secret) is what the cookie carries.
ok(eda_secret not in set_cookie, "the secret is never placed in a cookie")

ident = eda.get("/api/session/identity").json()
ok(ident["authenticated"] is True, "session resolves as authenticated")
ok(ident["role"] == "companion", "session role is companion")
ok(ident["companion_name"] == "Eda Çarmıklı", "session identity is Eda — not the owner")
ok(ident["guide_name"] == "Markus Lehto", "session carries the bound guide label")
ok(ident["companion_id"] == "cmp-eda-001", "session carries the bound companion id")

# ── 4. Secure cookie flags include Secure under https ──────────────────────────
print("\n4. session cookies are marked Secure under https")
eda_https = TestClient(server.app, base_url="https://testserver")
eda_https.cookies.clear()
hop_https = eda_https.get(
    f"/invite/{server.quote(eda_secret, safe='')}",
    follow_redirects=False,
)
ok("secure" in hop_https.headers.get("set-cookie", "").lower(),
   "session cookies set Secure when the request is https")

# ── 5. No Markus/owner fallback — unbound sessions fail closed ─────────────────
print("\n5. no owner/Markus fallback for unbound sessions")
anon = fresh_client()
anon_ident = anon.get("/api/session/identity").json()
ok(anon_ident["authenticated"] is False and anon_ident["role"] is None,
   "a session with no invite cookie is authenticated:false / role:None")
ok(anon_ident["companion_name"] == "", "unbound session exposes no companion name")

# A legacy env-token / personal invite carries NO companion binding, so it must
# also fail closed at the identity endpoint (it can browse, but asserts no
# companion identity — and certainly not the owner).
legacy = fresh_client()
legacy.get("/invite/legacyEnvToken", follow_redirects=False)
legacy_ident = legacy.get("/api/session/identity").json()
ok(legacy_ident["authenticated"] is False,
   "a legacy env-token session binds no companion identity (fail closed)")

# ── 6. Cross-companion isolation ───────────────────────────────────────────────
print("\n6. a second clean companion never bleeds into Eda's identity")
amara_invite, amara_secret = create_companion(
    fresh_client(), companion_name="Amara Okonkwo", guide_name="Markus Lehto",
)
amara = fresh_client()
amara.get(f"/invite/{server.quote(amara_secret, safe='')}", follow_redirects=False)
amara_ident = amara.get("/api/session/identity").json()
ok(amara_ident["companion_name"] == "Amara Okonkwo", "Amara's session resolves to Amara")
# Eda's already-established session is unchanged by Amara enrolling.
ok(eda.get("/api/session/identity").json()["companion_name"] == "Eda Çarmıklı",
   "Eda's session still resolves to Eda (no cross-bleed)")
ok(amara_secret != eda_secret and amara_invite["id"] != eda_invite["id"],
   "each companion gets an independent secret + invite record")

# ── 7. Unknown / revoked / expired secrets are denied ──────────────────────────
print("\n7. unknown, revoked, and expired secrets are denied (fail closed)")
ok(server._lookup_companion_invite_by_secret("not-a-real-secret") is None,
   "an unknown secret resolves to no invite")
bad = fresh_client()
bad_hop = bad.get("/invite/not-a-real-secret", follow_redirects=False)
ok(bad_hop.status_code != 303 or bad_hop.headers.get("location") != "/threshold" or
   server._INVITE_COOKIE not in bad_hop.headers.get("set-cookie", ""),
   "an unknown secret does not mint a companion session")

# Revoke Eda → her secret and her established session both die.
fresh_client().post(f"/api/admin/invites/{eda_invite['id']}/revoke", json={},
                    cookies=admin_cookie())
ok(server._lookup_companion_invite_by_secret(eda_secret) is None,
   "a revoked companion secret no longer resolves")
ok(eda.get("/api/session/identity").json()["authenticated"] is False,
   "a revoked invite fails closed for an already-open session")
with server._admin_db() as conn:
    rev = dict(conn.execute("SELECT * FROM invites WHERE id=?", (eda_invite["id"],)).fetchone())
ok(rev["status"] == "revoked" and (rev["revoked_at"] or "").strip(),
   "revoke flips status and stamps revoked_at")

# Expired invite → denied.
exp_invite, exp_secret = create_companion(
    fresh_client(), companion_name="Expired Person", expires_at="2000-01-01T00:00:00Z",
)
ok(server._lookup_companion_invite_by_secret(exp_secret) is None,
   "an expired companion secret is denied")

# ── 8. Reissue rotates the secret (old dies, new works); admin-gated ───────────
print("\n8. reissue rotates the secret; create/revoke/reissue are admin-gated")
live_invite, live_secret = create_companion(fresh_client(), companion_name="Rotating Rae")
reissue = fresh_client().post(f"/api/admin/invites/{live_invite['id']}/reissue", json={},
                              cookies=admin_cookie())
ok(reissue.status_code == 200, "admin can reissue a companion invite")
new_secret = secret_from_link(reissue.json()["magic_link"])
ok(new_secret != live_secret, "reissue mints a different secret")
ok(server._lookup_companion_invite_by_secret(live_secret) is None,
   "the old secret stops working after reissue")
ok(server._lookup_companion_invite_by_secret(new_secret) is not None,
   "the new secret works after reissue")
# The reissued invite keeps the bound identity.
ok(server._lookup_companion_invite_by_secret(new_secret)["companion_name"] == "Rotating Rae",
   "reissue preserves the bound companion identity")

# Admin gating.
ok(fresh_client().post("/api/admin/invites/companion",
                       json={"companion_name": "X"}).status_code == 401,
   "companion create rejects non-admin callers")
ok(fresh_client().post(f"/api/admin/invites/{live_invite['id']}/reissue",
                       json={}).status_code == 401,
   "reissue rejects non-admin callers")
# Reissue is companion-only (legacy invites have no identity to rotate).
legacy_row = fresh_client().post("/api/admin/invites", json={"name": "Legacy"},
                                 cookies=admin_cookie()).json()["invite"]
ok(fresh_client().post(f"/api/admin/invites/{legacy_row['id']}/reissue", json={},
                       cookies=admin_cookie()).status_code == 400,
   "reissue is rejected for non-companion invites")

# ── 9. The /link reveal never resurrects a companion secret ────────────────────
print("\n9. companion links are one-time — reveal cannot resurrect the secret")
reveal = fresh_client().get(f"/api/admin/invites/{live_invite['id']}/link",
                            cookies=admin_cookie()).json()
ok(reveal.get("reissue_required") is True and not reveal.get("magic_link"),
   "reveal returns no working link for a companion invite (reissue required)")

print(f"\n{passed} passed")
