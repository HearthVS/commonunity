#!/usr/bin/env python3
"""Personal orientation records, grounded assembly, and legacy parity.

This is the trust-boundary suite. It asserts that the grounded path cannot be
talked into using material it should not have:

  * the table migrates in idempotently, with the expected shape
  * records are isolated per member; one member can never read, accept or
    reject another's, and a caller with no member scope gets nothing
  * sealed material never enters an assembly
  * AI output is never auto-promoted to trusted personal context
  * acceptance derives a new record and preserves the untrusted origin
  * accept / reject / create are idempotent
  * the trace names ids and versions but never member text
  * grounding failure is structured — never a silent generic answer
  * legacy prompt building is byte-for-byte unchanged by the mode setting

Run: python3 tests/studio-context-records.test.py
"""
import json
import os
import sys
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="sc_records_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_tmp_dir, "admin.sqlite3")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "rootadmin")
os.environ.pop("STUDIO_CONTEXT_MODE", None)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from studio_context import assembler, canonical, modes, provenance, store, trace  # noqa: E402

ALICE = "cipher_alice"
BOB = "cipher_bob"

# Distinctive strings so a leak into a trace or log is unmistakable.
ALICE_ESSENCE = "alice-private-essence-marker"
ALICE_SEALED = "alice-sealed-marker"
BOB_ESSENCE = "bob-private-essence-marker"
AI_TEXT = "ai-generated-proposal-marker"

passed = 0


def ok(cond, label):
    global passed
    if not cond:
        raise AssertionError("FAILED: " + label)
    print("  ok  " + label)
    passed += 1


def member_client():
    c = TestClient(server.app)
    c.cookies.clear()
    c.cookies.set(server._ADMIN_COOKIE, server._signed_cookie_value("open", "admin"))
    return c


def set_mode(mode):
    c = member_client()
    if mode == "legacy":
        c.post("/api/admin/studio-context-mode/rollback")
    else:
        c.post("/api/admin/studio-context-mode/activate", json={"mode": mode, "confirm": True})
    assert modes.current_mode() == mode, f"could not set mode {mode}"


def create(client, cipher, **kwargs):
    payload = dict({"cipher_id": cipher}, **kwargs)
    return client.post("/api/studio/context-records", json=payload)


c = member_client()

print("\n── migration ──")
with server._admin_db() as conn:
    columns = {row[1]: row[2] for row in conn.execute(f"PRAGMA table_info({store.TABLE})").fetchall()}
ok(bool(columns), f"{store.TABLE} exists after boot, with no manual migration step")
for column in ("id", "cipher_id", "invite_token", "room", "gene_key", "gene_key_line",
               "source_version", "source_ids", "label", "essence", "reflection",
               "provenance_class", "acceptance_state", "visibility", "derived_from",
               "idempotency_key", "created_at", "updated_at", "accepted_at"):
    ok(column in columns, f"column present: {column}")

with server._admin_db() as conn:
    store.init_schema(conn)
    store.init_schema(conn)
    conn.commit()
ok(True, "init_schema is idempotent — safe to run on every connection")

with server._admin_db() as conn:
    indexes = {row[1] for row in conn.execute(f"PRAGMA index_list({store.TABLE})").fetchall()}
ok(any("idem" in name for name in indexes), "the owner-scoped idempotency index exists")

print("\n── creation and provenance defaults ──")
set_mode("grounded_v1")

r = create(c, ALICE, provenance_class="member_authored", room="work",
           gene_key=25, gene_key_line=3, essence=ALICE_ESSENCE, idempotency_key="a-1")
ok(r.status_code == 200, "a member can create their own record")
alice_authored = r.json()
ok(alice_authored["provenance_class"] == "member_authored", "class is stored as given")
ok(alice_authored["acceptance_state"] == "accepted",
   "member-authored material is accepted on arrival — writing it is the acceptance")
ok(alice_authored["visibility"] == "private", "visibility defaults to private")
ok(alice_authored["gene_key"] == 25 and alice_authored["gene_key_line"] == 3,
   "the canonical reference is stored")
ok("invite_token" not in alice_authored, "the invite token never leaves the database")

r = create(c, ALICE, provenance_class="ai_proposal", room="work",
           gene_key=25, essence=AI_TEXT)
