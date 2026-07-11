"""Tests for the Arrival Portrait enhancement (full-bleed + Cipher Field overlay).

Covers the server route for the new pure module, the backward-compatible
defaults, the non-destructive persistence shape, the builder wiring, and the
privacy invariant (no birth data / Gene Key / gate vocabulary reaches the
public surface). The deterministic overlay generation + recipe round-trip are
covered separately by the DOM-free Node suite (test_cipher_field.js).

Run with:  python -m unittest test_arrival_portrait -v
(uses stdlib unittest + FastAPI's TestClient — no new dependencies)
"""

import os
import pathlib
import unittest

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ["COMMONUNITY_BETA_CODE"] = "unit-test-beta-code"

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ROOT = pathlib.Path(__file__).parent
JS = (ROOT / "fieldprint.js").read_text()
HTML = (ROOT / "fieldprint.html").read_text()
CSS = (ROOT / "fieldprint.css").read_text()
MODULE = (ROOT / "fieldprint-cipher-field.js").read_text()

# Sensitive-data *access patterns* that must never appear in the overlay module
# (prose in comments is fine; these are property reads that would pull mechanics
# into the render). Rendered-output privacy is asserted by the Node suite.
FORBIDDEN_ACCESS = [".gate", ".gates", ".genekey", ".genekeys", "genekeys",
                    ".hexagram", ".birth", "birthdate", ".line", "data-gate", "data-axis"]


def _beta_client() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/beta/unlock", data={"code": "unit-test-beta-code", "next": "/fieldprint"})
    assert r.status_code in (200, 303), r.text
    return c


class RouteTests(unittest.TestCase):
    def test_module_route_serves_javascript(self):
        c = _beta_client()
        r = c.get("/fieldprint-cipher-field.js")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("javascript", r.headers.get("content-type", ""))
        self.assertIn("CipherField", r.text)

    def test_module_route_is_beta_gated(self):
        anon = TestClient(server.app)
        r = anon.get("/fieldprint-cipher-field.js", follow_redirects=False)
        # Not the raw asset for an unauthenticated visitor.
        self.assertNotIn("buildOverlaySvg", r.text)


class BackwardCompatTests(unittest.TestCase):
    def test_default_hero_presentation_unchanged(self):
        # The framed portrait ("contained") remains the default presentation.
        self.assertIn("hero: 'contained'", JS)
        self.assertIn('data-hero="contained"', HTML)

    def test_overlay_defaults_off(self):
        self.assertIn("heroOverlay: 'off'", JS)
        self.assertIn('data-overlay="off"', HTML)

    def test_zoom_defaults_to_no_zoom(self):
        self.assertIn("heroZoom: 100", JS)

    def test_draft_schema_unchanged_so_old_drafts_load(self):
        # Bumping the schema would silently drop existing saved pages; the new
        # fields are additive and default safely instead.
        self.assertIn("DRAFT_SCHEMA = 1", JS)

    def test_absent_recipe_restores_to_off(self):
        # applySnapshot must tolerate a pre-overlay draft (no hero.overlay/zoom).
        self.assertIn("numOr(h.zoom, 100)", JS)
        self.assertIn("normalizeRecipe(h.overlay)", JS)


class PersistenceShapeTests(unittest.TestCase):
    def test_snapshot_persists_zoom_and_overlay_recipe(self):
        # The only persisted source of truth (snapshot) carries the new,
        # non-destructive settings: zoom + a versioned overlay recipe.
        self.assertIn("zoom: state.heroZoom", JS)
        self.assertIn("overlay: {", JS)
        self.assertIn("treatment: state.heroOverlay", JS)
        self.assertIn("intensity: state.heroOverlayIntensity", JS)
        self.assertIn("palette: state.palette", JS)

    def test_recipe_is_versioned_for_future_studio(self):
        self.assertIn("version:", JS)
        self.assertIn("VERSION", MODULE)


class BuilderWiringTests(unittest.TestCase):
    def test_controls_present(self):
        for el in ("heroZoom", "heroOverlaySeg", "heroOverlayIntensity", "heroOverlayReset"):
            self.assertIn(f'id="{el}"', HTML, el)
        self.assertIn('data-overlay="cipher-field"', HTML)

    def test_overlay_node_and_script_included(self):
        self.assertIn('id="heroCipherField"', HTML)
        self.assertIn("/fieldprint-cipher-field.js", HTML)

    def test_css_overlay_rules_present(self):
        self.assertIn(".viz-hero__cipher", CSS)
        self.assertIn('data-overlay="cipher-field"', CSS)
        self.assertIn("--hero-overlay-opacity", CSS)


class PrivacyTests(unittest.TestCase):
    def test_overlay_module_reads_no_sensitive_fields(self):
        # Strip comments so documentation prose (which explains what is *avoided*)
        # doesn't trip the scan; only real code is checked for data access.
        import re
        code = re.sub(r"/\*.*?\*/", "", MODULE, flags=re.S)
        code = re.sub(r"//.*", "", code).lower()
        for term in FORBIDDEN_ACCESS:
            self.assertNotIn(term, code, f"overlay code must not read {term!r}")

    def test_overlay_module_makes_no_network_calls(self):
        low = MODULE.lower()
        # (the SVG xmlns "http://www.w3.org/..." is a namespace URI, not a request)
        for term in ("fetch(", "xmlhttprequest", "websocket", ".send(", "import(", "require("):
            self.assertNotIn(term, low, f"overlay must be offline/deterministic (found {term!r})")


if __name__ == "__main__":
    unittest.main()
