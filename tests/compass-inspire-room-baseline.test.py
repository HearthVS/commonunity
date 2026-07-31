#!/usr/bin/env python3
"""Inspire in cOMpass grounds in the room the member is looking at.

The four grounded rooms open from two products. stUdio holds a member's
orientation in accepted records; cOMpass has no such store — the OM Cipher
resolves each room's Gene Key and line in the browser and the room header
displays them. The grounded pipeline originally knew only about the stUdio
store, so a cOMpass member pressing Inspire in The Work with `GK 42 · Line 5`
on screen got a clarification asking them to add a key "into your stUdio":
wrong product, wrong claim, and the imported transcript in the payload was
discarded along with the request, because a clarification short-circuits the
pipeline before the model is ever called.

This suite fixes the behaviour in place. What it asserts, in order:

  * the reported bug   — GK 42 / Line 5 visible in the header reaches the
                         corpus, the imported transcript reaches the prompt,
                         and the model is actually called
  * no cross-product   — nothing on the cOMpass path says "stUdio", including
                         the clarifications cOMpass can still legitimately give
  * trust unchanged    — honouring the room's key never means trusting the
                         browser's text for it, and stUdio keeps its stricter
                         corroborated-pointer rule
  * no lowered bar     — a room baseline decides *which* key may be opened, not
                         *whether* to open one; ordinary drafting still
                         retrieves nothing

Run: python3 tests/compass-inspire-room-baseline.test.py
"""
import json
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="sc_compass_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_tmp_dir, "admin.sqlite3")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "rootadmin")
os.environ.pop("STUDIO_CONTEXT_MODE", None)
os.environ.pop("STUDIO_CONTEXT_FAILURE_POLICY", None)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from studio_context import modes, prompts, relevance, rooms  # noqa: E402

# The member in the screenshot: works entirely in cOMpass, so nothing has ever
# been written to the stUdio record store for them.
DANE = "cipher_compass_dane"
# A stUdio member with an accepted key, used to prove the stricter surface did
# not inherit cOMpass's trust in the payload.
ALICE = "cipher_compass_alice"
ALICE_KEY = 44
ALICE_LINE = 3

# The Work room as cOMpass renders it in the header.
HEADER_KEY = 42
HEADER_LINE = 5

TRANSCRIPT_MARKER = "chairmaking-transcript-marker"
IMPORTED_TRANSCRIPT = (
    "--- From transcript: session-one.txt ---\n"
    f"I keep coming back to the same pattern with {TRANSCRIPT_MARKER}. "
    "We talked about the Gene Keys and what my shadow does when I over-prepare "
    "instead of shipping the work."
)

# Band text the browser sends alongside the header. It is never source
# material, whatever surface asked, so these exact strings must not survive
# into a prompt even though the corpus says something similar.
FAKE_BANDS = {
    "gk_shadow": "client-shadow-marker-do-not-trust",
    "gk_gift": "client-gift-marker-do-not-trust",
    "gk_siddhi": "client-siddhi-marker-do-not-trust",
}

passed = 0


def ok(cond, label):
    global passed
    if not cond:
        raise AssertionError("FAILED: " + label)
    print("  ok  " + label)
    passed += 1


# ── harness ──────────────────────────────────────────────────────────────────

class _FakeStream:
    def __init__(self):
        self.text_stream = ["drafted ", "text."]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


captured = {}
_real_stream = server.client.messages.stream


def _fake_stream(**kwargs):
    captured.clear()
    captured.update(kwargs)
    return _FakeStream()


server.client.messages.stream = _fake_stream

c = TestClient(server.app)
c.cookies.clear()
c.cookies.set(server._ADMIN_COOKIE, server._signed_cookie_value("open", "admin"))


def set_mode(mode):
    if mode == modes.LEGACY:
        c.post("/api/admin/studio-context-mode/rollback")
    else:
        c.post("/api/admin/studio-context-mode/activate", json={"mode": mode, "confirm": True})
    assert modes.current_mode() == mode, f"could not set mode {mode}"


def create(cipher, **kwargs):
    r = c.post("/api/studio/context-records", json=dict({"cipher_id": cipher}, **kwargs))
    assert r.status_code == 200, r.text
    return r.json()


def inspire(point="work", field="theme", cipher_id=DANE, **kwargs):
    """POST /inspire-layer2 and return (events, captured model kwargs)."""
    captured.clear()
    body = dict({
        "point": point, "field": field, "cipher_id": cipher_id,
        "companion": "", "session_notes": "", "qa_answers": [],
        "surface": "", "gk_num": "", "gk_line": "",
        "gk_shadow": "", "gk_gift": "", "gk_siddhi": "",
        "audience": {}, "evidence": {},
    }, **kwargs)
    events = []
    with c.stream("POST", "/inspire-layer2", json=body) as r:
        assert r.status_code == 200, r.status_code
        for line in r.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))
    return events, dict(captured)


def compass_work(**kwargs):
    """The exact shape cOMpass sends for The Work: header key, header line,
    the header's band labels, and whatever is in the room's notes."""
    header = dict(FAKE_BANDS, surface="compass",
                  gk_num=str(HEADER_KEY), gk_line=str(HEADER_LINE))
    return inspire(**dict(header, **kwargs))