proposal = r.json()
ok(proposal["acceptance_state"] == "proposed", "an ai_proposal arrives unaccepted")
ok(proposal["provenance_class"] == "ai_proposal", "an ai_proposal keeps its class")

r = create(c, ALICE, provenance_class="ephemeral_operational", room="work", essence="scratch")
ok(r.json()["acceptance_state"] == "proposed", "ephemeral_operational is never auto-accepted")

sealed = create(c, ALICE, provenance_class="member_authored", room="work",
                gene_key=25, essence=ALICE_SEALED, visibility="sealed").json()
ok(sealed["visibility"] == "sealed", "a member can mark material sealed")

print("\n── client-declarable classes are restricted ──")
for forbidden in ("verified_source", "accepted_personal_context", "member_edited_synthesis"):
    r = create(c, ALICE, provenance_class=forbidden, essence="x")
    ok(r.status_code == 422, f"a client cannot declare its material {forbidden}")
for bogus in ("trusted", "", "MEMBER_AUTHORED; drop table", "admin"):
    ok(create(c, ALICE, provenance_class=bogus, essence="x").status_code == 422,
       f"unknown provenance class rejected: {bogus!r}")

ok(create(c, ALICE, provenance_class="member_authored", essence="x",
          visibility="public").status_code == 422, "unknown visibility rejected")
ok(create(c, ALICE, provenance_class="member_authored", gene_key=99).status_code == 422,
   "out-of-range gene key rejected at the API boundary")
ok(create(c, ALICE, provenance_class="member_authored", gene_key=25,
          gene_key_line=9).status_code == 422, "out-of-range line rejected")

print("\n── idempotency ──")
again = create(c, ALICE, provenance_class="member_authored", room="work",
               gene_key=25, essence="different text", idempotency_key="a-1").json()
ok(again["id"] == alice_authored["id"], "a replayed create returns the original record")
ok(again["essence"] == ALICE_ESSENCE, "a replayed create does not overwrite the original")

bob_same_key = create(c, BOB, provenance_class="member_authored",
                      essence=BOB_ESSENCE, idempotency_key="a-1").json()
ok(bob_same_key["id"] != alice_authored["id"],
   "idempotency keys are owner-scoped — two members may reuse the same key")

print("\n── ownership isolation ──")
alice_list = c.get("/api/studio/context-records", params={"cipher_id": ALICE}).json()["records"]
bob_list = c.get("/api/studio/context-records", params={"cipher_id": BOB}).json()["records"]
ok(len(alice_list) >= 4, "alice sees her own records")
ok(len(bob_list) == 1, "bob sees only his own record")
ok(all(ALICE_ESSENCE != rec["essence"] for rec in bob_list),
   "alice's material never appears in bob's list")
ok(ALICE_ESSENCE not in c.get("/api/studio/context-records",
                              params={"cipher_id": BOB}).text,
   "alice's text is nowhere in bob's response body")

no_scope = c.get("/api/studio/context-records").json()["records"]
ok(no_scope == [], "a caller with no member scope gets nothing, never the whole table")
ok(create(c, "", provenance_class="member_authored", essence="x").status_code == 403,
   "a caller with no member scope cannot create")

r = c.post(f"/api/studio/context-records/{proposal['id']}/accept", json={"cipher_id": BOB})
ok(r.status_code == 404, "bob cannot accept alice's proposal")
r = c.post(f"/api/studio/context-records/{proposal['id']}/reject", json={"cipher_id": BOB})
ok(r.status_code == 404, "bob cannot reject alice's proposal")
r = c.post("/api/studio/context-records/sctx_nope/accept", json={"cipher_id": ALICE})
ok(r.status_code == 404, "an unknown record id is a 404, not a leak")

anon = TestClient(server.app)
anon.cookies.clear()
ok(anon.get("/api/studio/context-records",
            params={"cipher_id": ALICE}).status_code == 403,
   "an unauthenticated caller cannot read records at all")
ok(anon.get("/api/studio/context-preview",
            params={"cipher_id": ALICE}).status_code == 403,
   "an unauthenticated caller cannot preview an assembly")

print("\n── AI output is never auto-promoted ──")
preview = c.get("/api/studio/context-preview",
                params={"cipher_id": ALICE, "room": "work"}).json()
