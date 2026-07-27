#!/usr/bin/env python3
"""stUdio context mode — defaults, activation, rollback, and safe failure.

The non-negotiable property this suite defends: production behaviour stays
`legacy` until an operator explicitly activates something else, and everything
ambiguous resolves back to `legacy`.

  * default is legacy with no settings written
  * activation requires admin auth AND an explicit confirmation step
  * activation retains the previous mode and writes audit metadata
  * rollback is one action, always to legacy, and loses nothing
  * absent / invalid / stale configuration fails safely back to legacy
  * the context mode is independent of the Nexus model and effort selection,
    in both directions
  * grounded_v1 cannot be activated while the canonical corpus is unhealthy

Run: python3 tests/studio-context-modes.test.py
"""
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="sc_modes_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_tmp_dir, "admin.sqlite3")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "rootadmin")
os.environ.pop("STUDIO_CONTEXT_MODE", None)
os.environ.pop("STUDIO_CONTEXT_FAILURE_POLICY", None)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from studio_context import canonical, modes  # noqa: E402

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


def admin_client():
    c = fresh_client()
    c.cookies.set(server._ADMIN_COOKIE, server._signed_cookie_value("open", "admin"))
    return c


def clear_mode_settings():
    with server._admin_db() as conn:
        conn.execute(
            "DELETE FROM app_settings WHERE key IN (?, ?, ?, ?)",
            (
                modes.MODE_SETTING_KEY,
                modes.MODE_PREV_SETTING_KEY,
                modes.MODE_ACTIVATION_KEY,
                modes.FAILURE_POLICY_SETTING_KEY,
            ),
        )
        conn.commit()


admin = admin_client()

print("\n── defaults ──")
clear_mode_settings()
ok(modes.current_mode() == "legacy", "default mode is legacy with nothing persisted")
ok(modes.DEFAULT_MODE == "legacy", "the declared default is legacy")
ok(not modes.is_grounded(), "is_grounded() is false by default")
ok(modes.failure_policy() == "fail_closed", "default failure policy is fail_closed")

state = admin.get("/api/admin/studio-context-mode").json()
ok(state["mode"] == "legacy", "admin state reports legacy")
ok(state["source"] == "default", "admin state reports the default source")
ok(state["rollback_available"] is False, "no rollback offered while already legacy")
ok(state["modes"] == ["legacy", "grounded_v1"], "both modes are advertised")
ok(state["grounded"] is False, "state.grounded is false")

print("\n── admin auth ──")
anon = fresh_client()
ok(anon.get("/api/admin/studio-context-mode").status_code == 401,
   "unauthenticated read is rejected")
ok(anon.post("/api/admin/studio-context-mode/activate",
             json={"mode": "grounded_v1", "confirm": True}).status_code == 401,
   "unauthenticated activation is rejected")
ok(anon.post("/api/admin/studio-context-mode/rollback").status_code == 401,
   "unauthenticated rollback is rejected")
ok(anon.put("/api/admin/studio-context-failure-policy",
            json={"failure_policy": "fallback_legacy"}).status_code == 401,
   "unauthenticated policy change is rejected")
ok(anon.get("/api/admin/studio-context-sources").status_code == 401,
   "unauthenticated source check is rejected")
ok(modes.current_mode() == "legacy", "no rejected call changed the mode")

print("\n── confirmation step ──")
r = admin.post("/api/admin/studio-context-mode/activate", json={"mode": "grounded_v1"})
ok(r.status_code == 422, "activation without confirm is rejected (422)")
ok("confirmation" in r.json()["detail"], "the rejection names the missing confirmation")
ok(modes.current_mode() == "legacy", "an unconfirmed activation did not change the mode")

r = admin.post("/api/admin/studio-context-mode/activate",
               json={"mode": "grounded_v1", "confirm": False})
ok(r.status_code == 422, "confirm=false is rejected too")

print("\n── invalid values ──")
for bad in ("grounded", "GROUNDED_V2", "", "legacy; drop table", "null", "0"):
    r = admin.post("/api/admin/studio-context-mode/activate",
                   json={"mode": bad, "confirm": True})
    ok(r.status_code == 422, f"unknown mode rejected: {bad!r}")
ok(modes.current_mode() == "legacy", "no invalid activation changed the mode")

r = admin.put("/api/admin/studio-context-failure-policy",
              json={"failure_policy": "yolo"})
ok(r.status_code == 422, "unknown failure policy rejected")
ok(modes.failure_policy() == "fail_closed", "failure policy unchanged after rejection")

print("\n── corpus gate ──")
sources = admin.get("/api/admin/studio-context-sources").json()
ok(sources["ok"] and sources["present"] == 64, "corpus reports healthy before activation")

print("\n── activation ──")
r = admin.post("/api/admin/studio-context-mode/activate",
               json={"mode": "grounded_v1", "confirm": True, "reason": "phase 1 pilot"})
