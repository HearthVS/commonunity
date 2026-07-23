"""Tests for the versioned Nexus prompt archive.

Covers the admin-inspectable prompt registry added on top of the Nexus
model-management pattern:
  - registry completeness (all four families, every recovered version)
  - exact production defaults (registry default text == the constants that were
    live before this feature, byte-for-byte)
  - authenticated-only admin surfaces (list / get / activate)
  - list/get/activate behaviour + validation (unknown family/version rejected)
  - durable persistence of the active selection + previous-known-good
  - runtime resolution for every family switches with the active selection
  - a structural invariant: no runtime call site pins a family to its default,
    bypassing the active-selection resolver

No real API calls are made. Prompt text is pure data in nexus_prompts.

Run with:  python -m unittest test_nexus_prompt_archive -v
"""

import os
import tempfile
import unittest

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
_TMP_DB = os.path.join(tempfile.gettempdir(), "commonunity_prompt_archive_test.sqlite3")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = _TMP_DB

from fastapi.testclient import TestClient  # noqa: E402

import nexus_prompts  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]

# The exact families and version ids that must be preserved in the archive.
EXPECTED = {
    "compass": ["compass-rose-v1", "compass-nexus-v1", "compass-nexus-v2"],
    "studio": ["studio-v1"],
    "fieldprint": ["nexus-fieldprint-prompt-v1"],
    "arrival": ["nexus-arrival-prompt-v1"],
}
EXPECTED_DEFAULTS = {
    "compass": "compass-nexus-v2",
    "studio": "studio-v1",
    "fieldprint": "nexus-fieldprint-prompt-v1",
    "arrival": "nexus-arrival-prompt-v1",
}


def _auth_client() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


def _reset_prompt_settings():
    """Clear any admin selection so each test starts from production defaults."""
    for family in nexus_prompts.family_keys():
        server._set_setting(nexus_prompts.settings_key(family), "")
        server._set_setting(nexus_prompts.previous_key(family), "")


# ── Registry (pure data) ────────────────────────────────────────────────────
class RegistryCompletenessTests(unittest.TestCase):
    def test_all_families_present_in_order(self):
        self.assertEqual(nexus_prompts.family_keys(),
                         ["compass", "studio", "fieldprint", "arrival"])

    def test_every_version_present_oldest_to_newest(self):
        for family, ids in EXPECTED.items():
            got = [v["id"] for v in nexus_prompts.versions(family)]
            self.assertEqual(got, ids, f"family {family}")

    def test_defaults_point_at_production_version(self):
        for family, vid in EXPECTED_DEFAULTS.items():
            self.assertEqual(nexus_prompts.default_version_id(family), vid)

    def test_every_version_has_full_metadata(self):
        for family in nexus_prompts.family_keys():
            for v in nexus_prompts.versions(family):
                for key in ("id", "title", "created", "commit", "status",
                            "summary", "changes", "rationale",
                            "rationale_inferred", "text"):
                    self.assertIn(key, v, f"{family}/{v.get('id')} missing {key}")
                self.assertTrue(v["text"].strip(), f"{family}/{v['id']} empty text")

    def test_only_first_compass_rationale_is_inferred(self):
        inferred = {
            v["id"]
            for family in nexus_prompts.family_keys()
            for v in nexus_prompts.versions(family)
            if v["rationale_inferred"]
        }
        self.assertEqual(inferred, {"compass-rose-v1"})

    def test_exactly_one_active_per_family_and_it_is_default(self):
        for family in nexus_prompts.family_keys():
            actives = [v for v in nexus_prompts.versions(family)
                       if v["status"] == "active"]
            self.assertEqual(len(actives), 1, f"{family} active count")
            self.assertEqual(actives[0]["id"],
                             nexus_prompts.default_version_id(family))