def grounding_of(events):
    for event in events:
        if "grounding" in event:
            return event["grounding"]
    return {}


def reply_of(events):
    return "".join(e.get("chunk", "") for e in events)


def user_text(model_kwargs):
    return model_kwargs["messages"][0]["content"] if model_kwargs else ""


def prompt_text(model_kwargs):
    return (model_kwargs["system"] + "\n" + user_text(model_kwargs)) if model_kwargs else ""


set_mode(modes.GROUNDED_V1)
create(ALICE, provenance_class="member_authored", room="work",
       gene_key=ALICE_KEY, gene_key_line=ALICE_LINE,
       label="Accepted thread in The Work", essence="alice-essence-marker",
       idempotency_key="compass-alice-essence")


# ── the reported bug ─────────────────────────────────────────────────────────

print("\n── the room's visible Gene Key is what Inspire grounds in ──")

events, model = compass_work(session_notes=IMPORTED_TRANSCRIPT)
grounding = grounding_of(events)

ok(grounding["relevance"] != relevance.CLARIFICATION_REQUIRED,
   "a room with a resolved key no longer asks which key is meant")
ok(model != {},
   "the model is actually called instead of being short-circuited")
ok(grounding["surface"] == relevance.COMPASS,
   "the response records which product asked")
ok(grounding["gene_key_source"] == rooms.KEY_SOURCE_BASELINE,
   "the key is attributed to the cOMpass room baseline, not to a stUdio record")
ok(grounding["used_canonical_sources"] is True,
   "the canonical corpus is opened for the visible key")
ok(f"gk:{HEADER_KEY:02d}@" in " ".join(grounding["canonical_source_ids"]),
   f"the excerpt retrieved is Gene Key {HEADER_KEY}, the one in the header")
ok(f"line:work:{HEADER_LINE}@" in " ".join(grounding["canonical_source_ids"]),
   f"the Work line passage retrieved is Line {HEADER_LINE}, the one in the header")
ok(grounding["relevance"] == relevance.GENE_KEY_AND_LINE,
   "key and line together, because the request names a recurring pattern")

body = user_text(model)
ok(f"Gene Key {HEADER_KEY}" in body,
   "the Gene Key excerpt reaches the model")
ok("EXPECTATION" in body.upper() and "DETACHMENT" in body.upper(),
   "the whole Shadow/Gift spectrum is present, read from the corpus")
ok(prompts.CANONICAL in body,
   "canonical material is fenced as verified source excerpts")

ok(TRANSCRIPT_MARKER in body,
   "text imported through Setup reaches the prompt rather than being discarded")
ok(prompts.REQUEST in body,
   "the imported transcript is fenced as the current request")


print("\n── nothing on the cOMpass path mentions the other product ──")

ok("stUdio" not in model["system"],
   "the sovereignty foundation names cOMpass, not stUdio")
ok("cOMpass" in model["system"],
   "the foundation names the product the member is actually in")
ok("stUdio" not in prompt_text(model),
   "no part of the assembled prompt sends the member to stUdio")

# The clarifications cOMpass can still legitimately reach: a member with no
# resolved key at all, and a request too thin to work from.
blank = inspire(surface="compass", session_notes="Open my Gene Key shadow frequency for this.")
ok(grounding_of(blank[0])["relevance"] == relevance.CLARIFICATION_REQUIRED,
   "with no key resolved anywhere, cOMpass still asks rather than guesses")
ok("stUdio" not in reply_of(blank[0]),
   "that clarification does not send a cOMpass member to stUdio")
ok("cOMpass" in reply_of(blank[0]),
   "it names the place that actually holds their orientation")

thin = inspire(surface="compass", session_notes="go")
ok(grounding_of(thin[0])["relevance"] == relevance.CLARIFICATION_REQUIRED,
   "a thin request still asks for something to work from")
ok("stUdio" not in reply_of(thin[0]),
   "the thin-request clarification is free of stUdio wording too")

for room in rooms.GROUNDED_ROOMS:
    for kind in ("no_owned_key", "pattern_no_context", "thin_request"):
        text = relevance.clarification_text(room, kind, relevance.COMPASS)
        ok("stUdio" not in text,
           f"{room}/{kind}: no stUdio wording on the cOMpass surface")
        ok("{" not in text and "}" not in text,
           f"{room}/{kind}: the cOMpass clarification renders completely")


print("\n── a clarification reports itself as a clarification ──")

ok(grounding_of(blank[0])["status"] == rooms.STATUS_CLARIFICATION,
   "the grounding status is clarification_required, not grounded")
ok(blank[1] == {},
   "a clarification never calls the model")


# ── trust boundaries are unchanged ───────────────────────────────────────────

print("\n── honouring the room's key is not trusting the browser's text ──")

ok(all(v not in prompt_text(model) for v in FAKE_BANDS.values()),
   "client-supplied Shadow/Gift/Siddhi text never reaches the prompt")
ok(grounding["source_versions"],
   "the excerpt is stamped with the corpus version it was read from")

