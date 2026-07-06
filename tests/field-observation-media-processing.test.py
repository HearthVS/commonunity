#!/usr/bin/env python3
"""Field Observation media preparation — image OCR/description + audio
transcription behaviour, provider-honest unavailability, and member isolation.

The central Field Observations surface prepares reviewable text from uploaded
media so it can be reviewed and deliberately offered to Nexus. The single
/attachments/{id}/extract route dispatches by media kind:
  document (PDF) -> pdf_text        (pypdf, ships today)
  image          -> image_text      (Anthropic vision, ships today)
  audio          -> audio_transcript (OpenAI-compatible Whisper, when configured)

Storage mirrors the field_observation_media trust model: member-scoped by
cipher_id (signed invite-token cookie fallback), no unfiltered read branch, and
every trigger/read only matches the caller's own rows. Nothing is sent to Nexus
or the AI's chat automatically — preparation derives and stores text; the member
brings it forward deliberately, client-side.

These tests boot the real FastAPI app via TestClient and assert:
  * image extract dispatches to image_text and, with a mocked model, stores real
    text (mockable success path, no network)
  * audio extract dispatches to audio_transcript and, with a mocked provider,
    stores a real transcript (mockable success path, no network)
  * with no provider configured, audio prep stores an honest 'unavailable'
    artifact whose message names OPENAI_API_KEY (never a false 'done')
  * the image describer, with no ANTHROPIC_API_KEY, returns an honest
    'unavailable' result naming ANTHROPIC_API_KEY
  * empty media is handled gracefully (error status, user-visible message)
  * a member cannot prepare another member's image/audio (no cross-member access)
  * a retry replaces the prior artifact of the same type (no accumulation)
  * studio.html surfaces the prepare affordances directly on media cards
    (Transcribe audio / Describe / OCR image), removes the dead 'soon' copy for
    these flows, and never auto-sends to Nexus

Run: python3 tests/field-observation-media-processing.test.py
"""
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="fo_media_proc_")
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


# A valid 1x1 PNG (whitelisted image type) and arbitrary audio bytes. Content is
# irrelevant here because the model/provider calls are mocked or unavailable.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
    "890000000d4944415478da6360000002000154a24f8f0000000049454e44ae426082"
)
MP3 = b"ID3" + b"\x00" * 64  # arbitrary non-empty audio payload

assert server._signed_cookie_value("tokA", "invite"), "cookie signing not configured"

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


# ── Pure helper behaviour: provider-honest unavailability ─────────────────────
print("1. audio transcription is provider-honest when unconfigured")
_saved_openai = os.environ.pop("OPENAI_API_KEY", None)
res = server._fo_transcribe_audio(MP3, "audio/mpeg", "memo.mp3")
ok(res["status"] == "unavailable", "no OPENAI_API_KEY -> status unavailable (not a false done)")
ok("OPENAI_API_KEY" in res["error"], "unavailable message names the exact env var needed")
ok(res["text"] == "", "unavailable transcription carries no fabricated text")
resE = server._fo_transcribe_audio(b"", "audio/mpeg", "empty.mp3")
ok(resE["status"] == "error" and bool(resE["error"]), "empty audio -> graceful error with a message")
if _saved_openai is not None:
    os.environ["OPENAI_API_KEY"] = _saved_openai

print("\n2. image describer is provider-honest when the key is absent")
_saved_anthropic = os.environ.pop("ANTHROPIC_API_KEY", None)
resImg = server._fo_describe_image(PNG, "image/png")
ok(resImg["status"] == "unavailable", "no ANTHROPIC_API_KEY -> status unavailable")
ok("ANTHROPIC_API_KEY" in resImg["error"], "unavailable message names ANTHROPIC_API_KEY")
resImgE = server._fo_describe_image(b"", "image/png")
ok(resImgE["status"] == "error" and bool(resImgE["error"]), "empty image -> graceful error with a message")
if _saved_anthropic is not None:
    os.environ["ANTHROPIC_API_KEY"] = _saved_anthropic

# ── Mockable success paths (no network): patch the pure helpers ───────────────
print("\n3. image extract dispatches to image_text and stores real text (mocked model)")
_orig_img = server._fo_describe_image
server._fo_describe_image = lambda data, ctype: {
    "status": "done",
    "text": "TRANSCRIPTION\nHello board\n\nDESCRIPTION\nA whiteboard photo.",
    "error": "",
}
try:
    rUp = upload(fresh_client(), "tokA", "cipher_A", "board.png", "image/png", PNG)
    ok(rUp.status_code == 200 and rUp.json()["media_kind"] == "image", "image upload ok, classified image")
    img_id = rUp.json()["id"]
    rEx = extract(fresh_client(), "tokA", "cipher_A", img_id)
    ok(rEx.status_code == 200, "image extract returns 200")
    proc = rEx.json()["processed"]
    ok(proc["process_type"] == "image_text", "artifact stored under image_text")
    ok(proc["status"] == "done" and "Hello board" in proc["text"], "mocked OCR text is stored")
    ok(proc["source_media_id"] == img_id, "artifact links back to the image")
    ok("invite_token" not in proc, "artifact never leaks invite_token")
    img_proc_id = proc["id"]
    # Retry replaces the prior image_text artifact rather than accumulating.
    rEx2 = extract(fresh_client(), "tokA", "cipher_A", img_id)
    ok(rEx2.json()["processed"]["id"] != img_proc_id, "re-read mints a fresh artifact id")
    rList = fresh_client().get("/api/studio/field-observations/processed",
                               params={"cipher_id": "cipher_A", "source_media_id": img_id},
                               cookies=invite_cookie("tokA"))
    ok(len(rList.json()["processed"]) == 1, "only one image_text artifact per source survives a retry")
    # Cross-member isolation for image preparation.
    rExB = extract(fresh_client(), "tokB", "cipher_B", img_id)
    ok(rExB.status_code == 404, "B cannot prepare A's image even with the exact id -> 404")
