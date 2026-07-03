"""Member-scoping tests for Field Observation standard extraction.

Run: python -m pytest test_fo_extraction.py  (or python test_fo_extraction.py)

Covers: PDF text extraction produces reviewable stored output, output is listed
for the owner, and a different member can neither extract, read, nor list
another member's media/output (cross-member isolation).
"""
import os
import io
import tempfile

# Configure an isolated DB + a known invite token BEFORE importing the server.
_TMPDIR = tempfile.mkdtemp(prefix="fo_test_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_TMPDIR, "admin.sqlite3")
os.environ["COMMONUNITY_MAGIC_LINK_TOKENS"] = "test-invite-token"

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

client = TestClient(server.app)
INVITE = "test-invite-token"


def _make_pdf(text: str) -> bytes:
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(72, 720, text)
    c.showPage()
    c.save()
    return buf.getvalue()


def _upload(cipher_id: str, data: bytes, content_type: str, name: str) -> str:
    r = client.post(
        f"/api/studio/field-observations/attachments?invite={INVITE}",
        files={"file": (name, data, content_type)},
        data={"cipher_id": cipher_id},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_extract_and_member_scoping():
    marker = "HELLO_NEXUS_EXTRACT_MARKER"
    pdf = _make_pdf(marker)

    # Member A uploads a PDF and extracts its text.
    media_id = _upload("member-A", pdf, "application/pdf", "notes.pdf")
    r = client.post(
        f"/api/studio/field-observations/attachments/{media_id}/extract?invite={INVITE}&cipher_id=member-A"
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "done", body
    assert marker in body["text"]
    assert body["char_count"] > 0

    # A can review it via the list endpoint (survives "refresh").
    r = client.get(f"/api/studio/field-observations/extractions?invite={INVITE}&cipher_id=member-A")
    assert r.status_code == 200
    exts = r.json()["extractions"]
    assert len(exts) == 1 and exts[0]["source_id"] == media_id
    assert marker in exts[0]["text"]
    # invite_token must never be serialised back to the client.
    assert "invite_token" not in exts[0]

    # Member B (different cipher_id) must NOT be able to extract A's media.
    r = client.post(
        f"/api/studio/field-observations/attachments/{media_id}/extract?invite={INVITE}&cipher_id=member-B"
    )
    assert r.status_code == 404, r.text

    # Member B must NOT be able to download A's file.
    r = client.get(
        f"/api/studio/field-observations/attachments/{media_id}/file?invite={INVITE}&cipher_id=member-B"
    )
    assert r.status_code == 404, r.text

    # Member B must NOT see A's extraction in their own list.
    r = client.get(f"/api/studio/field-observations/extractions?invite={INVITE}&cipher_id=member-B")
    assert r.status_code == 200
    assert r.json()["extractions"] == []

    # Re-extracting as A replaces the row (unique per source+process_type).
    r = client.post(
        f"/api/studio/field-observations/attachments/{media_id}/extract?invite={INVITE}&cipher_id=member-A"
    )
    assert r.status_code == 200
    r = client.get(f"/api/studio/field-observations/extractions?invite={INVITE}&cipher_id=member-A")
    assert len(r.json()["extractions"]) == 1


def test_unsupported_kind_is_clear():
    # A tiny PNG; extraction is not supported for images → clear 400.
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    media_id = _upload("member-A", png, "image/png", "pic.png")
    r = client.post(
        f"/api/studio/field-observations/attachments/{media_id}/extract?invite={INVITE}&cipher_id=member-A"
    )
    assert r.status_code == 400
    assert "coming soon" in r.json()["detail"].lower()


def test_extraction_requires_access():
    # No invite → the endpoint is not world-readable.
    r = client.get("/api/studio/field-observations/extractions?cipher_id=member-A")
    assert r.status_code == 403


if __name__ == "__main__":
    test_extract_and_member_scoping()
    test_unsupported_kind_is_clear()
    test_extraction_requires_access()
    print("ALL TESTS PASSED")