bogus, bogus_model = inspire(surface="compass", gk_num="999", gk_line="5",
                             session_notes=IMPORTED_TRANSCRIPT)
bogus_grounding = grounding_of(bogus)
ok(bogus_grounding["used_canonical_sources"] is False,
   "a key outside the corpus is refused rather than fabricated")
ok(bogus_grounding["gene_key_source"] == rooms.KEY_SOURCE_NONE,
   "and no key source is claimed for it")

bad_line, _ = compass_work(gk_line="9", session_notes=IMPORTED_TRANSCRIPT)
bad_line_ids = " ".join(grounding_of(bad_line)["canonical_source_ids"])
ok(f"gk:{HEADER_KEY:02d}@" in bad_line_ids,
   "an out-of-range line does not cost the member their valid key")
ok("line:work:" not in bad_line_ids,
   "but no line passage is invented for it")


print("\n── stUdio keeps the stricter contract ──")

studio_events, studio_model = inspire(
    cipher_id=ALICE, surface="studio", gk_num=str(HEADER_KEY), gk_line=str(HEADER_LINE),
    session_notes="Deepen this with my Gene Key shadow frequency.",
)
studio_ids = " ".join(grounding_of(studio_events)["canonical_source_ids"])
ok(f"gk:{HEADER_KEY:02d}@" not in studio_ids,
   "in stUdio the browser cannot widen grounding to an unaccepted key")
ok(f"gk:{ALICE_KEY}@" in studio_ids,
   "it grounds in the key the member actually accepted")
ok(grounding_of(studio_events)["gene_key_source"] == rooms.KEY_SOURCE_ACCEPTED,
   "and says so")
ok("stUdio" in studio_model["system"],
   "the stUdio foundation still names stUdio")

# Anything that is not exactly a known surface — an older client that sends no
# surface at all, a typo, a wrapper inventing one — reads as stUdio, the
# stricter contract.
for unknown in ("", "  ", "oracle", "compass-v2", "STUDIO_ADMIN"):
    default_events, _ = inspire(
        cipher_id=ALICE, surface=unknown, gk_num=str(HEADER_KEY),
        session_notes="Deepen this with my Gene Key shadow frequency.",
    )
    ids = " ".join(grounding_of(default_events)["canonical_source_ids"])
    ok(f"gk:{HEADER_KEY:02d}@" not in ids,
       f"an unrecognised surface {unknown!r} cannot be invented to loosen grounding")

narrowed, _ = inspire(
    cipher_id=ALICE, surface="compass", gk_num=str(ALICE_KEY),
    session_notes="Deepen this with my Gene Key shadow frequency.",
)
ok(grounding_of(narrowed)["gene_key_source"] == rooms.KEY_SOURCE_POINTER,
   "an accepted record still outranks the baseline when both name the key")


# ── the baseline decides which key, not whether ──────────────────────────────

print("\n── a resolved key does not lower the retrieval bar ──")

ordinary, ordinary_model = compass_work(
    session_notes="Write a short summary of the chair repair workshop I run on Saturdays.",
)
ordinary_grounding = grounding_of(ordinary)
ok(ordinary_grounding["used_canonical_sources"] is False,
   "ordinary drafting opens no transcript just because a key is on screen")
ok(ordinary_grounding["relevance"] == relevance.NONE,
   "the decision is 'nothing to ground with', not a retrieval")
ok("chair repair workshop" in user_text(ordinary_model),
   "the member's actual request still reaches the model")
ok(prompts.CANONICAL not in user_text(ordinary_model),
   "and no verified-source block is fabricated around it")
ok("stUdio" not in prompt_text(ordinary_model),
   "the ungrounded cOMpass path is free of stUdio wording as well")


print("\n── the operator surface can tell the two apart ──")

debug = c.get("/api/admin/studio-context-rooms")
ok(debug.status_code == 200, "the room debug surface is readable by an admin")
state = debug.json()
ok(relevance.COMPASS in state["surfaces"] and relevance.STUDIO in state["surfaces"],
   "both surfaces are declared to operators")
ok(rooms.KEY_SOURCE_BASELINE in state["gene_key_sources"],
   "the room-baseline attribution is a declared category")
blob = json.dumps(state)
for mark in (TRANSCRIPT_MARKER, "alice-essence-marker", *FAKE_BANDS.values()):
    ok(mark not in blob, f"the admin surface never exposes {mark[:30]!r}")


# ── reversibility ────────────────────────────────────────────────────────────

print("\n── legacy mode is untouched by any of this ──")

set_mode(modes.LEGACY)
legacy, legacy_model = compass_work(session_notes=IMPORTED_TRANSCRIPT)
ok(grounding_of(legacy) == {},
   "legacy mode emits no grounding metadata")
ok(legacy_model != {},
   "legacy mode still calls the model")
ok(TRANSCRIPT_MARKER in user_text(legacy_model),
   "and the imported transcript still reaches it")

server.client.messages.stream = _real_stream


def test_compass_inspire_room_baseline():
    """pytest entry point — the module body is the suite."""
    assert passed > 0


print(f"\n{passed} passed")
