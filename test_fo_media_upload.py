"""Tests for stUdio Field Observation media upload (images / audio / PDF).

Focuses on the failure modes that made drag-and-drop feel broken: files whose
browser-reported MIME type is empty or generic (application/octet-stream) — which
is common for audio (.m4a, .wav) and drag-and-dropped files — used to be rejected
even though the type is supported. PDFs have a reliable MIME, which is why they
worked while images/audio silently failed. These tests lock in the extension
fallback plus the existing validation, listing, serving, and delete lifecycle.

Run with:  python -m unittest test_fo_media_upload -v
(stdlib unittest + FastAPI's TestClient — no new dependencies)
"""

import os
import tempfile
import unittest

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
_TMP_DIR = tempfile.mkdtemp(prefix="commonunity_fo_media_test_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_TMP_DIR, "admin.sqlite3")

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]
_ENDPOINT = "/api/studio/field-observations/attachments"

# 1x1 PNG.
_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
_M4A = b"\x00\x00\x00\x18ftypM4A " + b"\x00" * 32  # minimal-ish m4a header bytes
_WAV = b"RIFF\x24\x00\x00\x00WAVEfmt " + b"\x00" * 16


def _member_client() -> TestClient:
    """Admin login also satisfies _has_member_access, the studio gate."""
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


def _upload(client, filename, content, mime):
    return client.post(_ENDPOINT, files={"file": (filename, content, mime)})


class ResolveTypeUnitTests(unittest.TestCase):
    """Directly exercise the pure resolver so intent is unambiguous."""

    def test_whitelisted_mime_wins(self):
        self.assertEqual(server._fo_resolve_media_type("image/png", "x.png"), ("image/png", "image"))

    def test_empty_mime_falls_back_to_extension(self):
        # The core drag-and-drop bug: browser sends "" for many audio files.
        self.assertEqual(server._fo_resolve_media_type("", "voice.m4a"), ("audio/mp4", "audio"))
        self.assertEqual(server._fo_resolve_media_type("", "take.wav"), ("audio/wav", "audio"))
        self.assertEqual(server._fo_resolve_media_type("", "note.pdf"), ("application/pdf", "document"))

    def test_generic_octet_stream_falls_back_to_extension(self):
        self.assertEqual(
            server._fo_resolve_media_type("application/octet-stream", "photo.JPG"),
            ("image/jpeg", "image"),
        )

    def test_mime_with_charset_suffix_is_normalised(self):
        self.assertEqual(
            server._fo_resolve_media_type("image/png; charset=binary", "x.bin"),
            ("image/png", "image"),
        )

    def test_video_mp4_extension_is_not_accepted_as_audio(self):
        # .mp4 is deliberately excluded (could be video); only .m4a maps to audio.
        self.assertEqual(server._fo_resolve_media_type("", "clip.mp4"), (None, None))

    def test_unsupported_type_and_extension_rejected(self):
        self.assertEqual(server._fo_resolve_media_type("application/zip", "a.zip"), (None, None))
        self.assertEqual(server._fo_resolve_media_type("", "noext"), (None, None))


class UploadEndpointTests(unittest.TestCase):
    def setUp(self):
        self.c = _member_client()

    def test_requires_member_access(self):
        anon = TestClient(server.app)
        r = anon.post(_ENDPOINT, files={"file": ("x.png", _PNG, "image/png")})
        self.assertEqual(r.status_code, 403)

    def test_png_upload(self):
        r = _upload(self.c, "pic.png", _PNG, "image/png")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["media_kind"], "image")

    def test_pdf_upload(self):
        r = _upload(self.c, "doc.pdf", _PDF, "application/pdf")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["media_kind"], "document")

    def test_audio_with_empty_mime_uploads_via_extension(self):
        # Regression: this used to 400 because content_type was "".
        r = _upload(self.c, "voice.m4a", _M4A, "")
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["media_kind"], "audio")
        self.assertEqual(body["content_type"], "audio/mp4")

    def test_wav_with_octet_stream_uploads_via_extension(self):
        r = _upload(self.c, "take.wav", _WAV, "application/octet-stream")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["media_kind"], "audio")

    def test_unsupported_type_rejected(self):
        r = _upload(self.c, "a.zip", b"PK\x03\x04zip", "application/zip")
        self.assertEqual(r.status_code, 400)

    def test_empty_file_rejected(self):
        r = _upload(self.c, "empty.png", b"", "image/png")
        self.assertEqual(r.status_code, 400)

    def test_oversized_file_rejected(self):
        big = b"\x00" * (server._FO_MEDIA_MAX_BYTES + 1)
        r = self.c.post(_ENDPOINT, files={"file": ("big.wav", big, "audio/wav")})
        self.assertEqual(r.status_code, 413)

    def test_upload_list_serve_delete_lifecycle(self):
        # Listing/serving are member-scoped with no unfiltered branch, so we bind
        # to a stable cipher_id for the round trip (mirrors the client, which
        # always sends foCipherId()).
        cid = "cipher_lifecycle_test"
        up = self.c.post(_ENDPOINT, files={"file": ("voice.m4a", _M4A, "")}, data={"cipher_id": cid})
        self.assertEqual(up.status_code, 200, up.text)
        media_id = up.json()["id"]

        listing = self.c.get(_ENDPOINT, params={"cipher_id": cid})
        self.assertEqual(listing.status_code, 200)
        ids = [m["id"] for m in listing.json()["attachments"]]
        self.assertIn(media_id, ids)
        # stored_name must never leak to the client.
        for m in listing.json()["attachments"]:
            self.assertNotIn("stored_name", m)

        served = self.c.get(f"{_ENDPOINT}/{media_id}/file", params={"cipher_id": cid})
        self.assertEqual(served.status_code, 200)
        self.assertEqual(served.content, _M4A)

        deleted = self.c.delete(f"{_ENDPOINT}/{media_id}", params={"cipher_id": cid})
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(
            self.c.get(f"{_ENDPOINT}/{media_id}/file", params={"cipher_id": cid}).status_code, 404
        )


if __name__ == "__main__":
    unittest.main()