ok(r.status_code == 200, "confirmed activation succeeds")
state = r.json()
ok(state["mode"] == "grounded_v1", "state reports grounded_v1")
ok(state["source"] == "admin", "state reports the admin source")
ok(state["previous_mode"] == "legacy", "the outgoing mode is retained for rollback")
ok(state["rollback_available"] is True, "rollback is now offered")
ok(state["grounded"] is True, "state.grounded is true")
ok(modes.current_mode() == "grounded_v1", "the resolver agrees, with no restart")

activation = state["last_activation"]
ok(activation["mode"] == "grounded_v1", "activation metadata records the target mode")
ok(activation["previous_mode"] == "legacy", "activation metadata records the previous mode")
ok(activation["actor"] == "admin", "activation metadata records the actor")
ok(activation["reason"] == "phase 1 pilot", "activation metadata records the reason")
ok(bool(activation["activated_at"]), "activation metadata records a timestamp")

with server._admin_db() as conn:
    events = [
        row["type"]
        for row in conn.execute(
            "SELECT type FROM events WHERE type LIKE 'studio_context%' ORDER BY id"
        ).fetchall()
    ]
ok("studio_context_mode_activated" in events, "activation is audited in the events table")

print("\n── independence from the AI model selection ──")
model_before = server._nexus_model()
effort_before = server._nexus_effort()
admin.post("/api/admin/studio-context-mode/rollback")
admin.post("/api/admin/studio-context-mode/activate",
           json={"mode": "grounded_v1", "confirm": True})
ok(server._nexus_model() == model_before, "switching context mode leaves the model unchanged")
ok(server._nexus_effort() == effort_before, "switching context mode leaves the effort unchanged")

admin.put("/api/admin/nexus-effort", json={"effort": "low"})
ok(server._nexus_effort() == "low", "the effort setting still changes independently")
ok(modes.current_mode() == "grounded_v1", "changing the effort leaves the context mode unchanged")
admin.put("/api/admin/nexus-effort", json={"effort": effort_before})

with server._admin_db() as conn:
    conn.execute(
        """INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value""",
        (server._NEXUS_MODEL_SETTING_KEY, "claude-test-model", server._now_iso()),
    )
    conn.commit()
ok(server._nexus_model() == "claude-test-model", "the model setting applies")
ok(modes.current_mode() == "grounded_v1", "changing the model leaves the context mode unchanged")
admin.post("/api/admin/studio-context-mode/rollback")
ok(server._nexus_model() == "claude-test-model", "rolling back the context mode leaves the model")
with server._admin_db() as conn:
    conn.execute("DELETE FROM app_settings WHERE key = ?", (server._NEXUS_MODEL_SETTING_KEY,))
    conn.commit()

ok(modes.MODE_SETTING_KEY != server._NEXUS_MODEL_SETTING_KEY,
   "the context mode uses a different settings key from the model")
ok(modes.MODE_SETTING_KEY not in (server._NEXUS_EFFORT_SETTING_KEY,
                                  server._NEXUS_MODEL_PREV_SETTING_KEY,
                                  server._NEXUS_MODEL_VALIDATION_KEY),
   "the context mode does not collide with any model-management key")

print("\n── rollback ──")
admin.post("/api/admin/studio-context-mode/activate",
           json={"mode": "grounded_v1", "confirm": True})
ok(modes.current_mode() == "grounded_v1", "grounded again, ready to roll back")
r = admin.post("/api/admin/studio-context-mode/rollback")
ok(r.status_code == 200, "rollback is a single unconfirmed action")
state = r.json()
ok(state["mode"] == "legacy", "rollback lands on legacy")
ok(state["previous_mode"] == "grounded_v1", "rollback retains what it rolled back from")
ok(modes.current_mode() == "legacy", "the resolver agrees after rollback")

# Rollback always targets legacy, so the rollback control can never itself
# activate an experimental mode.
admin.post("/api/admin/studio-context-mode/rollback")
ok(modes.current_mode() == "legacy", "rolling back twice stays on legacy")

print("\n── round trip, both directions ──")
for step in range(3):
    admin.post("/api/admin/studio-context-mode/activate",
               json={"mode": "grounded_v1", "confirm": True})
    assert modes.current_mode() == "grounded_v1", f"round trip {step}: forward"
    admin.post("/api/admin/studio-context-mode/rollback")
    assert modes.current_mode() == "legacy", f"round trip {step}: back"
ok(True, "switching both directions repeatedly always lands where asked")

admin.post("/api/admin/studio-context-mode/activate",
           json={"mode": "legacy", "confirm": True})
ok(modes.current_mode() == "legacy", "activating legacy explicitly is allowed")

print("\n── fail-safe configuration ──")
admin.post("/api/admin/studio-context-mode/activate",
           json={"mode": "grounded_v1", "confirm": True})
