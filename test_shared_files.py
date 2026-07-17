"""Tests for the admin Shared Files ("Library") feature.

Covers auth gating, HTML + PDF upload with generated share links, public byte
serving, HTML/SVG security isolation headers, disallowed types, oversized and
empty files, slug generation/collision, directory-traversal resistance,
listing, deactivate/delete lifecycle, and regressions for the health, admin,
and deck routes.

Run with:  python -m unittest test_shared_files -v
(stdlib unittest + FastAPI's TestClient — no new dependencies)
"""

import os
import tempfile
import unittest

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
_TMP_DIR = tempfile.mkdtemp(prefix="commonunity_shared_test_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_TMP_DIR, "admin.sqlite3")
os.environ["COMMONUNITY_SHARED_FILES_PATH"] = os.path.join(_TMP_DIR, "store")
# Small limit so the oversized-file test does not need a huge payload.
os.environ["COMMONUNITY_SHARED_FILES_MAX_BYTES"] = str(64 * 1024)

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]


def _auth_client() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


def _upload(client, filename, content, mime="application/octet-stream", title="", slug=""):
    data = {}
    if title:
        data["title"] = title
    if slug:
        data["slug"] = slug
    return client.post(
        "/api/admin/shared-files",
        files={"file": (filename, content, mime)},
        data=data,
    )


class AuthTests(unittest.TestCase):
    def test_all_admin_endpoints_require_auth(self):
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/admin/shared-files").status_code, 401)
        self.assertEqual(
            _upload(anon, "x.html", b"<h1>hi</h1>", "text/html").status_code, 401
        )
        self.assertEqual(
            anon.post("/api/admin/shared-files/none/state", json={"active": False}).status_code,
            401,
        )
        self.assertEqual(anon.delete("/api/admin/shared-files/none").status_code, 401)
        self.assertEqual(
            anon.post("/api/admin/shared-files/none/beta-visibility", json={"show": True}).status_code,
            401,
        )


