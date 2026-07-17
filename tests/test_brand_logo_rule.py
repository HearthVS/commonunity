"""Regression tests for the permanent CommonUnity logo brand rule.

Canonical rule (see assets/brand/README.md, "The CommonUnity brand rule"):
the CommonUnity logo must always appear as transparent artwork resting directly
on the surrounding field. It must NEVER be placed inside or rendered with a
background plate, badge, card, colored container, border, shadow, rounded frame,
or any other enclosing treatment — whether baked into the SVG (a background
`<rect>`) or added in CSS (`background`, `border`, `box-shadow`,
`border-radius`, or a wrapping plate element).

PRs #184 / #185 fixed the beta threshold/hub, which had regressed to the framed
`primary-logo.svg` inside a bordered/shadowed CSS plate (the "navy badge" look).
These static checks make that regression, and equivalent ones on first-party
surfaces, fail in CI instead of shipping.
"""
import pathlib
import re

import pytest

_ROOT = pathlib.Path(__file__).resolve().parent.parent

TRANSPARENT_LOGO = _ROOT / "assets" / "brand" / "primary-logo-transparent.svg"
FRAMED_LOGO = _ROOT / "assets" / "brand" / "primary-logo.svg"
LIGHT_LOGO = _ROOT / "assets" / "brand" / "primary-logo-light.svg"
BRAND_README = _ROOT / "assets" / "brand" / "README.md"

# First-party product surfaces that render the wordmark and must obey the rule.
BETA_JS = _ROOT / "beta" / "beta.js"
BETA_CSS = _ROOT / "beta" / "beta.css"


def _read(path: pathlib.Path) -> str:
    assert path.exists(), f"expected file to exist: {path}"
    return path.read_text(encoding="utf-8")


# ── The canonical asset itself stays plate-free ──────────────────────────────

def test_transparent_logo_has_no_baked_in_background_plate():
    """The canonical UI asset must carry no background rect / opaque backdrop."""
    svg = _read(TRANSPARENT_LOGO)
    assert "<rect" not in svg, (
        "primary-logo-transparent.svg must not contain a <rect> — that would "
        "reintroduce a baked-in background plate."
    )
    # The framed variants use fill="#0b1120" as the plate; it must not appear here.
    assert "#0b1120" not in svg


def test_framed_variants_are_the_legacy_plate_bearing_assets():
    """Guards the two files from being swapped: the framed variants MUST keep
    their background rect so nothing silently turns primary-logo.svg into a
    second transparent asset (which would blur the canonical/legacy split)."""
    assert "<rect" in _read(FRAMED_LOGO), (
        "primary-logo.svg is the legacy plate-bearing variant and must keep its "
        "background <rect>; use primary-logo-transparent.svg for UI instead."
    )
    if LIGHT_LOGO.exists():
        assert "<rect" in _read(LIGHT_LOGO)


# ── First-party surfaces use the transparent asset, not the framed one ───────

def test_beta_surface_references_transparent_logo_only():
    js = _read(BETA_JS)
    assert "primary-logo-transparent.svg" in js, (
        "beta.js must load the transparent wordmark asset."
    )
    # No reference to the framed asset. Use a boundary so the substring
    # 'primary-logo.svg' does not match inside 'primary-logo-transparent.svg'.
    assert not re.search(r"primary-logo\.svg", js), (
        "beta.js must not reference the framed primary-logo.svg (it bakes in a "
        "background plate); use primary-logo-transparent.svg."
    )
    assert not re.search(r"primary-logo-light\.svg", js)


def _css_rule_body(css: str, selector: str) -> str:
    """Return the declaration body of the first rule whose selector is exactly
    `selector` (ignoring surrounding whitespace)."""
    pattern = re.compile(
        r"(^|[},/])\s*" + re.escape(selector) + r"\s*\{([^}]*)\}",
        re.MULTILINE,
    )
    match = pattern.search(css)
    assert match, f"could not find CSS rule for selector {selector!r}"
    return match.group(2)


@pytest.mark.parametrize("selector", [".beta-wordmark", ".beta-wordmark img"])
def test_beta_wordmark_css_has_no_frame(selector):
    """The wordmark container/img must not recreate a frame in CSS: no border,
    box-shadow, border-radius, or background plate."""
    body = _css_rule_body(_read(BETA_CSS), selector)
    forbidden = ("border", "box-shadow", "border-radius", "background")
    hits = [prop for prop in forbidden if re.search(rf"\b{prop}\b\s*:", body)]
    assert not hits, (
        f"{selector} must not frame the logo, but declares {hits}. The "
        f"CommonUnity logo rests directly on the field — no plate/border/"
        f"shadow/rounded frame. Rule body was:\n{body.strip()}"
    )


# ── The canonical rule is documented where the source of truth lives ─────────

def test_brand_readme_documents_the_rule():
    text = _read(BRAND_README)
    lowered = text.lower()
    assert "must not" in lowered, "brand README should state the MUST NOT rule."
    assert "primary-logo-transparent.svg" in text, (
        "brand README should name the canonical transparent asset."
    )
    for token in ("background plate", "badge", "border", "shadow"):
        assert token in lowered, (
            f"brand README rule should explicitly forbid a {token!r} treatment."
        )


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
