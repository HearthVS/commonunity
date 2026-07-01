"""Admin feed identity-resolution tests.

Guards the /api/admin/metrics events projection: participant identity in the
feed is resolved ONLY from admin-authored invite records, via two safe
linkages — the event's invite_id, or (for historical rows that carry a token
but no invite_id) the events.token -> invites.token match. Content is never
exposed; events.detail is never used for identity.

Runnable directly (`python3 tests/test_admin_feed.py`) or under pytest.
"""
import importlib.util
import os
import pathlib
import sqlite3
import sys
import tempfile

_TMP_DB = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_TMP_DB.close()
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = _TMP_DB.name

_REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT))  # so server.py can import om_cipher_engine
_spec = importlib.util.spec_from_file_location("srv_feed", _REPO_ROOT / "server.py")
srv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(srv)


def _fresh_conn():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    srv._init_admin_db(conn)
    return conn


def _feed(conn):
    """Run the same enriched query + projection the metrics endpoint uses."""
    rows = conn.execute(
        """
        SELECT
            e.id AS id, e.timestamp AS timestamp, e.type AS type,
            e.invite_id AS invite_id, e.token AS token, e.route AS route,
            e.source AS source, e.detail AS detail,
            COALESCE(bi.id, bt.id)       AS resolved_invite_id,
            COALESCE(bi.name, bt.name)   AS invite_name,
            COALESCE(bi.email, bt.email) AS invite_email,
            COALESCE(bi.token, bt.token) AS invite_full_token
        FROM events e
        LEFT JOIN invites bi ON e.invite_id = bi.id
        LEFT JOIN invites bt ON e.invite_id IS NULL AND e.token <> '' AND e.token = bt.token
        ORDER BY e.timestamp DESC, e.id DESC
        """
    ).fetchall()
    return [srv._admin_feed_row(r) for r in rows]


def run():
    import json
    conn = _fresh_conn()
    now = srv._now_iso()
    conn.execute(
        "INSERT INTO invites (token,name,email,created_at) VALUES (?,?,?,?)",
        ("tok_secret_123456", "Jane Doe", "jane@x.io", now),
    )
    iid = conn.execute("SELECT id FROM invites").fetchone()["id"]

    # (a) modern row: linked by invite_id (+ token)
    conn.execute(
        "INSERT INTO events (timestamp,type,invite_id,token,route,source,detail) VALUES (?,?,?,?,?,?,?)",
        (now, "threshold_started", iid, "tok_secret_123456", "/threshold", "threshold", ""),
    )
    # (b) HISTORICAL row: token present, invite_id NULL — previously anonymous
    conn.execute(
        "INSERT INTO events (timestamp,type,invite_id,token,route,source,detail) VALUES (?,?,?,?,?,?,?)",
        (now, "compass_entered", None, "tok_secret_123456", "/compass", "compass", ""),
    )
    # (c) env-token row: token has no matching invite -> must stay anonymous
    conn.execute(
        "INSERT INTO events (timestamp,type,invite_id,token,route,source,detail) VALUES (?,?,?,?,?,?,?)",
        (now, "env_invite_opened", None, "env-token-xyz", "/compass", "compass", ""),
    )
    conn.commit()

    feed = {row["type"]: row for row in _feed(conn)}
    serialized = json.dumps(_feed(conn))

    modern = feed["threshold_started"]
    assert modern["invite_name"] == "Jane Doe"
    assert modern["invite_email"] == "jane@x.io"
    assert modern["identity_source"] == "invite_record"
    assert modern["invite_id"] == iid
    assert modern["content_status"] == "private"

    # Retroactivity: historical token-only row now resolves identity.
    historical = feed["compass_entered"]
    assert historical["invite_name"] == "Jane Doe", "historical token-only row did not resolve identity"
    assert historical["identity_source"] == "invite_record"
    assert historical["invite_id"] == iid, "resolved invite_id should be surfaced for token-only rows"
    assert historical["content_status"] == "private"

    # Env-token row stays anonymous — no invite record matches its token.
    env = feed["env_invite_opened"]
    assert env["invite_name"] == "" and env["invite_email"] == ""
    assert env["identity_source"] == ""

    # Raw token never leaves the server in any form.
    assert "tok_secret_123456" not in serialized, "raw token leaked into feed"
    assert modern["token_masked"] == "tok_…3456"

    print("ALL_ADMIN_FEED_TESTS_PASSED")


def test_admin_feed_resolves_identity_by_invite_id_and_token():
    run()


if __name__ == "__main__":
    run()