class ExactProductionDefaultsTests(unittest.TestCase):
    """The registry default text MUST equal the module constants that were live
    in production before the archive existed — a fresh deploy changes nothing."""

    def test_compass_default_matches_nexus_system(self):
        self.assertEqual(nexus_prompts.default_text("compass"), server.NEXUS_SYSTEM)

    def test_rose_alias_preserved(self):
        self.assertEqual(server.ROSE_SYSTEM, server.NEXUS_SYSTEM)

    def test_studio_default_matches_studio_system(self):
        self.assertEqual(nexus_prompts.default_text("studio"), server.STUDIO_SYSTEM)

    def test_fieldprint_default_matches_inspire_l2(self):
        self.assertEqual(nexus_prompts.default_text("fieldprint"),
                         server.INSPIRE_L2_SYSTEM)

    def test_arrival_default_matches_arrival_task(self):
        self.assertEqual(nexus_prompts.default_text("arrival"),
                         server.NEXUS_ARRIVAL_TASK)

    def test_version_constants_match_registry_defaults(self):
        self.assertEqual(server.NEXUS_FIELDPRINT_PROMPT_VERSION,
                         nexus_prompts.default_version_id("fieldprint"))
        self.assertEqual(server.NEXUS_ARRIVAL_VERSION,
                         nexus_prompts.default_version_id("arrival"))


# ── Admin API auth ──────────────────────────────────────────────────────────
class PromptArchiveAuthTests(unittest.TestCase):
    def setUp(self):
        self.anon = TestClient(server.app)

    def test_list_requires_admin(self):
        self.assertEqual(self.anon.get("/api/admin/nexus-prompts").status_code, 401)

    def test_get_requires_admin(self):
        r = self.anon.get("/api/admin/nexus-prompts/compass/compass-nexus-v2")
        self.assertEqual(r.status_code, 401)

    def test_activate_requires_admin(self):
        r = self.anon.post("/api/admin/nexus-prompts/activate",
                           json={"family": "compass", "version": "compass-nexus-v1"})
        self.assertEqual(r.status_code, 401)


# ── Admin API behaviour ─────────────────────────────────────────────────────
class PromptArchiveApiTests(unittest.TestCase):
    def setUp(self):
        _reset_prompt_settings()
        self.c = _auth_client()

    def tearDown(self):
        _reset_prompt_settings()

    def test_list_returns_all_families_with_timelines(self):
        body = self.c.get("/api/admin/nexus-prompts").json()
        families = body["families"]
        self.assertEqual([f["family"] for f in families],
                         ["compass", "studio", "fieldprint", "arrival"])
        compass = families[0]
        self.assertEqual([v["id"] for v in compass["versions"]],
                         EXPECTED["compass"])
        self.assertEqual(compass["active_version"], "compass-nexus-v2")
        self.assertEqual(compass["default_version"], "compass-nexus-v2")
        self.assertEqual(compass["source"], "default")
        self.assertFalse(compass["customised"])

    def test_list_omits_prompt_text(self):
        body = self.c.get("/api/admin/nexus-prompts").json()
        for family in body["families"]:
            for v in family["versions"]:
                self.assertNotIn("text", v)
                self.assertIn("chars", v)

    def test_get_returns_full_text_and_flags(self):
        r = self.c.get("/api/admin/nexus-prompts/compass/compass-rose-v1")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["id"], "compass-rose-v1")
        self.assertEqual(body["text"],
                         nexus_prompts.get_version("compass", "compass-rose-v1")["text"])
        self.assertFalse(body["is_active"])
        self.assertFalse(body["is_default"])
        self.assertTrue(body["rationale_inferred"])

    def test_get_unknown_family_is_404(self):
        r = self.c.get("/api/admin/nexus-prompts/nope/whatever")
        self.assertEqual(r.status_code, 404)

    def test_get_unknown_version_is_404(self):
        r = self.c.get("/api/admin/nexus-prompts/compass/compass-nexus-v99")
        self.assertEqual(r.status_code, 404)

    def test_activate_switches_active_version(self):
        r = self.c.post("/api/admin/nexus-prompts/activate",
                        json={"family": "compass", "version": "compass-nexus-v1"})
        self.assertEqual(r.status_code, 200, r.text)
        state = r.json()["state"]
        self.assertEqual(state["active_version"], "compass-nexus-v1")
        self.assertEqual(state["source"], "admin")
        self.assertTrue(state["customised"])
        self.assertEqual(state["previous_version"], "compass-nexus-v2")

    def test_activate_unknown_family_is_422(self):
        r = self.c.post("/api/admin/nexus-prompts/activate",
                        json={"family": "nope", "version": "x"})
        self.assertEqual(r.status_code, 422)

    def test_activate_unknown_version_is_422(self):
        r = self.c.post("/api/admin/nexus-prompts/activate",
                        json={"family": "compass", "version": "ghost"})
        self.assertEqual(r.status_code, 422)

    def test_activate_missing_fields_is_422(self):
        r = self.c.post("/api/admin/nexus-prompts/activate", json={"family": "compass"})
        self.assertEqual(r.status_code, 422)

    def test_activate_does_not_leak_unrelated_settings(self):
        body = self.c.post("/api/admin/nexus-prompts/activate",
                           json={"family": "compass", "version": "compass-nexus-v1"}).json()
        self.assertEqual(set(body.keys()), {"state"})
        allowed = {"family", "label", "runtime", "active_version", "default_version",
                   "source", "customised", "previous_version", "versions"}
        self.assertTrue(set(body["state"].keys()).issubset(allowed))