ok(preview["status"] == "grounded", "grounded assembly succeeds for alice")
classes = [rec["provenance_class"] for rec in preview["records"]]
ok("ai_proposal" not in classes, "an unaccepted ai_proposal never enters the assembly")
ok("ephemeral_operational" not in classes, "ephemeral operational scratch never enters")
ok(AI_TEXT not in json.dumps(preview["records"]), "the proposal's text is nowhere in the assembly")
ok(all(rec["acceptance_state"] == "accepted" for rec in preview["records"]),
   "every assembled record is explicitly accepted")

print("\n── sealed material is excluded ──")
ok(ALICE_SEALED not in json.dumps(preview), "sealed material never appears in an assembly")
ok(all(rec["visibility"] != "sealed" for rec in preview["records"]),
   "no sealed record is assembled")
ok(sealed["id"] not in [rec["id"] for rec in preview["records"]],
   "the sealed record id is absent from the assembly")

print("\n── acceptance derives a new record ──")
accepted = c.post(f"/api/studio/context-records/{proposal['id']}/accept",
                  json={"cipher_id": ALICE}).json()
ok(accepted["id"] != proposal["id"], "acceptance mints a new record rather than mutating")
ok(accepted["provenance_class"] == "accepted_personal_context",
   "verbatim acceptance yields accepted_personal_context")
ok(accepted["derived_from"] == proposal["id"], "the derived record cites its origin")
ok(accepted["acceptance_state"] == "accepted", "the derived record is accepted")
ok(bool(accepted["accepted_at"]), "acceptance is timestamped")

alice_now = {rec["id"]: rec for rec in
             c.get("/api/studio/context-records", params={"cipher_id": ALICE}).json()["records"]}
ok(alice_now[proposal["id"]]["provenance_class"] == "ai_proposal",
   "the proposal keeps its ai_proposal class forever — the untrusted origin stays on record")
ok(alice_now[proposal["id"]]["acceptance_state"] == "accepted",
   "the proposal is marked accepted so it is not offered again")

replay = c.post(f"/api/studio/context-records/{proposal['id']}/accept",
                json={"cipher_id": ALICE}).json()
ok(replay["id"] == accepted["id"], "re-accepting returns the record derived the first time")

edited_proposal = create(c, ALICE, provenance_class="ai_proposal", room="work",
                         gene_key=25, essence=AI_TEXT).json()
edited = c.post(f"/api/studio/context-records/{edited_proposal['id']}/accept",
                json={"cipher_id": ALICE, "essence": "alice reworded this"}).json()
ok(edited["provenance_class"] == "member_edited_synthesis",
   "accepting with edits yields member_edited_synthesis")
ok(edited["essence"] == "alice reworded this", "the member's edit is what is stored")

print("\n── rejection ──")
rejected_proposal = create(c, ALICE, provenance_class="ai_proposal",
                           room="work", essence=AI_TEXT).json()
rejected = c.post(f"/api/studio/context-records/{rejected_proposal['id']}/reject",
                  json={"cipher_id": ALICE}).json()
ok(rejected["acceptance_state"] == "rejected", "rejection is recorded")
again = c.post(f"/api/studio/context-records/{rejected_proposal['id']}/reject",
               json={"cipher_id": ALICE}).json()
ok(again["acceptance_state"] == "rejected", "rejecting twice is idempotent")
r = c.post(f"/api/studio/context-records/{rejected_proposal['id']}/accept",
           json={"cipher_id": ALICE})
ok(r.status_code == 422, "a rejected proposal cannot later be accepted")
r = c.post(f"/api/studio/context-records/{alice_authored['id']}/accept",
           json={"cipher_id": ALICE})
ok(r.status_code == 422, "only an ai_proposal needs — or permits — acceptance")
r = c.post(f"/api/studio/context-records/{alice_authored['id']}/reject",
           json={"cipher_id": ALICE})
ok(r.status_code == 422, "an already-accepted record cannot be rejected")

print("\n── groundable predicate ──")
ok(provenance.is_groundable("member_authored", "accepted", "private"), "accepted member text grounds")
ok(not provenance.is_groundable("ai_proposal", "accepted", "private"),
   "an ai_proposal never grounds even if somehow marked accepted")
ok(not provenance.is_groundable("ephemeral_operational", "accepted", "private"),
   "ephemeral operational scratch never grounds")
ok(not provenance.is_groundable("member_authored", "proposed", "private"),
   "unaccepted material never grounds")