finally:
    server._fo_describe_image = _orig_img

print("\n4. audio extract dispatches to audio_transcript and stores a transcript (mocked provider)")
_orig_aud = server._fo_transcribe_audio
server._fo_transcribe_audio = lambda data, ctype, name: {
    "status": "done", "text": "This is the spoken transcript.", "error": "",
}
try:
    rUpA = upload(fresh_client(), "tokA", "cipher_A", "memo.mp3", "audio/mpeg", MP3)
    ok(rUpA.status_code == 200 and rUpA.json()["media_kind"] == "audio", "audio upload ok, classified audio")
    aud_id = rUpA.json()["id"]
    rExA = extract(fresh_client(), "tokA", "cipher_A", aud_id)
    ok(rExA.status_code == 200, "audio extract returns 200")
    procA = rExA.json()["processed"]
    ok(procA["process_type"] == "audio_transcript", "artifact stored under audio_transcript")
    ok(procA["status"] == "done" and "spoken transcript" in procA["text"], "mocked transcript is stored")
    ok(procA["source_media_id"] == aud_id, "artifact links back to the audio")
finally:
    server._fo_transcribe_audio = _orig_aud

print("\n5. with no provider configured, audio prep stores an honest 'unavailable' artifact")
_saved_openai2 = os.environ.pop("OPENAI_API_KEY", None)
try:
    rUpU = upload(fresh_client(), "tokA", "cipher_A", "unconfigured.mp3", "audio/mpeg", MP3)
    unc_id = rUpU.json()["id"]
    rExU = extract(fresh_client(), "tokA", "cipher_A", unc_id)
    ok(rExU.status_code == 200, "audio prep still returns 200 (honest artifact, not a hard error)")
    procU = rExU.json()["processed"]
    ok(procU["status"] == "unavailable", "status is unavailable (never a false done)")
    ok("OPENAI_API_KEY" in procU["error"], "the stored message names OPENAI_API_KEY")
    ok(rExU.json()["ok"] is False, "the endpoint reports ok=false for an unavailable outcome")
finally:
    if _saved_openai2 is not None:
        os.environ["OPENAI_API_KEY"] = _saved_openai2

print("\n6. missing media id -> 404 (dispatch never runs on a phantom)")
ok(extract(fresh_client(), "tokA", "cipher_A", "fmed_does_not_exist").status_code == 404,
   "extract on a non-existent media id -> 404")

# ── studio.html affordances ───────────────────────────────────────────────────
print("\n7. studio.html surfaces prepare actions directly on media cards")
import pathlib as _pl
import re as _re
HTML = (_pl.Path(ROOT) / "studio.html").read_text(encoding="utf-8")
ok("function foPrepareButtonHtml(" in HTML, "a shared prepare-button builder exists")
ok("function foHumanKind(" in HTML, "media-kind labels are humanised (PDF/Image/Audio)")
ok("async function studioPrepareMedia(" in HTML, "a generic prepare handler exists")
ok("Transcribe audio" in HTML, "audio cards offer a real Transcribe audio action")
ok("Describe / OCR image" in HTML, "image cards offer a real Describe / OCR image action")
ok("Extract text" in HTML, "PDF cards keep the Extract text action")
ok(HTML.count("fo-prepare-btn") >= 3, "prepare button is rendered and wired (central + archive)")
# The dead 'soon' dead-ends for these supported flows are gone.
ok("Transcribe audio <span class=\"soon\">soon</span>" not in HTML,
   "the dead 'Transcribe audio soon' button is removed")
ok("Extract text <span class=\"soon\">soon</span>" not in HTML,
   "the dead 'Extract text soon' button is removed")
# Preparation must never auto-send to Nexus: the handler hits the extract route,
# reloads processed artifacts, and re-renders — it does not submit or call the AI.
_prep_fn = (_re.search(r"async function studioPrepareMedia[\s\S]*?\n}", HTML) or [""])[0]
ok(bool(_prep_fn), "studioPrepareMedia() is defined")
ok("/extract" in _prep_fn, "prepare calls the member-scoped extract route")
ok(not _re.search(r"rose-mirror|\.submit\s*\(", _prep_fn),
   "prepare never calls /rose-mirror and never auto-submits to Nexus")

print(f"\n{passed} passed")
