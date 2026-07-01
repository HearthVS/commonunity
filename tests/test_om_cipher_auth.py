"""Authorization tests for the OM Cipher full-record endpoint.

Regression guard for the fix that closed the unauthenticated
GET /api/om-cipher/{member_id} full-record disclosure. The full record carries
legal_name / birth_date / birth_time / full_record_json and must be admin-only;
the /public and /badge projection endpoints stay open by design and must never
leak those sensitive fields.

Runnable directly (`python3 tests/test_om_cipher_auth.py`) or under pytest.
"""
import importlib.util
import os
import pathlib
import sys
import tempfile

# Configure env BEFORE importing the app so the feature flag, admin secret, and
# an isolated DB path are all in place at import time.
_TMP_DB = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_TMP_DB.close()
os.environ["OM_CIPHER_ENABLED"] = "1"
os.environ["ADMIN_ACCESS_CODE"] = "test-admin-secret"
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = _TMP_DB.name

_REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT))  # so server.py can import om_cipher_engine
_spec = importlib.util.spec_from_file_location("srv_omauth", _REPO_ROOT / "server.py")
srv = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(srv)

from starlette.testclient import TestClient

MEMBER_ID = "test-member-uuid-0001"
SENSITIVE = ("legal_name", "birth_date", "birth_time", "full_record_json")


def _seed_record():
    """Persist a minimal-but-realistic 'shared' record with sensitive fields."""
    record = {
        "member_id": MEMBER_ID,
        "version": 1,
        "visibility_tier": "shared",
        "palette": {"primary": "#123456"},
        "om_cipher_seed": "seed-abc",
        "sigil_svg": "<svg/>",
        "input": {
            "legal_name": "Jane Q Public",
            "preferred_name": "Jane",
            "birth_date": "1990-01-02",
            "birth_time": "03:04",
        },
        "metadata": {
            "life_path": {"value": 7},
            "gk_primary": {"gate": 25, "line": 3, "label": "Innocence"},
            "sigil_points": 9,
        },
    }
    srv._om_save(record)


def _admin_cookies():
    value = srv._signed_cookie_value("open", "admin")
    assert value, "admin cookie signing returned empty — secret not configured"
    return {srv._ADMIN_COOKIE: value}


def run():
    _seed_record()
    client = TestClient(srv.app)

    # 1. Unauthenticated full-record GET must be rejected (401), not disclosed.
    r = client.get(f"/api/om-cipher/{MEMBER_ID}")
    assert r.status_code == 401, f"expected 401 unauth, got {r.status_code}: {r.text}"
    assert "legal_name" not in r.text, "sensitive field leaked in unauth response body"

    # 2. Authenticated admin full-record GET succeeds and returns the record.
    r = client.get(f"/api/om-cipher/{MEMBER_ID}", cookies=_admin_cookies())
    assert r.status_code == 200, f"expected 200 for admin, got {r.status_code}: {r.text}"
    body = r.json()
    assert body["ok"] is True
    assert body["om_cipher"]["input"]["legal_name"] == "Jane Q Public"

    # 3. Public projection stays open unauthenticated and omits sensitive fields.
    r = client.get(f"/api/om-cipher/{MEMBER_ID}/public")
    assert r.status_code == 200, f"public projection should be open, got {r.status_code}: {r.text}"
    public_text = r.text
    for field in SENSITIVE:
        assert field not in public_text, f"public projection leaked '{field}'"

    # 4. Badge projection stays open unauthenticated and omits sensitive fields.
    r = client.get(f"/api/om-cipher/{MEMBER_ID}/badge")
    assert r.status_code == 200, f"badge projection should be open, got {r.status_code}: {r.text}"
    badge_text = r.text
    for field in SENSITIVE:
        assert field not in badge_text, f"badge projection leaked '{field}'"

    print("ALL_OM_CIPHER_AUTH_TESTS_PASSED")


def test_om_cipher_full_record_requires_admin():
    run()


if __name__ == "__main__":
    run()
