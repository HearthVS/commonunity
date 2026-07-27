#!/usr/bin/env python3
"""The stUdio Nexus conversation always renders something.

Regression cover for blank Nexus bubbles in stUdio: the chat surface renders
`chunk` text and nothing else, so any turn that streams no chunk shows an
empty bubble with no reason and no recovery. This suite pins the properties
that make that impossible, on the exact surface the member uses:

  * POST /rose-mirror in all four rooms streams non-empty renderable text,
    under `legacy` AND under `grounded_v1` — the context mode never reaches
    the conversation endpoint
  * a turn that errors, is rate-limited, or completes with no content still
    streams renderable text
  * the stUdio turn is not given a smaller reasoning budget than the short
    endpoints (the condition that produces content-free completions)
  * blank turns already saved in a member's browser are dropped instead of
    being forwarded as empty content blocks, so one silent failure cannot
    break every later turn in that room
  * the browser parses SSE with a retained buffer and surfaces an error, so a
    straddled line or a failed turn is never rendered as an empty bubble

Run: python3 tests/studio-nexus-chat-renderable.test.py
"""
import json
import os
import re
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="studio_chat_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_tmp_dir, "admin.sqlite3")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "rootadmin")
os.environ.pop("STUDIO_CONTEXT_MODE", None)
os.environ.pop("STUDIO_CONTEXT_FAILURE_POLICY", None)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from studio_context import modes  # noqa: E402

passed = 0


def ok(cond, label):
    global passed
    if not cond:
        raise AssertionError("FAILED: " + label)
    print("  ok  " + label)
    passed += 1


ROOMS = {
    "work": ("The Work", "Life's Work"),
    "lens": ("The Lens", "Evolution"),
    "field": ("The Field", "Radiance"),
    "call": ("The Call", "Purpose"),
}


class _FakeStream:
    def __init__(self, texts):
        self._texts = texts

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    @property
    def text_stream(self):
        for t in self._texts:
            yield t

    def get_final_message(self):
        class _Usage:
            input_tokens = 11
            output_tokens = 7

        class _Message:
            usage = _Usage()

        return _Message()


class _FakeMessages:
    """Stands in for the Anthropic client, and records what it was asked for."""

    def __init__(self):
        self.calls = []
        self.texts = ["Yes — ", "I am here."]
        self.raises = None

    def stream(self, **kwargs):
        self.calls.append(kwargs)
        if self.raises is not None:
            raise self.raises
        return _FakeStream(self.texts)


fake = _FakeMessages()
server.client.messages = fake


def member_client():
    c = TestClient(server.app)
    c.cookies.clear()
    c.cookies.set(server._ADMIN_COOKIE, server._signed_cookie_value("open", "admin"))
    return c


member = member_client()


def chat(room="work", message="are you functional now?", history=None, mode="studio"):
    """One turn on the exact surface stUdio calls, decoded the way it decodes."""
    title, subtitle = ROOMS[room]
    response = member.post(
        "/rose-mirror",
        json={
            "message": message,
            "room": room,
            "room_title": title,
            "room_subtitle": subtitle,
            "mode": mode,
            "companion": "Unity Point 22.5",
            "history": history or [],
        },
    )
    events = []
    for line in response.text.split("\n"):
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    rendered = "".join(e["chunk"] for e in events if e.get("chunk"))
    return response.status_code, rendered, events


def set_mode(target):
    if target == "legacy":
        member.post("/api/admin/studio-context-mode/rollback", json={"confirm": True})
    else:
        member.post(
            "/api/admin/studio-context-mode/activate",
            json={"mode": target, "confirm": True},
        )
    assert modes.current_mode() == target, f"could not set mode {target}"


print("\n── every room answers, in both context modes ──")
for mode in ("legacy", "grounded_v1"):
    set_mode(mode)
    for room in ROOMS:
        status, rendered, _ = chat(room=room)
        ok(status == 200, f"{mode}: {room} responds 200")
        ok(rendered.strip() != "", f"{mode}: {room} streams non-empty renderable text")
        ok(rendered == "Yes — I am here.", f"{mode}: {room} renders the model's answer verbatim")

set_mode("legacy")