ok(modes.current_mode() == "grounded_v1", "grounded, about to corrupt the settings")

with server._admin_db() as conn:
    conn.execute("UPDATE app_settings SET value = ? WHERE key = ?",
                 ("grounded_v9", modes.MODE_SETTING_KEY))
    conn.commit()
ok(modes.current_mode() == "legacy", "an unknown persisted mode falls back to legacy")
ok(modes.state()["stored_raw_status"] == "invalid", "state explains the value was invalid")

with server._admin_db() as conn:
    conn.execute("UPDATE app_settings SET value = ? WHERE key = ?",
                 ("grounded_v1", modes.MODE_SETTING_KEY))
    conn.execute("UPDATE app_settings SET value = ? WHERE key = ?",
                 ('{"mode": "legacy"}', modes.MODE_ACTIVATION_KEY))
    conn.commit()
ok(modes.current_mode() == "legacy",
   "an activation record disagreeing with the mode is treated as stale → legacy")
ok(modes.state()["stored_raw_status"] == "stale", "state explains the value was stale")

with server._admin_db() as conn:
    conn.execute("UPDATE app_settings SET value = '' WHERE key = ?", (modes.MODE_SETTING_KEY,))
    conn.commit()
ok(modes.current_mode() == "legacy", "an empty persisted mode falls back to legacy")

clear_mode_settings()
ok(modes.current_mode() == "legacy", "a deleted setting falls back to legacy")
ok(modes.state()["stored_raw_status"] == "unset", "state explains the value was unset")

# The break-glass rollback documented in docs/architecture/studio-context-modes.md
admin.post("/api/admin/studio-context-mode/activate",
           json={"mode": "grounded_v1", "confirm": True})
with server._admin_db() as conn:
    conn.execute("DELETE FROM app_settings WHERE key = ?", (modes.MODE_ACTIVATION_KEY,))
    conn.commit()
ok(modes.current_mode() == "grounded_v1",
   "deleting only the activation record leaves an otherwise-valid mode intact")
with server._admin_db() as conn:
    conn.execute("UPDATE app_settings SET value = 'legacy' WHERE key = ?",
                 (modes.MODE_SETTING_KEY,))
    conn.commit()
ok(modes.current_mode() == "legacy", "the documented break-glass SQL rollback works")

print("\n── failure policy ──")
clear_mode_settings()
ok(modes.failure_policy() == "fail_closed", "policy defaults to fail_closed")
r = admin.put("/api/admin/studio-context-failure-policy",
              json={"failure_policy": "fallback_legacy"})
ok(r.status_code == 200 and r.json()["failure_policy"] == "fallback_legacy",
   "policy can be set to fallback_legacy")
ok(modes.failure_policy() == "fallback_legacy", "the resolver agrees")
with server._admin_db() as conn:
    conn.execute("UPDATE app_settings SET value = 'whatever' WHERE key = ?",
                 (modes.FAILURE_POLICY_SETTING_KEY,))
    conn.commit()
ok(modes.failure_policy() == "fail_closed", "a corrupt policy falls back to fail_closed")
clear_mode_settings()

print("\n── env default ──")
os.environ["STUDIO_CONTEXT_MODE"] = "grounded_v1"
ok(modes.current_mode() == "grounded_v1", "the env var supplies a boot-time default")
ok(modes.mode_source() == "env", "state attributes the mode to the env var")
os.environ["STUDIO_CONTEXT_MODE"] = "nonsense"
ok(modes.current_mode() == "legacy", "an invalid env var falls back to legacy")
os.environ.pop("STUDIO_CONTEXT_MODE", None)
ok(modes.current_mode() == "legacy", "removing the env var returns to legacy")

print("\n── unhealthy corpus blocks activation ──")
_real_verify = canonical.verify_corpus
canonical.verify_corpus = lambda *a, **k: {
    "root": "", "expected": 64, "present": 63, "ok": False,
    "problems": ["canonical source missing: gk_07.json"], "source_version": "",
}
try:
    r = admin.post("/api/admin/studio-context-mode/activate",
                   json={"mode": "grounded_v1", "confirm": True})
    ok(r.status_code == 422, "grounded_v1 cannot be activated on an unhealthy corpus")
    ok("63/64" in r.json()["detail"], "the rejection reports what is missing")
    ok(modes.current_mode() == "legacy", "the mode is unchanged after a rejected activation")
    r = admin.post("/api/admin/studio-context-mode/activate",
                   json={"mode": "legacy", "confirm": True})
    ok(r.status_code == 200, "legacy activation is never blocked by corpus health")
finally:
    canonical.verify_corpus = _real_verify

clear_mode_settings()
ok(modes.current_mode() == "legacy", "suite leaves production behaviour on legacy")


def test_studio_context_modes():
    """pytest entry point — the module body is the suite."""
    assert passed > 0


print(f"\n{passed} passed")
