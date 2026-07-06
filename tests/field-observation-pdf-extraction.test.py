#!/usr/bin/env python3
"""Field Observation PDF text extraction — behaviour + member isolation tests.

Server-side text extraction from a member's own uploaded PDF media. Storage
mirrors the field_observation_media trust model: member-scoped by cipher_id
(with the signed invite-token cookie as fallback), no unfiltered read branch, and
every trigger/read only ever matches the caller's own rows. Nothing here is sent
to Nexus or the AI — extraction derives and stores text; the member brings it
forward deliberately, client-side.

These tests boot the real FastAPI app via TestClient and assert:
  * extraction happy path on a small generated text PDF (status done + text)
  * empty / non-PDF-bytes are handled gracefully with a stored status + message
  * a member cannot extract, list, or read another member's artifacts (no
    cross-member access even with the exact id)
  * non-PDF media is rejected (400)
  * no-auth callers are rejected (403)

Run: python3 tests/field-observation-pdf-extraction.test.py
"""
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="fo_pdf_")
os.environ.setdefault("COMMONUNITY_ADMIN_DB_PATH", os.path.join(_tmp_dir, "admin.sqlite3"))
os.environ.setdefault("COMMONUNITY_MAGIC_LINK_TOKENS", "tokA,tokB")
os.environ.setdefault("ADMIN_ACCESS_CODE", "rootadmin")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

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


def invite_cookie(token):
    return {server._INVITE_COOKIE: server._signed_cookie_value(token, "invite")}


def make_text_pdf(text):
    """Build a minimal, valid single-page PDF whose content stream draws `text`,
    with a correct xref table so pypdf can parse it deterministically."""
    objs = [
        b"<</Type/Catalog/Pages 2 0 R>>",
        b"<</Type/Pages/Kids[3 0 R]/Count 1>>",
        b"<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R"
        b"/Resources<</Font<</F1 5 0 R>>>>>>",
    ]
    stream = b"BT /F1 18 Tf 20 100 Td (" + text.encode("latin-1") + b") Tj ET"
    objs.append(b"<</Length " + str(len(stream)).encode() + b">>stream\n" + stream + b"\nendstream")
    objs.append(b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>")
    out = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, start=1):
        offsets.append(len(out))
        out += str(i).encode() + b" 0 obj" + o + b"endobj\n"
    xref_pos = len(out)
    out += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n"
    out += b"0000000000 65535 f \n"
    for off in offsets:
        out += ("%010d 00000 n \n" % off).encode()
    out += (b"trailer<</Size " + str(len(objs) + 1).encode() + b"/Root 1 0 R>>\n"
            b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF")
    return out


PDF_TEXT = "Hello Field Observation"
PDF = make_text_pdf(PDF_TEXT)
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d4944415478da6360000002000154a24f8f0000000049454e44ae426082"
)

assert server._signed_cookie_value("tokA", "invite"), "cookie signing not configured"

# Clean slate.
with server._admin_db() as conn:
    conn.execute("DELETE FROM field_observation_media")
    conn.execute("DELETE FROM field_observation_processed")

UPLOAD = "/api/studio/field-observations/attachments"


def upload(client, token, cipher_id, name, ctype, data):
    return client.post(
        UPLOAD,
        cookies=invite_cookie(token),
        files={"file": (name, data, ctype)},
        data={"cipher_id": cipher_id},
    )


def extract(client, token, cipher_id, media_id):
    q = {"cipher_id": cipher_id} if cipher_id else {}
    return client.post(f"{UPLOAD}/{media_id}/extract", params=q, cookies=invite_cookie(token))


print("1. no-auth is rejected")
mid_probe = "fmed_probe"
ok(fresh_client().post(f"{UPLOAD}/{mid_probe}/extract").status_code == 403,
   "extract without auth -> 403")
ok(fresh_client().get("/api/studio/field-observations/processed").status_code == 403,
   "list processed without auth -> 403")

print("\n2. happy path: A uploads a text PDF and extracts real text")
c = fresh_client()
rUp = upload(c, "tokA", "cipher_A", "notes.pdf", "application/pdf", PDF)
ok(rUp.status_code == 200 and rUp.json()["media_kind"] == "document", "A PDF upload ok, classified document")
a_pdf_id = rUp.json()["id"]
rEx = extract(fresh_client(), "tokA", "cipher_A", a_pdf_id)
ok(rEx.status_code == 200, "A extraction returns 200")
proc = rEx.json()["processed"]
ok(proc["status"] == "done", "extraction status is done")
ok(PDF_TEXT in proc["text"], "extracted text contains the PDF's words")
ok(proc["source_media_id"] == a_pdf_id, "artifact links back to the source media id")
ok("invite_token" not in proc, "artifact never leaks invite_token")
a_proc_id = proc["id"]

