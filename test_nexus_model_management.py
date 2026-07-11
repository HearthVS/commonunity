"""Tests for the admin-controlled Nexus model-management mechanism.

Covers the future-proof model layer added on top of PR #168:
  - per-request resolver precedence (admin → NEXUS_MODEL env → safe fallback)
  - Models API discovery (pagination, graceful failure, brief caching)
  - bounded validation with error classification (no secret / body leakage)
  - validation gating of activation (no arbitrary untested activation)
  - atomic activation + rollback and durable persistence
  - authenticated-only surfaces
  - a structural invariant proving no fixed-model call-site bypass remains
  - live call-site propagation of the active model

No real API calls are made — the Anthropic client is monkeypatched.

Run with:  python -m unittest test_nexus_model_management -v
"""

import os
import re
import tempfile
import types
import unittest

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
_TMP_DB = os.path.join(tempfile.gettempdir(), "commonunity_model_mgmt_test.sqlite3")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = _TMP_DB

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]


def _auth_client() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


def _reset_model_settings():
    server._set_setting(server._NEXUS_MODEL_SETTING_KEY, "")
    server._set_setting(server._NEXUS_MODEL_PREV_SETTING_KEY, "")
    server._set_setting(server._NEXUS_MODEL_VALIDATION_KEY, "")
    server._model_discovery_cache["at"] = 0.0
    server._model_discovery_cache["data"] = None
    os.environ.pop("NEXUS_MODEL", None)


# ── Fakes ─────────────────────────────────────────────────────────────────────
class _FakePage:
    """Minimal stand-in for the SDK's paginated SyncPage[ModelInfo]."""

    def __init__(self, items, next_page=None):
        self.data = [types.SimpleNamespace(**it) for it in items]
        self._next = next_page

    def has_next_page(self):
        return self._next is not None

    def get_next_page(self):
        return self._next


class _ApiError(Exception):
    """Exception carrying a status_code, mimicking the SDK error surface. The
    class *name* is what a leaky implementation might surface; the message body
    (here) must never reach a response."""

    def __init__(self, name, status_code=None, body="RAW-SECRET-BODY-should-not-leak"):
        super().__init__(body)
        self.__class__.__name__ = name
        self.status_code = status_code


class _FakeStream:
    def __init__(self, kwargs):
        self.kwargs = kwargs
        self.text_stream = ["ok"]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class ResolverPrecedenceTests(unittest.TestCase):
    def setUp(self):
        _reset_model_settings()

    def tearDown(self):
        _reset_model_settings()

    def test_default_fallback_is_sonnet_5(self):
        self.assertEqual(server._NEXUS_MODEL, "claude-sonnet-5")
        self.assertEqual(server._nexus_model(), "claude-sonnet-5")
        self.assertEqual(server._nexus_model_source(), "default")

    def test_env_default_used_when_no_admin_selection(self):
        os.environ["NEXUS_MODEL"] = "claude-opus-9"
        try:
            self.assertEqual(server._nexus_model(), "claude-opus-9")
            self.assertEqual(server._nexus_model_source(), "env")
        finally:
            os.environ.pop("NEXUS_MODEL", None)

    def test_admin_selection_beats_env_and_default(self):
        os.environ["NEXUS_MODEL"] = "claude-opus-9"
        try:
            server._set_setting(server._NEXUS_MODEL_SETTING_KEY, "claude-haiku-7")
            self.assertEqual(server._nexus_model(), "claude-haiku-7")
            self.assertEqual(server._nexus_model_source(), "admin")
        finally:
            os.environ.pop("NEXUS_MODEL", None)


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        _reset_model_settings()
        self._orig = server.client.models.list

    def tearDown(self):
        server.client.models.list = self._orig
        _reset_model_settings()

    def test_pagination_walks_all_pages(self):
        page2 = _FakePage([{"id": "m3", "display_name": "M3", "created_at": "2026"}])
        page1 = _FakePage(
            [{"id": "m1", "display_name": "M1", "created_at": "2026"},
             {"id": "m2", "display_name": "M2", "created_at": "2026"}],
            next_page=page2,
        )
        server.client.models.list = lambda **kw: page1
        d = server._discover_models(force=True)
        self.assertTrue(d["available"])
        self.assertEqual([m["id"] for m in d["models"]], ["m1", "m2", "m3"])

    def test_credentials_unavailable(self):
        key = os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            d = server._discover_models(force=True)
            self.assertFalse(d["available"])
            self.assertEqual(d["error"], "credentials_unavailable")
        finally:
            if key is not None:
                os.environ["ANTHROPIC_API_KEY"] = key

    def test_api_error_is_graceful_and_coarse(self):
        def _boom(**kw):
            raise _ApiError("AuthenticationError", status_code=401)
        server.client.models.list = _boom
        d = server._discover_models(force=True)
        self.assertFalse(d["available"])
        self.assertEqual(d["error"], "auth_error")
        self.assertNotIn("RAW-SECRET-BODY", str(d))

    def test_brief_cache(self):
        calls = {"n": 0}

        def _list(**kw):
            calls["n"] += 1
            return _FakePage([{"id": "m1", "display_name": "M1", "created_at": "2026"}])
        server.client.models.list = _list
        server._discover_models(force=True)
        cached = server._discover_models(force=False)
        self.assertEqual(calls["n"], 1)
        self.assertTrue(cached["cached"])