class UploadAndServeTests(unittest.TestCase):
    def setUp(self):
        self.c = _auth_client()

    def test_html_upload_generates_link_and_serves(self):
        r = _upload(self.c, "deck.html", b"<html><body><h1>Pitch</h1></body></html>",
                    "text/html", title="Pitch Deck", slug="pitch-deck")
        self.assertEqual(r.status_code, 200, r.text)
        f = r.json()["file"]
        self.assertEqual(f["slug"], "pitch-deck")
        self.assertTrue(f["public_url"].endswith("/share/pitch-deck"))
        self.assertNotIn("stored_filename", f)  # internal name must not leak

        pub = self.c.get("/share/pitch-deck")
        self.assertEqual(pub.status_code, 200)
        self.assertIn(b"Pitch", pub.content)
        self.assertTrue(pub.headers["content-type"].startswith("text/html"))

    def test_pdf_upload_and_inline_serve(self):
        pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
        r = _upload(self.c, "report.pdf", pdf, "application/pdf", title="Report")
        self.assertEqual(r.status_code, 200, r.text)
        f = r.json()["file"]
        pub = self.c.get("/share/" + f["slug"])
        self.assertEqual(pub.status_code, 200)
        self.assertEqual(pub.headers["content-type"], "application/pdf")
        self.assertEqual(pub.headers["content-disposition"], "inline")
        self.assertEqual(pub.content, pdf)

    def test_html_security_isolation_headers(self):
        r = _upload(self.c, "iso.html", b"<h1>x</h1>", "text/html", slug="iso")
        self.assertEqual(r.status_code, 200)
        pub = self.c.get("/share/iso")
        csp = pub.headers.get("content-security-policy", "")
        self.assertIn("sandbox", csp)
        self.assertNotIn("allow-same-origin", csp)  # unique opaque origin
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertEqual(pub.headers.get("x-content-type-options"), "nosniff")
        self.assertEqual(pub.headers.get("referrer-policy"), "no-referrer")
        self.assertEqual(pub.headers.get("x-frame-options"), "DENY")

    def test_svg_gets_sandbox(self):
        r = _upload(self.c, "pic.svg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
                    "image/svg+xml", slug="pic")
        self.assertEqual(r.status_code, 200)
        pub = self.c.get("/share/pic")
        self.assertIn("sandbox", pub.headers.get("content-security-policy", ""))

    def test_office_doc_downloads_as_attachment(self):
        r = _upload(self.c, "sheet.xlsx", b"PK\x03\x04fake-xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    slug="sheet")
        self.assertEqual(r.status_code, 200)
        pub = self.c.get("/share/sheet")
        self.assertEqual(pub.status_code, 200)
        self.assertIn("attachment", pub.headers.get("content-disposition", ""))

    def test_disallowed_type_rejected(self):
        r = _upload(self.c, "evil.exe", b"MZ...", "application/octet-stream")
        self.assertEqual(r.status_code, 415)
        r2 = _upload(self.c, "script.js", b"alert(1)", "text/javascript")
        self.assertEqual(r2.status_code, 415)

    def test_empty_file_rejected(self):
        r = _upload(self.c, "empty.txt", b"", "text/plain")
        self.assertEqual(r.status_code, 400)

    def test_oversized_file_rejected(self):
        big = b"x" * (64 * 1024 + 1)
        r = _upload(self.c, "big.txt", big, "text/plain")
        self.assertEqual(r.status_code, 413)

    def test_slug_collision_gets_suffix(self):
        a = _upload(self.c, "a.txt", b"one", "text/plain", slug="dup")
        b = _upload(self.c, "b.txt", b"two", "text/plain", slug="dup")
        self.assertEqual(a.json()["file"]["slug"], "dup")
        self.assertEqual(b.json()["file"]["slug"], "dup-2")

    def test_traversal_in_filename_is_neutralized(self):
        # A traversal-laden name with an allowed extension must not escape the
        # store, and must still be served only via its slug.
        r = _upload(self.c, "../../etc/passwd.txt", b"safe", "text/plain", slug="trav")
        self.assertEqual(r.status_code, 200, r.text)
        # Stored name is randomized; original is sanitized to a basename.
        self.assertNotIn("/", r.json()["file"]["original_filename"])
        self.assertEqual(self.c.get("/share/trav").content, b"safe")

    def test_traversal_slug_is_404(self):
        # Slug path segments cannot be used to walk the filesystem.
        self.assertEqual(self.c.get("/share/..%2f..%2fserver.py").status_code, 404)

    def test_list_reflects_uploads(self):
        _upload(self.c, "listed.txt", b"hello", "text/plain", slug="listed-item")
        data = self.c.get("/api/admin/shared-files").json()
        slugs = [f["slug"] for f in data["files"]]
        self.assertIn("listed-item", slugs)
        self.assertIn("max_bytes", data)
        self.assertIn("html", data["allowed_extensions"])

    def test_deactivate_then_delete_lifecycle(self):
        up = _upload(self.c, "life.html", b"<h1>live</h1>", "text/html", slug="life")
        fid = up.json()["file"]["id"]
        self.assertEqual(self.c.get("/share/life").status_code, 200)

        # Deactivate → public URL 404s, bytes remain.
        d = self.c.post(f"/api/admin/shared-files/{fid}/state", json={"active": False})
        self.assertEqual(d.status_code, 200)
        self.assertFalse(d.json()["file"]["is_active"])
        self.assertEqual(self.c.get("/share/life").status_code, 404)

        # Reactivate → served again.
        self.c.post(f"/api/admin/shared-files/{fid}/state", json={"active": True})
        self.assertEqual(self.c.get("/share/life").status_code, 200)

        # Delete → 404 forever and bytes removed from disk.
        stored = None
        with server._admin_db() as conn:
            row = conn.execute("SELECT stored_filename FROM shared_files WHERE id=?", (fid,)).fetchone()
            stored = row["stored_filename"]
        dele = self.c.delete(f"/api/admin/shared-files/{fid}")
        self.assertEqual(dele.status_code, 200)
        self.assertEqual(self.c.get("/share/life").status_code, 404)
        self.assertFalse(os.path.exists(os.path.join(server._shared_files_dir(), stored)))

    def test_view_count_increments(self):
        _upload(self.c, "counted.txt", b"v", "text/plain", slug="counted")
        self.c.get("/share/counted")
        self.c.get("/share/counted")
        data = self.c.get("/api/admin/shared-files").json()
        item = next(f for f in data["files"] if f["slug"] == "counted")
        self.assertGreaterEqual(item["view_count"], 2)

    def test_unknown_slug_404(self):
        self.assertEqual(self.c.get("/share/does-not-exist").status_code, 404)


class BetaVisibilityTests(unittest.TestCase):
    """The 'Show in beta library' operator control (show_in_beta_library).

    It is a separate, additive flag from is_active: it only governs whether an
    item surfaces in the private beta hub's Library section. It must default to
    hidden and must not affect ordinary /share access."""

    def setUp(self):
        self.c = _auth_client()

    def test_new_items_default_hidden_from_beta(self):
        up = _upload(self.c, "b.html", b"<h1>x</h1>", "text/html", slug="beta-default")
        self.assertEqual(up.status_code, 200)
        self.assertFalse(up.json()["file"]["show_in_beta_library"])
        # A saved link entry defaults hidden too.
        link = self.c.post("/api/admin/shared-links",
                           json={"title": "L", "target_url": "https://commonunity.io/x/"})
        self.assertFalse(link.json()["file"]["show_in_beta_library"])

    def test_toggle_updates_flag_without_touching_public_access(self):
        up = _upload(self.c, "shareable.html", b"<h1>hi</h1>", "text/html", slug="shareable")
        fid = up.json()["file"]["id"]
        # Public /share alias works regardless of beta visibility.
        self.assertEqual(self.c.get("/share/shareable").status_code, 200)

        shown = self.c.post(f"/api/admin/shared-files/{fid}/beta-visibility", json={"show": True})
        self.assertEqual(shown.status_code, 200)
        self.assertTrue(shown.json()["file"]["show_in_beta_library"])
        # is_active untouched, public URL still serves the same bytes.
        self.assertTrue(shown.json()["file"]["is_active"])
        self.assertEqual(self.c.get("/share/shareable").status_code, 200)

        hidden = self.c.post(f"/api/admin/shared-files/{fid}/beta-visibility", json={"show": False})
        self.assertFalse(hidden.json()["file"]["show_in_beta_library"])
        self.assertEqual(self.c.get("/share/shareable").status_code, 200)

    def test_beta_visibility_unknown_id_404(self):
        r = self.c.post("/api/admin/shared-files/does-not-exist/beta-visibility", json={"show": True})
        self.assertEqual(r.status_code, 404)

    def test_listing_exposes_beta_flag(self):
        up = _upload(self.c, "listed.txt", b"v", "text/plain", slug="listed")
        fid = up.json()["file"]["id"]
        self.c.post(f"/api/admin/shared-files/{fid}/beta-visibility", json={"show": True})
        data = self.c.get("/api/admin/shared-files").json()
        item = next(f for f in data["files"] if f["id"] == fid)
        self.assertTrue(item["show_in_beta_library"])


class LinkEntryTests(unittest.TestCase):
    """The 'Add existing link' follow-up: alias entries that redirect."""

    def setUp(self):
        self.c = _auth_client()

    def _create_link(self, url, title="", slug=""):
        return self.c.post(
            "/api/admin/shared-links",
            json={"target_url": url, "title": title, "slug": slug},
        )

    def test_requires_auth(self):
        anon = TestClient(server.app)
        r = anon.post("/api/admin/shared-links", json={"target_url": "https://commonunity.io/x"})
        self.assertEqual(r.status_code, 401)

    def test_create_link_and_alias_redirects(self):
        target = "https://commonunity.io/decks/minimum-viable-digital-self/"
        r = self._create_link(target, title="Minimum Viable Digital Self", slug="mvds")
        self.assertEqual(r.status_code, 200, r.text)
        f = r.json()["file"]
        self.assertEqual(f["kind"], "link")
        self.assertEqual(f["slug"], "mvds")
        self.assertEqual(f["target_url"], target)
        self.assertEqual(f["target_host"], "commonunity.io")
        self.assertTrue(f["public_url"].endswith("/share/mvds"))

        red = self.c.get("/share/mvds", follow_redirects=False)
        self.assertIn(red.status_code, (302, 307))
        self.assertEqual(red.headers["location"], target)
        self.assertEqual(red.headers.get("referrer-policy"), "no-referrer")

    def test_generated_slug_from_title(self):
        r = self._create_link("https://commonunity.io/page", title="Investor Brief")
        self.assertEqual(r.json()["file"]["slug"], "investor-brief")

    def test_generated_slug_from_host_when_no_title_or_slug(self):
        r = self._create_link("https://example.org/some/path")
        # Slug derives from the host when nothing else is supplied.
        self.assertTrue(r.json()["file"]["slug"].startswith("example-org"))

    def test_slug_collision_with_file(self):
        _upload(self.c, "collide.pdf", b"%PDF-1.4 x", "application/pdf", slug="shared")
        r = self._create_link("https://commonunity.io/a", slug="shared")
        # A link must not steal a slug already held by a file entry.
        self.assertEqual(r.json()["file"]["slug"], "shared-2")

    def test_external_https_allowed(self):
        r = self._create_link("https://example.com/deck", slug="ext")
        self.assertEqual(r.status_code, 200)
        red = self.c.get("/share/ext", follow_redirects=False)
        self.assertEqual(red.headers["location"], "https://example.com/deck")

    def test_reject_javascript_scheme(self):
        r = self._create_link("javascript:alert(1)")
        self.assertEqual(r.status_code, 400)

    def test_reject_data_scheme(self):
        self.assertEqual(self._create_link("data:text/html,<h1>x</h1>").status_code, 400)

    def test_reject_file_scheme(self):
        self.assertEqual(self._create_link("file:///etc/passwd").status_code, 400)

    def test_reject_embedded_credentials(self):
        self.assertEqual(self._create_link("https://user:pass@evil.example/").status_code, 400)

    def test_reject_empty_and_malformed(self):
        self.assertEqual(self._create_link("").status_code, 400)
        self.assertEqual(self._create_link("not a url").status_code, 400)
        self.assertEqual(self._create_link("https://").status_code, 400)

    def test_reject_control_chars(self):
        # CRLF injection attempt into the eventual Location header (sent in the
        # JSON body, so it reaches the validator verbatim).
        r = self._create_link("https://commonunity.io/a\r\nSet-Cookie: x")
        self.assertEqual(r.status_code, 400)

    def test_reject_overlong_url(self):
        self.assertEqual(self._create_link("https://commonunity.io/" + "a" * 3000).status_code, 400)

    def test_link_lifecycle_deactivate_reactivate_delete(self):
        r = self._create_link("https://commonunity.io/deck", slug="life-link")
        fid = r.json()["file"]["id"]
        self.assertIn(self.c.get("/share/life-link", follow_redirects=False).status_code, (302, 307))

        d = self.c.post(f"/api/admin/shared-files/{fid}/state", json={"active": False})
        self.assertEqual(d.status_code, 200)
        self.assertFalse(d.json()["file"]["is_active"])
        self.assertEqual(self.c.get("/share/life-link", follow_redirects=False).status_code, 404)

        self.c.post(f"/api/admin/shared-files/{fid}/state", json={"active": True})
        self.assertIn(self.c.get("/share/life-link", follow_redirects=False).status_code, (302, 307))

        self.assertEqual(self.c.delete(f"/api/admin/shared-files/{fid}").status_code, 200)
        self.assertEqual(self.c.get("/share/life-link", follow_redirects=False).status_code, 404)

    def test_link_appears_in_list_with_kind(self):
        self._create_link("https://commonunity.io/listed", slug="listed-link")
        files = self.c.get("/api/admin/shared-files").json()["files"]
        item = next(f for f in files if f["slug"] == "listed-link")
        self.assertEqual(item["kind"], "link")
        self.assertNotIn("stored_filename", item)


class RegressionTests(unittest.TestCase):
    def setUp(self):
        self.c = _auth_client()

    def test_health_admin_and_status_unaffected(self):
        c = TestClient(server.app)
        self.assertEqual(c.get("/health").status_code, 200)
        # /admin serves the panel HTML.
        self.assertEqual(c.get("/admin").status_code, 200)
        # Admin status endpoint still ungated and returns shape.
        self.assertIn("unlocked", c.get("/api/admin/status").json())

    def test_file_upload_still_works_and_keeps_security_headers(self):
        # The link follow-up must not regress the file path or its isolation.
        r = _upload(self.c, "still.html", b"<h1>ok</h1>", "text/html", slug="still-file")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["file"]["kind"], "file")
        pub = self.c.get("/share/still-file")
        self.assertEqual(pub.status_code, 200)
        self.assertIn("sandbox", pub.headers.get("content-security-policy", ""))
        self.assertEqual(pub.headers.get("x-content-type-options"), "nosniff")


if __name__ == "__main__":
    unittest.main()