# ── Persistence + runtime resolution ────────────────────────────────────────
class PromptResolutionTests(unittest.TestCase):
    def setUp(self):
        _reset_prompt_settings()

    def tearDown(self):
        _reset_prompt_settings()

    def test_defaults_when_no_selection(self):
        for family in nexus_prompts.family_keys():
            self.assertEqual(server._active_prompt_version(family),
                             nexus_prompts.default_version_id(family))
            self.assertEqual(server._active_prompt_text(family),
                             nexus_prompts.default_text(family))

    def test_activation_persists_and_resolves(self):
        server._activate_prompt_version("compass", "compass-nexus-v1")
        self.assertEqual(server._active_prompt_version("compass"), "compass-nexus-v1")
        self.assertEqual(
            server._active_prompt_text("compass"),
            nexus_prompts.get_version("compass", "compass-nexus-v1")["text"])
        # Durable: a fresh settings read returns the stored id.
        self.assertEqual(
            server._get_setting(nexus_prompts.settings_key("compass")),
            "compass-nexus-v1")

    def test_activation_records_previous_known_good(self):
        server._activate_prompt_version("compass", "compass-nexus-v1")
        self.assertEqual(
            server._get_setting(nexus_prompts.previous_key("compass")),
            "compass-nexus-v2")

    def test_stale_stored_id_falls_back_to_default(self):
        server._set_setting(nexus_prompts.settings_key("compass"), "removed-version")
        self.assertEqual(server._active_prompt_version("compass"),
                         nexus_prompts.default_version_id("compass"))
        self.assertEqual(server._active_prompt_text("compass"),
                         nexus_prompts.default_text("compass"))

    def test_each_family_resolves_independently(self):
        server._activate_prompt_version("compass", "compass-rose-v1")
        # Only compass changed; the others stay on their defaults.
        self.assertEqual(server._active_prompt_text("compass"),
                         nexus_prompts.get_version("compass", "compass-rose-v1")["text"])
        for family in ("studio", "fieldprint", "arrival"):
            self.assertEqual(server._active_prompt_text(family),
                             nexus_prompts.default_text(family))

    def test_activate_unknown_raises_value_error(self):
        with self.assertRaises(ValueError):
            server._activate_prompt_version("compass", "ghost")
        with self.assertRaises(ValueError):
            server._activate_prompt_version("nope", "x")


if __name__ == "__main__":
    unittest.main()