class ValidationTests(unittest.TestCase):
    def setUp(self):
        _reset_model_settings()
        self._orig_create = server.client.messages.create
        self._orig_stream = server.client.messages.stream
        self.captured = {}

        def _ok_create(**kw):
            self.captured.clear()
            self.captured.update(kw)
            return types.SimpleNamespace(content=[types.SimpleNamespace(text="ok", type="text")])

        def _ok_stream(**kw):
            return _FakeStream(kw)

        server.client.messages.create = _ok_create
        server.client.messages.stream = _ok_stream

    def tearDown(self):
        server.client.messages.create = self._orig_create
        server.client.messages.stream = self._orig_stream
        _reset_model_settings()

    def test_success_uses_effort_shape_and_small_budget(self):
        r = server._validate_model("claude-sonnet-5")
        self.assertTrue(r["ok"])
        self.assertEqual(r["result"], "success")
        self.assertEqual(self.captured["output_config"], server._nexus_output_config())
        self.assertLessEqual(self.captured["max_tokens"], 32)
        self.assertTrue(r["streaming_ok"])

    def test_empty_candidate_rejected(self):
        r = server._validate_model("  ")
        self.assertFalse(r["ok"])
        self.assertEqual(r["result"], "invalid_candidate")

    def test_error_classification(self):
        cases = {
            ("NotFoundError", 404): "unavailable_model",
            ("BadRequestError", 400): "incompatible",
            ("BadRequestError", 422): "incompatible",
            ("AuthenticationError", 401): "auth_error",
            ("PermissionDeniedError", 403): "auth_error",
            ("RateLimitError", 429): "rate_limited",
            ("InternalServerError", 500): "transient",
            ("APIConnectionError", None): "transient",
        }
        for (name, status), expected in cases.items():
            def _boom(**kw):
                raise _ApiError(name, status_code=status)
            server.client.messages.create = _boom
            r = server._validate_model("candidate-x")
            self.assertEqual(r["result"], expected, f"{name}/{status}")
            self.assertFalse(r["ok"])
            # Only the class name is surfaced, never the raw body.
            self.assertNotIn("RAW-SECRET-BODY", str(r))

    def test_credentials_unavailable(self):
        key = os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            r = server._validate_model("claude-sonnet-5")
            self.assertEqual(r["result"], "credentials_unavailable")
        finally:
            if key is not None:
                os.environ["ANTHROPIC_API_KEY"] = key


