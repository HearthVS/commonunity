"""Tests for the pre-beta system-quality instrumentation.

Covers the enriched /api/admin/health endpoint, the source-controlled
post-beta task list, deployment version visibility, admin auth gating, and the
privacy invariant (no secrets / raw exception internals in responses).

Run with:  python -m unittest test_system_health -v
(uses stdlib unittest + FastAPI's TestClient — no new dependencies)
"""

import os
import tempfile
import unittest

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
# Point the admin DB at a throwaway file so the write probe is isolated.
_TMP_DB = os.path.join(tempfile.gettempdir(), "commonunity_admin_test.sqlite3")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = _TMP_DB

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]


def _auth_client() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


class HealthEndpointTests(unittest.TestCase):
    def setUp(self):
        self.c = _auth_client()

    def test_requires_admin(self):
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/admin/health").status_code, 401)
        self.assertEqual(anon.get("/api/admin/post-beta-tasks").status_code, 401)

    def test_health_shape(self):
        d = self.c.get("/api/admin/health").json()
        # Backward-compatible fields still present for the legacy UI.
        self.assertIn("all_ok", d)
        self.assertIn("checks", d)
        # New pre-beta visibility surface.
        for key in ("status", "generated_at", "total_duration_ms", "version", "config"):
            self.assertIn(key, d)
        self.assertIn(d["status"], {"healthy", "degraded", "unconfigured", "unknown"})

    def test_every_check_has_state_and_duration(self):
        checks = self.c.get("/api/admin/health").json()["checks"]
        for name, val in checks.items():
            self.assertIn("status", val, f"{name} missing status")
            self.assertIn(val["status"], {"healthy", "degraded", "unconfigured", "unknown"}, name)
            self.assertIn("duration_ms", val, f"{name} missing duration_ms")

    def test_database_read_write_probe(self):
        db = self.c.get("/api/admin/health").json()["checks"]["database"]
        # The throwaway DB is writable, so the probe should be healthy.
        self.assertEqual(db["status"], "healthy")
        self.assertTrue(db["ok"])
        self.assertIn("persistence", db)
        # Env var is set in this test, so it is flagged as persistent.
        self.assertTrue(db["persistence"]["persistent_hint"])

    def test_routes_check_marks_gated_and_optional(self):
        routes = self.c.get("/api/admin/health").json()["checks"]["routes"]["routes"]
        by_path = {r["path"]: r for r in routes}
        self.assertTrue(by_path["/compass"]["gated"])
        self.assertFalse(by_path["/"]["gated"])
        # threshold is optional: absent module must not read as degraded.
        self.assertTrue(by_path["/threshold"]["optional"])
        self.assertIn(by_path["/threshold"]["status"], {"healthy", "unconfigured"})

    def test_config_warnings_for_missing_optional(self):
        config = self.c.get("/api/admin/health").json()["config"]
        self.assertIn("status", config)
        self.assertIn("warnings", config)
        self.assertIsInstance(config["warnings"], list)

    def test_no_secret_leakage(self):
        raw = self.c.get("/api/admin/health").text
        # The API key value must never appear anywhere in the response.
        self.assertNotIn("sk-test-key-should-not-leak", raw)
        self.assertNotIn(ADMIN_CODE, raw)


class VersionVisibilityTests(unittest.TestCase):
    def test_version_in_status_when_authenticated(self):
        c = _auth_client()
        v = c.get("/api/admin/status").json()["version"]
        for key in ("version", "commit", "branch", "source"):
            self.assertIn(key, v)

    def test_status_does_not_leak_version_when_anonymous(self):
        # Regression: /api/admin/status is intentionally ungated (drives the
        # login UI), so it must NOT expose deployment fingerprinting metadata
        # to anonymous callers. The gated /api/admin/health carries it instead.
        os.environ["RAILWAY_GIT_COMMIT_SHA"] = "deadbeef1234567890"
        os.environ["RAILWAY_GIT_BRANCH"] = "main"
        os.environ["RAILWAY_ENVIRONMENT_NAME"] = "production"
        try:
            anon = TestClient(server.app)
            r = anon.get("/api/admin/status")
            self.assertEqual(r.status_code, 200)  # stays reachable for login UI
            body = r.json()
            self.assertNotIn("version", body)
            # No fingerprinting values anywhere in the raw payload.
            raw = r.text
            self.assertNotIn("deadbeef1234", raw)
            self.assertNotIn("production", raw)
        finally:
            del os.environ["RAILWAY_GIT_COMMIT_SHA"]
            del os.environ["RAILWAY_GIT_BRANCH"]
            del os.environ["RAILWAY_ENVIRONMENT_NAME"]

    def test_env_commit_is_surfaced(self):
        os.environ["RAILWAY_GIT_COMMIT_SHA"] = "abcdef1234567890"
        os.environ["RAILWAY_GIT_BRANCH"] = "main"
        try:
            v = server._app_version_info()
            self.assertEqual(v["commit"], "abcdef123456")  # truncated to 12
            self.assertEqual(v["branch"], "main")
            self.assertEqual(v["source"], "env")
        finally:
            del os.environ["RAILWAY_GIT_COMMIT_SHA"]
            del os.environ["RAILWAY_GIT_BRANCH"]


class PostBetaTaskTests(unittest.TestCase):
    def setUp(self):
        self.c = _auth_client()

    def test_tasks_load_and_have_required_fields(self):
        d = self.c.get("/api/admin/post-beta-tasks").json()
        self.assertGreater(len(d["tasks"]), 0)
        ids = set()
        for t in d["tasks"]:
            for field in ("id", "title", "rationale", "phase", "status", "completion_criteria"):
                self.assertIn(field, t, f"task missing {field}: {t.get('id')}")
                self.assertTrue(str(t[field]).strip(), f"empty {field} in {t.get('id')}")
            self.assertIn(t["phase"], {"beta", "post_beta", "scale"})
            ids.add(t["id"])
        # IDs must be stable and unique.
        self.assertEqual(len(ids), len(d["tasks"]))

    def test_expected_deferred_topics_present(self):
        ids = {t["id"] for t in self.c.get("/api/admin/post-beta-tasks").json()["tasks"]}
        for expected in (
            "perf-rum", "perf-budget-bundle", "deploy-regression",
            "latency-error-history", "ai-cost-latency",
            "db-backup-restore", "alert-ownership",
        ):
            self.assertIn(expected, ids)


if __name__ == "__main__":
    unittest.main()
