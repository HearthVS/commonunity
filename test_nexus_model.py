"""Tests for the Nexus model + reasoning-effort baseline.

Pins the fixed default model (claude-sonnet-5), the default effort (high), the
admin-only effort control (auth / validation / durable persistence), and that
the active effort actually propagates into the Anthropic request as
output_config.effort. No real API calls are made — the Anthropic client is
monkeypatched.

Run with:  python -m unittest test_nexus_model -v
(uses stdlib unittest + FastAPI's TestClient — no new dependencies)
"""

import os
import tempfile
import types
import unittest

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
_TMP_DB = os.path.join(tempfile.gettempdir(), "commonunity_nexus_test.sqlite3")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = _TMP_DB

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]


def _auth_client() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


def _reset_effort_override():
    """Clear any persisted admin override (empty normalises to unset)."""
    server._set_setting(server._NEXUS_EFFORT_SETTING_KEY, "")


class ModelDefaultTests(unittest.TestCase):
    def test_default_model_is_sonnet_5(self):
        self.assertEqual(server._NEXUS_MODEL, "claude-sonnet-5")

    def test_default_effort_is_high(self):
        os.environ.pop("NEXUS_EFFORT", None)
        _reset_effort_override()
        self.assertEqual(server._nexus_effort(), "high")

    def test_output_config_shape(self):
        os.environ.pop("NEXUS_EFFORT", None)
        _reset_effort_override()
        self.assertEqual(server._nexus_output_config(), {"effort": "high"})

    def test_levels_are_low_medium_high(self):
        self.assertEqual(server._NEXUS_EFFORT_LEVELS, ("low", "medium", "high"))


class EffortEndpointAuthTests(unittest.TestCase):
    def test_requires_admin(self):
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/admin/nexus-effort").status_code, 401)
        self.assertEqual(
            anon.put("/api/admin/nexus-effort", json={"effort": "low"}).status_code,
            401,
        )

    def test_get_returns_state_shape(self):
        c = _auth_client()
        d = c.get("/api/admin/nexus-effort").json()
        for key in ("model", "effort", "source", "levels", "env_default"):
            self.assertIn(key, d)
        self.assertEqual(d["model"], "claude-sonnet-5")
        self.assertEqual(d["levels"], ["low", "medium", "high"])

    def test_no_secret_leakage(self):
        c = _auth_client()
        raw = c.get("/api/admin/nexus-effort").text
        self.assertNotIn("sk-test-key-should-not-leak", raw)
        self.assertNotIn(ADMIN_CODE, raw)


class EffortValidationAndPersistenceTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("NEXUS_EFFORT", None)
        _reset_effort_override()
        self.c = _auth_client()

    def tearDown(self):
        _reset_effort_override()

    def test_rejects_invalid_effort(self):
        for bad in ("ultra", "", "HIGHER", "xhigh", "max"):
            r = self.c.put("/api/admin/nexus-effort", json={"effort": bad})
            self.assertEqual(r.status_code, 422, f"expected 422 for {bad!r}: {r.text}")

    def test_accepts_and_persists_valid_effort(self):
        r = self.c.put("/api/admin/nexus-effort", json={"effort": "low"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["effort"], "low")
        self.assertEqual(r.json()["source"], "admin")
        # Durable: a fresh read (new DB connection) returns the stored value,
        # which is what survives a process restart / redeploy.
        self.assertEqual(server._get_setting(server._NEXUS_EFFORT_SETTING_KEY), "low")
        self.assertEqual(server._nexus_effort(), "low")

    def test_case_insensitive_and_trimmed(self):
        r = self.c.put("/api/admin/nexus-effort", json={"effort": "  Medium "})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["effort"], "medium")

    def test_admin_override_beats_env_default(self):
        os.environ["NEXUS_EFFORT"] = "low"
        try:
            self.c.put("/api/admin/nexus-effort", json={"effort": "high"})
            self.assertEqual(server._nexus_effort(), "high")
            self.assertEqual(server._nexus_effort_state()["source"], "admin")
        finally:
            os.environ.pop("NEXUS_EFFORT", None)

    def test_env_default_used_when_no_override(self):
        os.environ["NEXUS_EFFORT"] = "medium"
        try:
            _reset_effort_override()
            self.assertEqual(server._nexus_effort(), "medium")
            self.assertEqual(server._nexus_effort_state()["source"], "env")
        finally:
            os.environ.pop("NEXUS_EFFORT", None)

    def test_invalid_env_falls_back_to_high(self):
        os.environ["NEXUS_EFFORT"] = "nonsense"
        try:
            _reset_effort_override()
            self.assertEqual(server._nexus_effort(), "high")
        finally:
            os.environ.pop("NEXUS_EFFORT", None)


class RequestPropagationTests(unittest.TestCase):
    """The fixed model and active effort must reach the Anthropic request."""

    def setUp(self):
        os.environ.pop("NEXUS_EFFORT", None)
        _reset_effort_override()
        self.captured = {}
        self._orig_create = server.client.messages.create

        def _fake_create(**kwargs):
            self.captured.clear()
            self.captured.update(kwargs)
            block = types.SimpleNamespace(text="A generated reflection.", type="text")
            return types.SimpleNamespace(content=[block])

        server.client.messages.create = _fake_create
        self.c = TestClient(server.app)

    def tearDown(self):
        server.client.messages.create = self._orig_create
        _reset_effort_override()

    def test_model_and_default_effort_propagate(self):
        r = self.c.post("/api/threshold/name-essay", json={"full_name": "Ada Lovelace"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.captured.get("model"), "claude-sonnet-5")
        self.assertEqual(self.captured.get("output_config"), {"effort": "high"})

    def test_admin_change_propagates_to_next_request(self):
        admin = _auth_client()
        self.assertEqual(
            admin.put("/api/admin/nexus-effort", json={"effort": "low"}).status_code, 200
        )
        r = self.c.post("/api/threshold/name-essay", json={"full_name": "Grace Hopper"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.captured.get("output_config"), {"effort": "low"})


class HealthSurfaceTests(unittest.TestCase):
    def test_health_config_exposes_nexus_baseline(self):
        _reset_effort_override()
        c = _auth_client()
        cfg = c.get("/api/admin/health").json()["config"]
        self.assertIn("nexus", cfg)
        self.assertEqual(cfg["nexus"]["model"], "claude-sonnet-5")
        self.assertIn(cfg["nexus"]["effort"], {"low", "medium", "high"})


if __name__ == "__main__":
    unittest.main()
