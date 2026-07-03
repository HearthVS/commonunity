#!/usr/bin/env python3
"""Field Observation media (multimodal attachments) — member isolation tests.

The central Field Observations surface accepts images / audio / PDFs. Storage
mirrors the field_observations trust model: member-scoped by cipher_id (with the
signed invite-token cookie as fallback), no unfiltered read branch, and
download/delete only ever match the caller's own rows. Raw bytes are written
under a server-generated random stored_name, so there is no path-traversal
surface and no public/unauthenticated file access.

These tests boot the real FastAPI app via TestClient and assert:
  * upload validates content type and size
  * a member lists only their own media (cipher_id + invite-cookie isolation)
  * a member cannot download or delete another member's media (no cross-member
    access even with the exact id)
  * no-auth callers are rejected (403)
  * the file endpoint is never public

Run: python3 tests/field-observation-media-privacy.test.py
"""
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="fo_media_")
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


# 1x1 PNG and a tiny WAV — real, whitelisted media bytes.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d4944415478da6360000002000154a24f8f0000000049454e44ae426082"
)
WAV = b"RIFF" + (36).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little") + \
      (1).to_bytes(2, "little") + (1).to_bytes(2, "little") + (8000).to_bytes(4, "little") + \
      (8000).to_bytes(4, "little") + (1).to_bytes(2, "little") + (8).to_bytes(2, "little") + \
      b"data" + (0).to_bytes(4, "little")

assert server._signed_cookie_value("tokA", "invite"), "cookie signing not configured"

# Clean slate.
with server._admin_db() as conn:
    conn.execute("DELETE FROM field_observation_media")

UPLOAD = "/api/studio/field-observations/attachments"


def upload(client, token, cipher_id, name, ctype, data, title=""):
    return client.post(
        UPLOAD,
        cookies=invite_cookie(token),
        files={"file": (name, data, ctype)},
        data={"cipher_id": cipher_id, "title": title},
    )


print("1. no-auth is rejected")
rNoAuth = fresh_client().post(UPLOAD, files={"file": ("a.png", PNG, "image/png")})
ok(rNoAuth.status_code == 403, "upload without invite/admin/beta -> 403")
ok(fresh_client().get(UPLOAD).status_code == 403, "list without auth -> 403")

print("\n2. upload validates type and size")
c = fresh_client()
rBad = upload(c, "tokA", "cipher_A", "evil.exe", "application/x-msdownload", b"MZ...")
ok(rBad.status_code == 400, "unsupported content type -> 400")
rEmpty = upload(c, "tokA", "cipher_A", "empty.png", "image/png", b"")
ok(rEmpty.status_code == 400, "empty file -> 400")
_orig_max = server._FO_MEDIA_MAX_BYTES
server._FO_MEDIA_MAX_BYTES = 10
try:
    rBig = upload(c, "tokA", "cipher_A", "big.png", "image/png", PNG)
    ok(rBig.status_code == 413, "over-size file -> 413")
finally:
    server._FO_MEDIA_MAX_BYTES = _orig_max

print("\n3. member A uploads image + audio, lists only its own")
c = fresh_client()
rA1 = upload(c, "tokA", "cipher_A", "look.png", "image/png", PNG, title="a photo")
ok(rA1.status_code == 200 and rA1.json()["media_kind"] == "image", "A image upload ok, classified image")
a_img_id = rA1.json()["id"]
rA2 = upload(c, "tokA", "cipher_A", "hum.wav", "audio/wav", WAV)
ok(rA2.status_code == 200 and rA2.json()["media_kind"] == "audio", "A audio upload ok, classified audio")

rB1 = upload(fresh_client(), "tokB", "cipher_B", "theirs.png", "image/png", PNG)
ok(rB1.status_code == 200, "B image upload ok")
b_img_id = rB1.json()["id"]

listA = fresh_client().get(UPLOAD, params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA"))
idsA = {m["id"] for m in listA.json()["attachments"]}
ok(a_img_id in idsA and rA2.json()["id"] in idsA, "A sees both of its own media")
ok(b_img_id not in idsA, "A does NOT see B's media (cross-member isolation)")
ok(all("invite_token" not in m and "stored_name" not in m for m in listA.json()["attachments"]),
   "list never leaks invite_token or on-disk stored_name")

print("\n4. download is member-scoped, never public")
rFileA = fresh_client().get(
    f"{UPLOAD}/{a_img_id}/file", params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA")
)
ok(rFileA.status_code == 200 and rFileA.content == PNG, "A downloads its own image bytes")
rFilePublic = fresh_client().get(f"{UPLOAD}/{a_img_id}/file")
ok(rFilePublic.status_code == 403, "no-auth file request -> 403 (never public)")
rFileB = fresh_client().get(
    f"{UPLOAD}/{a_img_id}/file", params={"cipher_id": "cipher_B"}, cookies=invite_cookie("tokB")
)
ok(rFileB.status_code == 404, "B cannot download A's file even with exact id -> 404")

print("\n5. delete is member-scoped")
rDelB = fresh_client().delete(
    f"{UPLOAD}/{a_img_id}", params={"cipher_id": "cipher_B"}, cookies=invite_cookie("tokB")
)
ok(rDelB.status_code == 404, "B cannot delete A's media -> 404")
stillA = fresh_client().get(UPLOAD, params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA"))
ok(a_img_id in {m["id"] for m in stillA.json()["attachments"]}, "A's media survived B's delete attempt")

rDelA = fresh_client().delete(
    f"{UPLOAD}/{a_img_id}", params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA")
)
ok(rDelA.status_code == 200, "A deletes its own media")
afterA = fresh_client().get(UPLOAD, params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA"))
ok(a_img_id not in {m["id"] for m in afterA.json()["attachments"]}, "deleted media no longer listed")
gone = fresh_client().get(
    f"{UPLOAD}/{a_img_id}/file", params={"cipher_id": "cipher_A"}, cookies=invite_cookie("tokA")
)
ok(gone.status_code == 404, "deleted media file no longer downloadable")

print("\n6. invite-cookie fallback isolation (no cipher_id)")
c = fresh_client()
rCookie = upload(c, "tokA", "", "cookieonly.png", "image/png", PNG)
ok(rCookie.status_code == 200, "cookie-only (no cipher_id) upload ok")
cookie_id = rCookie.json()["id"]
listCookieA = fresh_client().get(UPLOAD, cookies=invite_cookie("tokA"))
ok(cookie_id in {m["id"] for m in listCookieA.json()["attachments"]},
   "tokA cookie caller sees its own cipher-less media")
listCookieB = fresh_client().get(UPLOAD, cookies=invite_cookie("tokB"))
ok(cookie_id not in {m["id"] for m in listCookieB.json()["attachments"]},
   "tokB cookie caller cannot see tokA's cipher-less media")

print(f"\n{passed} passed")
