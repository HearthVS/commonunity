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


class RegressionTests(unittest.TestCase):
    def test_health_admin_and_status_unaffected(self):
        c = TestClient(server.app)
        self.assertEqual(c.get("/health").status_code, 200)
        # /admin serves the panel HTML.
        self.assertEqual(c.get("/admin").status_code, 200)
        # Admin status endpoint still ungated and returns shape.
        self.assertIn("unlocked", c.get("/api/admin/status").json())


if __name__ == "__main__":
    unittest.main()
