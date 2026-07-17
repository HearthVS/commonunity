"""Regression tests for the CommonUnity brand-asset routes (/assets/brand/*).

Production check after PR #184 found that /assets/brand/primary-logo.svg served
200 while the newly added /assets/brand/primary-logo-transparent.svg returned
404: the bare StaticFiles mount did not resolve the new file on the deployment.
The transparent wordmark is what the beta threshold/hub loads, so a missing
route shows a broken logo. These tests pin every published brand asset to a
served route with the right media type, and lock the allowlist behavior.
"""
import os
import pathlib
import tempfile

# Env must be set before importing the server module (module-level config reads).
_TMP_DB = pathlib.Path(tempfile.mkdtemp()) / "test_admin.sqlite3"
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = str(_TMP_DB)
os.environ["ADMIN_ACCESS_CODE"] = "test-admin-code"
os.environ["ADMIN_COOKIE_SECRET"] = "test-cookie-secret"
os.environ["COMMONUNITY_BETA_CODE"] = "shared-beta-code"

import sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

import server

_client = TestClient(server.app)


def test_transparent_wordmark_is_served_with_svg_media_type():
    """The exact production route that regressed: it must be 200 + image/svg+xml,
    not 404, so the beta threshold/hub wordmark resolves."""
    res = _client.get("/assets/brand/primary-logo-transparent.svg")
    assert res.status_code == 200, res.text
    assert res.headers["content-type"].startswith("image/svg+xml")
    assert res.text.lstrip().startswith("<svg")
    # It is the transparent variant: no baked-in background plate rect.
    assert "<rect" not in res.text


@pytest.mark.parametrize("filename, media", [
    ("primary-logo.svg", "image/svg+xml"),
    ("primary-logo-light.svg", "image/svg+xml"),
    ("primary-logo-transparent.svg", "image/svg+xml"),
    ("mark.svg", "image/svg+xml"),
    ("mono-mark.svg", "image/svg+xml"),
    ("favicon.svg", "image/svg+xml"),
    ("compass-email-mark.png", "image/png"),
])
def test_all_allowlisted_brand_assets_serve(filename, media):
    res = _client.get(f"/assets/brand/{filename}")
    assert res.status_code == 200, f"{filename}: {res.status_code}"
    assert res.headers["content-type"].startswith(media), (
        f"{filename}: {res.headers['content-type']}"
    )


def test_unlisted_brand_path_is_not_served():
    """The allowlist must not expose arbitrary files (e.g. the internal README)."""
    assert _client.get("/assets/brand/README.md").status_code == 404
    assert _client.get("/assets/brand/does-not-exist.svg").status_code == 404


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