print("\n── the context mode never reaches the conversation endpoint ──")
set_mode("legacy")
fake.calls.clear()
chat(room="work")
legacy_call = fake.calls[-1]
set_mode("grounded_v1")
fake.calls.clear()
chat(room="work")
grounded_call = fake.calls[-1]
set_mode("legacy")
ok(legacy_call["system"] == grounded_call["system"],
   "grounded_v1 leaves the stUdio conversation prompt byte-for-byte unchanged")
ok(legacy_call["messages"] == grounded_call["messages"],
   "grounded_v1 leaves the stUdio conversation transcript unchanged")
ok(legacy_call["model"] == grounded_call["model"]
   and legacy_call["output_config"] == grounded_call["output_config"],
   "grounded_v1 leaves model and reasoning effort unchanged")

print("\n── a failed or content-free turn still says something ──")
fake.raises = RuntimeError("upstream refused the request")
status, rendered, events = chat()
fake.raises = None
ok(status == 200, "an upstream failure still returns 200 to the stream")
ok(rendered.strip() != "", "an upstream failure streams renderable text, not an empty bubble")
ok(any(e.get("error") for e in events), "the error detail is still on the wire for the console")

fake.texts = []
status, rendered, events = chat()
fake.texts = ["Yes — ", "I am here."]
ok(rendered.strip() != "", "a completion with no content streams renderable text")
ok(any(e.get("done") for e in events), "a completion with no content still ends with done")

fake.texts = [""]
status, rendered, _ = chat()
fake.texts = ["Yes — ", "I am here."]
ok(rendered.strip() != "", "a completion of empty chunks streams renderable text")

print("\n── the stUdio turn has room to answer ──")
fake.calls.clear()
chat(mode="studio")
studio_budget = fake.calls[-1]["max_tokens"]
fake.calls.clear()
chat(mode="compass")
compass_budget = fake.calls[-1]["max_tokens"]
ok(studio_budget >= server._NEXUS_SHORT_MAX_TOKENS,
   "the stUdio turn is not budgeted below the short endpoints")
ok(studio_budget >= compass_budget,
   "the stUdio turn — the longest prompt and the longest answer — is not the tightest budget")
ok(server._NEXUS_STUDIO_MAX_TOKENS == studio_budget,
   "the stUdio budget is the declared constant")

print("\n── a blank turn cannot poison the room ──")
fake.calls.clear()
poisoned = [
    {"role": "user", "text": "i notice that you are not functioning"},
    {"role": "rose", "text": ""},
    {"role": "user", "text": "are you functional now?"},
    {"role": "rose", "text": "   "},
]
status, rendered, _ = chat(history=poisoned)
sent = fake.calls[-1]["messages"]
ok(rendered.strip() != "", "a room with blank turns already saved still answers")
ok(all(m["content"].strip() for m in sent), "no empty content block is forwarded to the model")
ok(sent[0]["role"] == "user", "the transcript opens on a user turn")
ok(all(a["role"] != b["role"] for a, b in zip(sent, sent[1:])),
   "roles alternate after the blank turns are dropped")
ok(sent[-1]["content"].endswith("are you functional now?"),
   "the member's current message is the last thing the model sees")

fake.calls.clear()
chat(history=[{"role": "rose", "text": "an opening line"}])
ok(fake.calls[-1]["messages"][0]["role"] == "user",
   "a history that opens on Nexus is not sent as a leading assistant turn")

print("\n── the browser cannot render a blank bubble ──")
studio_html = open(os.path.join(ROOT, "studio.html"), encoding="utf-8").read()
send_fn = studio_html[studio_html.index("fetch(`${API_BASE}/rose-mirror`"):]
send_fn = send_fn[: send_fn.index("// WORKBENCH")]

ok("decoder.decode(value, { stream: true })" in send_fn,
   "the stUdio chat decodes the stream incrementally")
ok("buffer = lines.pop()" in send_fn,
   "an incomplete trailing SSE line is retained for the next read")
ok(re.search(r"d\.error && !text", send_fn) is not None,
   "an error with nothing streamed is rendered instead of left blank")
ok(re.search(r"if \(text\) state\.rooms\[currentRoom\]\.mirrorHistory\.push", send_fn) is not None,
   "an empty turn is never written into the saved transcript")

set_mode("legacy")
ok(modes.current_mode() == "legacy", "suite leaves production behaviour on legacy")


def test_studio_nexus_chat_renderable():
    """pytest entry point — the module body is the suite."""
    assert passed > 0


print(f"\n{passed} passed")