class ActivationAndRollbackTests(unittest.TestCase):
    def setUp(self):
        _reset_model_settings()
        self._orig_create = server.client.messages.create
        self._orig_stream = server.client.messages.stream
        server.client.messages.create = lambda **kw: types.SimpleNamespace(
            content=[types.SimpleNamespace(text="ok", type="text")])
        server.client.messages.stream = lambda **kw: _FakeStream(kw)
        self.c = _auth_client()

    def tearDown(self):
        server.client.messages.create = self._orig_create
        server.client.messages.stream = self._orig_stream
        _reset_model_settings()

    def test_activation_requires_successful_validation(self):
        def _boom(**kw):
            raise _ApiError("NotFoundError", status_code=404)
        server.client.messages.create = _boom
        r = self.c.post("/api/admin/nexus-model/activate", json={"model": "bogus-model"})
        self.assertEqual(r.status_code, 422, r.text)
        # Active model unchanged (still the safe fallback).
        self.assertEqual(server._nexus_model(), "claude-sonnet-5")

    def test_activation_empty_candidate_rejected(self):
        r = self.c.post("/api/admin/nexus-model/activate", json={"model": ""})
        self.assertEqual(r.status_code, 422, r.text)

    def test_activation_persists_and_records_previous(self):
        r = self.c.post("/api/admin/nexus-model/activate", json={"model": "claude-opus-9"})
        self.assertEqual(r.status_code, 200, r.text)
        # Durable: a fresh read (new connection) survives a restart.
        self.assertEqual(server._get_setting(server._NEXUS_MODEL_SETTING_KEY), "claude-opus-9")
        self.assertEqual(server._nexus_model(), "claude-opus-9")
        # Previous known-good is the model that was active before (fallback).
        self.assertEqual(server._get_setting(server._NEXUS_MODEL_PREV_SETTING_KEY), "claude-sonnet-5")

    def test_rollback_swaps_atomically(self):
        self.c.post("/api/admin/nexus-model/activate", json={"model": "claude-opus-9"})
        r = self.c.post("/api/admin/nexus-model/rollback")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(server._nexus_model(), "claude-sonnet-5")
        # Previous now points back to the model we rolled away from (toggle).
        self.assertEqual(server._get_setting(server._NEXUS_MODEL_PREV_SETTING_KEY), "claude-opus-9")

    def test_rollback_without_previous_is_409(self):
        r = self.c.post("/api/admin/nexus-model/rollback")
        self.assertEqual(r.status_code, 409, r.text)

    def test_validate_endpoint_persists_last_validation(self):
        r = self.c.post("/api/admin/nexus-model/validate", json={"model": "claude-sonnet-5"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["validation"]["result"], "success")
        self.assertEqual(server._last_validation()["model"], "claude-sonnet-5")


class AuthAndLeakageTests(unittest.TestCase):
    def setUp(self):
        _reset_model_settings()

    def tearDown(self):
        _reset_model_settings()

    def test_all_model_endpoints_require_admin(self):
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/admin/nexus-model").status_code, 401)
        self.assertEqual(anon.get("/api/admin/nexus-model/available").status_code, 401)
        self.assertEqual(
            anon.post("/api/admin/nexus-model/validate", json={"model": "x"}).status_code, 401)
        self.assertEqual(
            anon.post("/api/admin/nexus-model/activate", json={"model": "x"}).status_code, 401)
        self.assertEqual(anon.post("/api/admin/nexus-model/rollback").status_code, 401)

    def test_no_secret_leakage_in_state(self):
        c = _auth_client()
        raw = c.get("/api/admin/nexus-model").text
        self.assertNotIn("sk-test-key-should-not-leak", raw)
        self.assertNotIn(ADMIN_CODE, raw)

    def test_anonymous_status_hides_model_internals(self):
        anon = TestClient(server.app)
        body = anon.get("/api/admin/status").text
        self.assertNotIn("nexus_model", body)
        self.assertNotIn("previous_known_good", body)


class CallSitePropagationTests(unittest.TestCase):
    """The active model must reach every Anthropic call site; no fixed-model
    bypass may remain in the source."""

    def setUp(self):
        _reset_model_settings()
        self.captured = {}
        self._orig_create = server.client.messages.create

        def _fake_create(**kwargs):
            self.captured.clear()
            self.captured.update(kwargs)
            return types.SimpleNamespace(content=[types.SimpleNamespace(text="ok", type="text")])

        server.client.messages.create = _fake_create
        self.c = TestClient(server.app)

    def tearDown(self):
        server.client.messages.create = self._orig_create
        _reset_model_settings()

    def test_structural_invariant_no_fixed_model_arg(self):
        src = server.__file__
        with open(src, encoding="utf-8") as fh:
            text = fh.read()
        # Every call site must resolve the model at request time. A literal
        # `model=_NEXUS_MODEL` (the fixed pin) must not survive anywhere.
        self.assertNotIn("model=_NEXUS_MODEL", text)
        self.assertGreaterEqual(text.count("model=_nexus_model()"), 11)

    def test_active_model_propagates_after_activation(self):
        server._set_setting(server._NEXUS_MODEL_SETTING_KEY, "claude-opus-9")
        r = self.c.post("/api/threshold/name-essay", json={"full_name": "Ada Lovelace"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.captured.get("model"), "claude-opus-9")


class HealthSurfaceTests(unittest.TestCase):
    def setUp(self):
        _reset_model_settings()

    def tearDown(self):
        _reset_model_settings()

    def test_health_config_exposes_model_management(self):
        c = _auth_client()
        cfg = c.get("/api/admin/health").json()["config"]["nexus"]
        self.assertIn("model_source", cfg)
        self.assertIn("model_fallback", cfg)
        self.assertIn("rollback_available", cfg)
        self.assertEqual(cfg["model"], "claude-sonnet-5")


if __name__ == "__main__":
    unittest.main()