ok(not provenance.is_groundable("member_authored", "accepted", "sealed"),
   "sealed material never grounds")
for klass in provenance.PROVENANCE_CLASSES:
    assert klass in provenance.GROUNDABLE_CLASSES or klass in ("ai_proposal", "ephemeral_operational")
ok(True, "every provenance class is explicitly groundable or explicitly not")

print("\n── trace is privacy safe ──")
preview = c.get("/api/studio/context-preview",
                params={"cipher_id": ALICE, "room": "work"}).json()
tr = preview["trace"]
ok(tr["status"] == "grounded", "the trace reports the assembly status")
ok(tr["source_version"].startswith("gkc1-"), "the trace names the canonical corpus version")
ok(len(tr["canonical_sources"]) >= 1, "the trace names the canonical sources used")
ok(all(src["source_id"].startswith("gk:") for src in tr["canonical_sources"]),
   "canonical sources are cited by id and checksum")
ok(tr["counts"]["records"] == len(preview["records"]), "the trace counts what was used")

blob = json.dumps(tr)
for secret in (ALICE_ESSENCE, ALICE_SEALED, BOB_ESSENCE, AI_TEXT, ALICE, BOB):
    ok(secret not in blob, f"the trace never carries '{secret}'")

t = trace.ContextTrace(mode="grounded_v1", room="work")
t.add_record({"id": "sctx_1", "provenance_class": "member_authored",
              "acceptance_state": "accepted", "visibility": "private",
              "essence": ALICE_ESSENCE, "reflection": ALICE_ESSENCE})
t.add_canonical(canonical.load_gene_key(25), bands=("shadow",))
red = json.dumps(t.redacted())
ok(ALICE_ESSENCE not in red, "redaction strips essence and reflection text")
ok("sctx_1" in red, "redaction keeps record ids for observability")
ok("gk:25@" in red, "redaction keeps canonical source ids")
nested = trace.redact({"outer": {"essence": "leak", "cipher_id": ALICE,
                                 "keep": [{"reflection": "leak", "id": "x"}]}})
ok("leak" not in json.dumps(nested), "redaction is recursive")
ok(nested["outer"]["keep"][0]["id"] == "x", "redaction keeps non-sensitive nested fields")

print("\n── canonical material comes from the corpus, not the client ──")
canon = preview["canonical"][0]
real = canonical.load_gene_key(canon["gene_key"])
ok(canon["title"] == real["title"], "assembled title matches the corpus exactly")
ok(canon["bands"]["shadow"]["content"] == real["bands"]["shadow"]["content"],
   "assembled band content matches the corpus byte for byte")
ok(canon["source_id"] == real["source_id"], "the assembly cites the corpus source id")

# A client pointing at a Gene Key its own records do not reference cannot widen
# its grounding scope.
widened = assembler.assemble(type("R", (), {"cookies": {}})(), cipher_id=ALICE,
                             room="work", gene_keys=[7], mode="grounded_v1")
ok(all(entry["gene_key"] != 7 for entry in widened["canonical"]),
   "a client cannot pull in a Gene Key none of its records reference")

print("\n── grounding failure is structured ──")
_real_load = canonical.load_gene_key
canonical.load_gene_key = lambda *a, **k: (_ for _ in ()).throw(
    canonical.CanonicalSourceError("canonical source missing: gk_25.json")
)
try:
    c.put("/api/admin/studio-context-failure-policy", json={"failure_policy": "fail_closed"})
    result = c.get("/api/studio/context-preview",
                   params={"cipher_id": ALICE, "room": "work"}).json()
    ok(result["status"] == "grounding_unavailable", "fail_closed returns grounding_unavailable")
    ok(result["grounded"] is False, "the result is explicitly not grounded")
    ok(result["canonical"] == [], "no canonical material is claimed")
    ok("gk_25.json" in result["reason"], "the reason names the missing source")
    ok(result["status"] != "grounded", "failure never reports itself as grounded")

    c.put("/api/admin/studio-context-failure-policy", json={"failure_policy": "fallback_legacy"})
    result = c.get("/api/studio/context-preview",
                   params={"cipher_id": ALICE, "room": "work"}).json()
    ok(result["status"] == "fallback_legacy", "fallback_legacy routes explicitly to legacy")
    ok(result["grounded"] is False, "a fallback is never reported as grounded")
    ok(bool(result["reason"]), "the fallback carries a reason")