print("\n3. artifact is listable and retrievable by its owner")
rList = fresh_client().get("/api/studio/field-observations/processed",
                           params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA"))
ids = {p["id"] for p in rList.json()["processed"]}
ok(a_proc_id in ids, "A lists its own artifact")
rListSrc = fresh_client().get("/api/studio/field-observations/processed",
                              params={"cipher_id": "cipher_A", "source_media_id": a_pdf_id},
                              cookies=invite_cookie("tokA"))
ok(all(p["source_media_id"] == a_pdf_id for p in rListSrc.json()["processed"]),
   "source_media_id filter narrows to that source")
rGet = fresh_client().get(f"/api/studio/field-observations/processed/{a_proc_id}",
                          params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA"))
ok(rGet.status_code == 200 and rGet.json()["processed"]["id"] == a_proc_id, "A retrieves its own artifact by id")

print("\n4. retry replaces the prior artifact (no accumulation)")
rEx2 = extract(fresh_client(), "tokA", "cipher_A", a_pdf_id)
ok(rEx2.status_code == 200 and rEx2.json()["processed"]["id"] != a_proc_id, "re-extract mints a fresh artifact id")
rList2 = fresh_client().get("/api/studio/field-observations/processed",
                            params={"cipher_id": "cipher_A", "source_media_id": a_pdf_id},
                            cookies=invite_cookie("tokA"))
ok(len(rList2.json()["processed"]) == 1, "only one artifact per source survives a retry")
a_proc_id = rEx2.json()["processed"]["id"]
ok(fresh_client().get(f"/api/studio/field-observations/processed/{proc['id']}",
                      params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA")).status_code == 404,
   "the replaced artifact id is gone")

print("\n5. cross-member isolation")
rExB = extract(fresh_client(), "tokB", "cipher_B", a_pdf_id)
ok(rExB.status_code == 404, "B cannot extract A's PDF even with the exact media id -> 404")
rGetB = fresh_client().get(f"/api/studio/field-observations/processed/{a_proc_id}",
                           params={"cipher_id": "cipher_B"}, cookies=invite_cookie("tokB"))
ok(rGetB.status_code == 404, "B cannot retrieve A's artifact by id -> 404")
rListB = fresh_client().get("/api/studio/field-observations/processed",
                            params={"cipher_id": "cipher_B"}, cookies=invite_cookie("tokB"))
ok(a_proc_id not in {p["id"] for p in rListB.json()["processed"]}, "B's list never contains A's artifact")

print("\n6. image media now dispatches to image preparation (not a 400 reject)")
rImg = upload(fresh_client(), "tokA", "cipher_A", "look.png", "image/png", PNG)
img_id = rImg.json()["id"]
rExImg = extract(fresh_client(), "tokA", "cipher_A", img_id)
ok(rExImg.status_code == 200, "extract on an image -> 200 (image is a supported kind)")
img_proc = rExImg.json()["processed"]
ok(img_proc["process_type"] == "image_text", "image extraction stores an image_text artifact")
# In the test environment there is no ANTHROPIC_API_KEY, so the honest outcome
# is an actionable 'unavailable' artifact — never a false 'done'.
ok(img_proc["status"] in ("done", "unavailable", "error"),
   "image artifact carries a real status (done when a key is set, else unavailable/error)")
if img_proc["status"] != "done":
    ok(bool(img_proc["error"]), "a non-done image artifact carries a user-visible message")

print("\n7. graceful handling of an unreadable PDF")
rUpBad = upload(fresh_client(), "tokA", "cipher_A", "broken.pdf", "application/pdf", b"%PDF-1.4 not really a pdf")
bad_id = rUpBad.json()["id"]
rExBad = extract(fresh_client(), "tokA", "cipher_A", bad_id)
ok(rExBad.status_code == 200, "unreadable PDF still returns 200 (graceful)")
badproc = rExBad.json()["processed"]
ok(badproc["status"] in ("empty", "error"), "unreadable PDF stored with empty/error status")
ok(bool(badproc["error"]), "unreadable PDF carries a user-visible message")

print("\n8. missing media id -> 404")
ok(extract(fresh_client(), "tokA", "cipher_A", "fmed_does_not_exist").status_code == 404,
   "extract on a non-existent media id -> 404")

# ── Release from Prepared: member-scoped delete of a processed artifact ────────
# Removes ONLY the derived processed row — never the source media or the
# remembered observation. Member-scoped exactly like the read routes.
PROCESSED = "/api/studio/field-observations/processed"


def delete_processed(client, token, cipher_id, proc_id):
    q = {"cipher_id": cipher_id} if cipher_id else {}
    return client.delete(f"{PROCESSED}/{proc_id}", params=q, cookies=invite_cookie(token))


print("\n9. release from Prepared removes only the processed artifact")
# Fresh source + extraction so this section stands on its own.
rUp9 = upload(fresh_client(), "tokA", "cipher_A", "release.pdf", "application/pdf", PDF)
rel_media_id = rUp9.json()["id"]
rel_proc_id = extract(fresh_client(), "tokA", "cipher_A", rel_media_id).json()["processed"]["id"]

ok(fresh_client().post(f"{PROCESSED}/{rel_proc_id}").status_code in (403, 405),
   "release path is not a public POST (no unauth mutation)")
ok(fresh_client().delete(f"{PROCESSED}/{rel_proc_id}").status_code == 403,
   "release without auth -> 403")

# Cross-member: B cannot release A's artifact even with the exact id.
ok(delete_processed(fresh_client(), "tokB", "cipher_B", rel_proc_id).status_code == 404,
   "B cannot release A's artifact by id -> 404")
ok(fresh_client().get(f"{PROCESSED}/{rel_proc_id}",
                      params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA")).status_code == 200,
   "A's artifact still present after B's failed release attempt")

# Owner release succeeds and is idempotent-ish (second delete -> 404).
ok(delete_processed(fresh_client(), "tokA", "cipher_A", rel_proc_id).json().get("ok") is True,
   "A releases its own artifact -> ok")
ok(fresh_client().get(f"{PROCESSED}/{rel_proc_id}",
                      params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA")).status_code == 404,
   "the released artifact is gone")
ok(delete_processed(fresh_client(), "tokA", "cipher_A", rel_proc_id).status_code == 404,
   "releasing an already-gone artifact -> 404")

# The original media survives the release — this only touches processed rows.
rMedia = fresh_client().get(UPLOAD, params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA"))
ok(rel_media_id in {m["id"] for m in rMedia.json()["attachments"]},
   "the source PDF media is untouched by the release")
ok(fresh_client().get(f"{UPLOAD}/{rel_media_id}/file",
                      params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA")).status_code == 200,
   "the source PDF file still streams after the release")

# The remembered text observation is a separate table and is never touched.
with server._admin_db() as _conn:
    _obs_before = _conn.execute("SELECT COUNT(*) FROM field_observations").fetchone()[0]
delete_processed(fresh_client(), "tokA", "cipher_A",
                 extract(fresh_client(), "tokA", "cipher_A", rel_media_id).json()["processed"]["id"])
with server._admin_db() as _conn:
    _obs_after = _conn.execute("SELECT COUNT(*) FROM field_observations").fetchone()[0]
ok(_obs_before == _obs_after, "releasing a processed artifact never touches field_observations rows")

print("\n10. studio.html Release action targets the processed artifact id, no auto-Nexus/storage")
STUDIO_HTML = (__import__("pathlib").Path(ROOT) / "studio.html").read_text(encoding="utf-8")
import re as _re
_rel_fn = (_re.search(r"async function studioReleaseFromPrepared[\s\S]*?\n}", STUDIO_HTML) or [""])[0]
ok(bool(_rel_fn), "studioReleaseFromPrepared() is defined")
ok("Release from Prepared" in STUDIO_HTML, "UI exposes a 'Release from Prepared' action")
ok("fo-prepared-release-btn" in STUDIO_HTML, "release button is wired in the Prepared tray")
ok("/field-observations/processed/" in _rel_fn and "method: 'DELETE'" in _rel_fn,
   "release calls DELETE on the processed artifact route")
ok("encodeURIComponent(procId)" in _rel_fn, "release targets the processed artifact id")
ok("confirm(" in _rel_fn, "release confirms before the destructive delete")
ok(not _re.search(r"rose-mirror|\.submit\s*\(", _rel_fn),
   "release never calls /rose-mirror and never auto-submits")
ok(not _re.search(r"localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie", _rel_fn),
   "release adds no browser storage")

print(f"\n{passed} passed")
