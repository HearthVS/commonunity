"""Tests for the OM Cipher palette generation that stUdio anchors to.

Covers the deterministic hue derivation and the pinned, constrained OKLCH
role geometry (`life_path_hue` / `_build_palette` in om_cipher_engine.py) that
the stUdio "Colour" mapping reuses. The stUdio-side mapping/bounds are covered
by the DOM-free Node suite (test_studio_palette.js); this suite pins the
server-side source of truth the Node side extracts hues from.

Run with:  python -m unittest test_studio_palette -v
(stdlib unittest only — no new dependencies)
"""

import re
import unittest

from om_cipher_engine import life_path_hue, _build_palette, _MASTER_HUES

_OKLCH = re.compile(r"oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)")


def _parse(color):
    m = _OKLCH.match(color)
    assert m, f"not an oklch token: {color!r}"
    return float(m.group(1)), float(m.group(2)), float(m.group(3))


class LifePathHueTests(unittest.TestCase):
    def test_deterministic(self):
        for lp in [None, 1, 5, 7, 9, 11, 22, 33, 40]:
            self.assertEqual(life_path_hue(lp), life_path_hue(lp))

    def test_master_numbers_pinned(self):
        for lp, hue in _MASTER_HUES.items():
            self.assertEqual(life_path_hue(lp), hue)

    def test_hue_always_in_range(self):
        for lp in range(0, 100):
            h = life_path_hue(lp)
            self.assertGreaterEqual(h, 0)
            self.assertLess(h, 360)


class BuildPaletteTests(unittest.TestCase):
    def test_deterministic(self):
        a = _build_palette(7, 3, 14, 200)
        b = _build_palette(7, 3, 14, 200)
        self.assertEqual(a, b)

    def test_primary_lightness_is_pinned_and_not_dark(self):
        # Every family shares one mid lightness so the palette tints rather than
        # collapsing to a dark wash — the invariant the stUdio mapping relies on.
        for lp in [None, 1, 5, 7, 11, 22, 33]:
            pal = _build_palette(lp, None, None, None)
            for token in pal["palette"]:
                lit, chroma, _hue = _parse(token)
                self.assertAlmostEqual(lit, 0.55, places=2)
                self.assertGreater(chroma, 0.0)
                self.assertLessEqual(chroma, 0.227)

    def test_primary_hue_matches_life_path(self):
        pal = _build_palette(7, None, None, None)
        _lit, _c, hue = _parse(pal["palette"][0])
        self.assertEqual(int(hue), life_path_hue(7))

    def test_secondary_is_complement(self):
        pal = _build_palette(5, None, None, None)
        self.assertEqual(pal["secondary_hue"], (pal["primary_hue"] + 180) % 360)


if __name__ == "__main__":
    unittest.main()