finally:
    canonical.load_gene_key = _real_load
    c.put("/api/admin/studio-context-failure-policy", json={"failure_policy": "fail_closed"})

with server._admin_db() as conn:
    audited = {
        row["type"]
        for row in conn.execute(
            "SELECT DISTINCT type FROM events WHERE type LIKE 'studio_context%'"
        ).fetchall()
    }
ok("studio_context_grounding_unavailable" in audited, "a fail-closed grounding failure is audited")
ok("studio_context_grounding_fallback" in audited, "a legacy fallback is audited")
ok("studio_context_record_accepted" in audited, "acceptance is audited")
ok("studio_context_record_rejected" in audited, "rejection is audited")

with server._admin_db() as conn:
    details = " ".join(
        (row["detail"] or "")
        for row in conn.execute(
            "SELECT detail FROM events WHERE type LIKE 'studio_context%'"
        ).fetchall()
    )
for secret in (ALICE_ESSENCE, ALICE_SEALED, BOB_ESSENCE, AI_TEXT):
    ok(secret not in details, f"no audit event detail carries '{secret}'")

print("\n── legacy mode assembles nothing ──")
set_mode("legacy")
result = c.get("/api/studio/context-preview",
               params={"cipher_id": ALICE, "room": "work"}).json()
ok(result["status"] == "legacy", "legacy mode reports legacy")
ok(result["grounded"] is False, "legacy mode is not grounded")
ok(result["records"] == [] and result["canonical"] == [],
   "legacy mode performs no server-side assembly")
ok(ALICE_ESSENCE not in json.dumps(result), "legacy mode returns no member material")

print("\n── no data loss across a mode round trip ──")
before = c.get("/api/studio/context-records", params={"cipher_id": ALICE}).json()["records"]
for mode in ("grounded_v1", "legacy", "grounded_v1", "legacy"):
    set_mode(mode)
after = c.get("/api/studio/context-records", params={"cipher_id": ALICE}).json()["records"]
ok(len(after) == len(before), "record count survives switching modes both directions")
ok([rec["id"] for rec in after] == [rec["id"] for rec in before], "record ids are unchanged")
ok([rec["provenance_class"] for rec in after] == [rec["provenance_class"] for rec in before],
   "provenance classes are unchanged")
ok([rec["acceptance_state"] for rec in after] == [rec["acceptance_state"] for rec in before],
   "acceptance states are unchanged")

set_mode("grounded_v1")
regrounded = c.get("/api/studio/context-preview",
                   params={"cipher_id": ALICE, "room": "work"}).json()
ok(regrounded["status"] == "grounded", "grounding works again after a round trip")
ok(len(regrounded["records"]) >= 2, "the accepted records are still found after a round trip")
set_mode("legacy")

print("\n── legacy prompt building is untouched ──")
# The parity guarantee: nothing in the legacy generation path consults the
# context mode, so the prompts it builds must be identical in either mode.
point = server.PointData(raw="session notes", theme="a theme", summary="a summary",
                         insights=[{"title": "t", "body": "b"}], gk_num="25",
                         gk_line="3", observations="obs")
gen = server.GenerateRequest(companion="Someone", guide="Guide", point="work", work=point)

set_mode("legacy")
legacy_user = server.build_user_prompt(gen, ["work"])
legacy_section = server.build_point_section("work", point)
legacy_system = server.build_system_prompt(server.context_document, server.brand_reference)

set_mode("grounded_v1")
grounded_user = server.build_user_prompt(gen, ["work"])
grounded_section = server.build_point_section("work", point)
grounded_system = server.build_system_prompt(server.context_document, server.brand_reference)

ok(legacy_user == grounded_user, "build_user_prompt is byte-for-byte identical in both modes")
ok(legacy_section == grounded_section, "build_point_section is byte-for-byte identical")
ok(legacy_system == grounded_system, "build_system_prompt is byte-for-byte identical")
ok("session notes" in legacy_user, "the legacy prompt still carries the client's session notes")

set_mode("legacy")
ok(modes.current_mode() == "legacy", "suite leaves production behaviour on legacy")


def test_studio_context_records():
    """pytest entry point — the module body is the suite."""
    assert passed > 0


print(f"\n{passed} passed")
