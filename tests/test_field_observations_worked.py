"""Tests for Field Observations depth types — Slice 8 (durable Worked).

Covers:
  * the observation_type discriminator on field_observations: default
    'remembered', idempotent backfill of legacy rows, whitelist coercion;
  * durable persistence of returned Nexus work as observation_type 'worked'
    through the server-backed endpoint, isolated per member;
  * static guarantees on the studio.html Worked path: no browser storage
    (localStorage / sessionStorage / indexedDB / cookies), no automatic Nexus
    (/rose-mirror) call or submit, and Worked kept out of Remembered/Archive.

The repo has no test runner configured, so this file is written to run either
under pytest OR standalone:  `python3 tests/test_field_observations_worked.py`.
It sets a temp admin DB and a magic-link token BEFORE importing the server, so
it never touches real data and needs no network.
"""

import os
import pathlib
import re
import sqlite3
import tempfile

_ROOT = pathlib.Path(__file__).resolve().parent.parent
_TMPDIR = tempfile.mkdtemp(prefix="fo_worked_test_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = str(pathlib.Path(_TMPDIR) / "admin.sqlite3")
os.environ["COMMONUNITY_MAGIC_LINK_TOKENS"] = "testtok"

import sys
sys.path.insert(0, str(_ROOT))

import server  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

client = TestClient(server.app)
AUTH = "?invite=testtok"
STUDIO_HTML = (_ROOT / "studio.html").read_text(encoding="utf-8")


def _slice_between(text, start_marker, end_marker):
    i = text.index(start_marker)
    j = text.index(end_marker, i + len(start_marker))
    return text[i:j]


# ── Backend: observation_type discriminator ──────────────────────────────────

def test_default_observation_type_is_remembered():
    r = client.post(f"/api/studio/field-observations{AUTH}",
                    json={"body": "a held note", "cipher_id": "cid_default"})
    assert r.status_code == 200, r.text
    assert r.json()["observation_type"] == "remembered"


def test_worked_type_persists_and_is_listed():
    cid = "cid_worked"
    client.post(f"/api/studio/field-observations{AUTH}",
                json={"body": "a remembered note", "cipher_id": cid})
    client.post(f"/api/studio/field-observations{AUTH}",
                json={"body": "nexus reflection", "observation_type": "worked",
                      "source_label": "Nexus", "cipher_id": cid})
    obs = client.get(f"/api/studio/field-observations{AUTH}&cipher_id={cid}").json()["observations"]
    types = sorted(o["observation_type"] for o in obs)
    assert types == ["remembered", "worked"], types
    # The worked row is durable: a fresh GET (new request) still returns it.
    again = client.get(f"/api/studio/field-observations{AUTH}&cipher_id={cid}").json()["observations"]
    assert any(o["observation_type"] == "worked" and o["body"] == "nexus reflection" for o in again)


def test_unknown_type_is_coerced_to_remembered():
    r = client.post(f"/api/studio/field-observations{AUTH}",
                    json={"body": "x", "observation_type": "sneaky", "cipher_id": "cid_bogus"})
    assert r.status_code == 200
    assert r.json()["observation_type"] == "remembered"


def test_existing_delete_endpoint_removes_worked_row_only():
    """Slice 9: the existing member-scoped delete endpoint deletes a durable
    'worked' row by id and leaves the member's 'remembered' rows intact — no
    new route needed for releasing Worked material."""
    cid = "cid_release"
    client.post(f"/api/studio/field-observations{AUTH}",
                json={"body": "a remembered note", "cipher_id": cid})
    worked = client.post(f"/api/studio/field-observations{AUTH}",
                         json={"body": "returned nexus work", "observation_type": "worked",
                               "source_label": "Nexus", "cipher_id": cid}).json()
    worked_id = worked["id"]

    r = client.delete(f"/api/studio/field-observations/{worked_id}{AUTH}&cipher_id={cid}")
    assert r.status_code == 200, r.text

    remaining = client.get(f"/api/studio/field-observations{AUTH}&cipher_id={cid}").json()["observations"]
    # The worked row is gone; the remembered row is untouched.
    assert all(o["id"] != worked_id for o in remaining)
    assert [o["observation_type"] for o in remaining] == ["remembered"]


def test_endpoint_is_access_gated():
    # No invite token / cookie → forbidden, never world-writable.
    r = client.post("/api/studio/field-observations", json={"body": "x"})
    assert r.status_code == 403


def test_legacy_rows_backfilled_to_remembered():
    """A DB that predates the column gets observation_type added with existing
    rows defaulting to 'remembered' — no data migration, no broken rows."""
    legacy = pathlib.Path(tempfile.mkdtemp()) / "legacy.sqlite3"
    conn = sqlite3.connect(legacy)
    conn.execute(
        "CREATE TABLE field_observations (id TEXT PRIMARY KEY, cipher_id TEXT NOT NULL "
        "DEFAULT '', invite_token TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', "
        "body TEXT NOT NULL, source_label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, "
        "updated_at TEXT NOT NULL)"
    )
    conn.execute("INSERT INTO field_observations (id, body, created_at, updated_at) "
                 "VALUES ('old1', 'legacy', '2020-01-01', '2020-01-01')")
    conn.commit()
    conn.close()

    conn = sqlite3.connect(legacy)
    conn.row_factory = sqlite3.Row
    server._init_admin_db(conn)  # runs the idempotent migration
    cols = [r[1] for r in conn.execute("PRAGMA table_info(field_observations)").fetchall()]
    assert "observation_type" in cols
    row = conn.execute("SELECT observation_type FROM field_observations WHERE id='old1'").fetchone()
    assert row["observation_type"] == "remembered"
    # Idempotent: a second init must not raise or duplicate the column.
    server._init_admin_db(conn)
    cols2 = [r[1] for r in conn.execute("PRAGMA table_info(field_observations)").fetchall()]
    assert cols2.count("observation_type") == 1
    conn.close()


# ── Frontend static guarantees (studio.html Worked path) ─────────────────────

def test_worked_functions_use_no_browser_storage():
    block = _slice_between(STUDIO_HTML,
                           "function studioReturnWorkedToField",
                           "function studioBringSelectedTextToNexus")
    for banned in ("localStorage", "sessionStorage", "indexedDB", "document.cookie"):
        assert banned not in block, f"Worked path must not use browser storage: {banned}"


def test_worked_persistence_posts_worked_type_to_server():
    block = _slice_between(STUDIO_HTML,
                           "async function studioPersistWorkedObservation",
                           "function studioAllWorked")
    assert "/api/studio/field-observations" in block
    assert "observation_type: 'worked'" in block
    assert "method: 'POST'" in block


def test_return_to_field_path_has_no_automatic_nexus_call():
    for start, end in (("function studioReturnWorkedToField", "function studioPersistWorkedObservation"),
                       ("function studioMakeReturnToFieldBtn", "function appendMirrorMessage")):
        block = _slice_between(STUDIO_HTML, start, end)
        assert "rose-mirror" not in block, "Return path must not call /rose-mirror"
        assert ".submit(" not in block, "Return path must not auto-submit"


def test_worked_excluded_from_remembered_state():
    block = _slice_between(STUDIO_HTML,
                           "async function studioLoadFieldObservations",
                           "async function studioCreateFieldObservation")
    # Remembered state keeps only non-worked rows; worked rows go to their own bucket.
    assert "state.fieldObservations = all.filter(o => !isWorked(o))" in block
    assert "state.fieldObservationsWorkedServer = all.filter(isWorked)" in block


def _run_all():
    fns = [v for k, v in sorted(globals().items())
           if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"FAIL {fn.__name__}: {e}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            print(f"ERROR {fn.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if _run_all() else 0)
