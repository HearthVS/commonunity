"""
Om Cipher v1 — canonical Compass-sealed identity engine (Python side).

Pure, deterministic, no external dependencies beyond `hashlib`. Mirrors the
JS engine in `sdk/om_cipher.js`. Stand-alone module: importable and
independently testable; never imports back into existing generation paths.

Reference: docs/product/om-cipher-v1-implementation-plan.md

Canonical derivation (engine-first):
  Layer 1  Life Path = reduce(day) + reduce(month) + reduce(year), then
           reduce preserving master numbers 11/22/33. Expression /
           Soul Urge / Personality from Pythagorean gematria of
           legal_name (reduced to single digit; master preservation
           applies to Life Path only).
  Layer 2  Temporal — lunar phase (synodic approx; baseline 2000-01-06,
           29.53059), solar quarter by month (0 winter Dec–Feb,
           1 spring Mar–May, 2 summer Jun–Aug, 3 autumn Sep–Nov),
           temporal gate hour//2 (null if no birth_time).
  Layer 3  Gene Keys gate/line read from sealed Compass input. V1
           does not compute Gene Keys internally; pre-resolved
           activation lines are surfaced from a static 4x6 table.
  Layer 4  Canonical seed string
           `LP:..|EX:..|SU:..|PE:..|LUN:..|SOL:..|TG:..`
           (TG omitted when birth_time is null). SHA-256 of that
           string is the 64-char om_cipher_seed.
  Layer 5  Sigil scaffold: 11 points if birth_time, else 9.
  Layer 6  Palette — primary hue from Life Path (22→72, 11→36,
           33→108; else lp × 40 mod 360); lunar phase modulates
           saturation; secondary hue is the complement.

Bhramari:
  - Optional measured input. Missing baseline never blocks generation.
  - Sealed alongside identity, but excluded from the canonical seed so
    identical identity records hash identically regardless of whether
    the member hummed.
  - Subsequent captures are append-only refinement events (see
    `append_resonance_event`); they never alter seed or input_hash.

Privacy:
  - `generate()` returns the *internal* record (full sealed inputs +
    metadata). Always pass through `to_public_projection()` before
    surfacing on cOMmons / Field.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional


# ── Feature flags ────────────────────────────────────────────────────────

def is_enabled(override: Optional[bool] = None) -> bool:
    if override is True or override is False:
        return override
    val = os.environ.get("OM_CIPHER_ENABLED", "").lower()
    return val in ("1", "true", "yes", "on")


def is_bhramari_enabled(override: Optional[bool] = None) -> bool:
    if override is True or override is False:
        return override
    val = os.environ.get("BHRAMARI_CAPTURE_ENABLED", "").lower()
    return val in ("1", "true", "yes", "on")


# ── Reductions ──────────────────────────────────────────────────────────

def _digital_root_keep_master(n: int) -> int:
    x = abs(int(n or 0))
    while x > 9 and x not in (11, 22, 33):
        x = sum(int(d) for d in str(x))
    return x


def _digital_root(n: int) -> int:
    x = abs(int(n or 0))
    while x >= 10:
        x = sum(int(d) for d in str(x))
    return x


def birth_root(iso_date: Optional[str]) -> Optional[dict]:
    """Pure digit-sum reduction of the ISO date (master-preserving).

    Retained for compatibility. Not the canonical Life Path — see
    `life_path()` for the v1 reduction.
    """
    if not iso_date:
        return None
    digits = re.sub(r"\D", "", str(iso_date))
    if not digits:
        return None
    raw = sum(int(d) for d in digits)
    return {"raw": raw, "reduced": _digital_root_keep_master(raw)}


def life_path(iso_date: Optional[str]) -> Optional[dict]:
    """Canonical Life Path: reduce day, month, year individually (keeping
    masters), sum, then reduce once more (keeping masters)."""
    if not iso_date:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(iso_date))
    if not m:
        return None
    year = int(m[1])
    month = int(m[2])
    day = int(m[3])
    r_day = _digital_root_keep_master(day)
    r_month = _digital_root_keep_master(month)
    r_year = _digital_root_keep_master(year)
    raw = r_day + r_month + r_year
    return {
        "day": r_day,
        "month": r_month,
        "year": r_year,
        "raw": raw,
        "reduced": _digital_root_keep_master(raw),
    }


# ── Gematria ────────────────────────────────────────────────────────────

_PYTHAGOREAN = {chr(ord("A") + i): ((i % 9) + 1) for i in range(26)}
_VOWELS = set("AEIOU")


def _normalise_name(name: str) -> str:
    s = unicodedata.normalize("NFC", str(name or "")).upper()
    return re.sub(r"[^A-Z]", "", s)


def _gematria_sum(name: str, vowels_only: Optional[bool] = None) -> Optional[dict]:
    cleaned = _normalise_name(name)
    if not cleaned:
        return None
    total = 0
    for ch in cleaned:
        if vowels_only is True and ch not in _VOWELS:
            continue
        if vowels_only is False and ch in _VOWELS:
            continue
        total += _PYTHAGOREAN.get(ch, 0)
    if total == 0:
        return None
    # Expression/SU/PE always reduce to a single digit — master numbers
    # are preserved only for Life Path.
    return {"raw": total, "reduced": _digital_root(total)}


def name_resonance(legal_name: Optional[str]) -> Optional[dict]:
    if not legal_name:
        return None
    return {
        "expression":  _gematria_sum(legal_name),
        "soul_urge":   _gematria_sum(legal_name, vowels_only=True),
        "personality": _gematria_sum(legal_name, vowels_only=False),
    }


# ── Gene Keys / I Ching ─────────────────────────────────────────────────

# Activation Sequence sphere → canonical line names. `lens` = Evolution,
# `field` = Radiance — these are sphere-specific labels, not interchangeable.
_GK_LINE_NAMES = {
    "work":  {1:"Creator",2:"Dancer",3:"Changer",4:"Server",5:"Fixer",6:"Teacher"},
    "lens":  {1:"Self & Empowerment",2:"Passion & Relationships",3:"Energy & Experience",
              4:"Love & Community",5:"Power & Projection",6:"Education & Surrender"},
    "field": {1:"Solitude",2:"Marriage",3:"Interaction",4:"Friendship",5:"Impact",6:"Nurture"},
    "call":  {1:"Physicality",2:"Posture",3:"Movement",4:"Breath",5:"Voice",6:"Intent"},
}


def _parse_gate(raw_num: Any, raw_line: Any) -> Optional[dict]:
    try:
        num = int(re.sub(r"[^\d]", "", str(raw_num or "")))
    except ValueError:
        return None
    if not (1 <= num <= 64):
        return None
    try:
        line = int(re.sub(r"[^\d]", "", str(raw_line or "")))
    except ValueError:
        line = None
    if line is not None and not (1 <= line <= 6):
        line = None
    return {"gate": num, "line": line}


def gk_layer(compass: Optional[dict]) -> Optional[dict]:
    if not compass:
        return None
    out = {}
    for slot in ("work", "lens", "field", "call"):
        p = compass.get(slot)
        if not p:
            continue
        g = _parse_gate(p.get("gk_num"), p.get("gk_line"))
        if not g:
            continue
        out[slot] = {
            "gate": g["gate"],
            "line": g["line"],
            "label": _GK_LINE_NAMES[slot].get(g["line"]) if g["line"] else None,
        }
    return out or None


# ── Temporal resonance ──────────────────────────────────────────────────

def _solar_quarter(mo: int) -> int:
    if mo in (12, 1, 2):
        return 0
    if 3 <= mo <= 5:
        return 1
    if 6 <= mo <= 8:
        return 2
    return 3


def _lunar_phase(y: int, mo: int, d: int) -> int:
    if mo <= 2:
        Y, M = y - 1, mo + 12
    else:
        Y, M = y, mo
    A = Y // 100
    B = 2 - A + (A // 4)
    JD = int(365.25 * (Y + 4716)) + int(30.6001 * (M + 1)) + d + B - 1524.5
    synodic = 29.53059
    ref_jd = 2451550.1  # 2000-01-06
    phase = ((JD - ref_jd) % synodic + synodic) % synodic
    return int((phase / synodic) * 8) % 8


def temporal_layer(iso_date: Optional[str], hhmm: Optional[str]) -> Optional[dict]:
    if not iso_date:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(iso_date))
    if not m:
        return None
    y, mo, d = int(m[1]), int(m[2]), int(m[3])
    try:
        dt = datetime(y, mo, d, tzinfo=timezone.utc)
    except ValueError:
        return None
    # Align dow to JS Sun=0 convention.
    dow = (dt.weekday() + 1) % 7
    temporal_gate = None
    if hhmm:
        t = re.match(r"^(\d{1,2}):(\d{2})", str(hhmm))
        if t:
            hh = max(0, min(23, int(t[1])))
            temporal_gate = hh // 2
    return {
        "day_of_week": dow,
        "solar_quarter": _solar_quarter(mo),
        "lunar_phase": _lunar_phase(y, mo, d),
        "temporal_gate": temporal_gate,
    }


# ── Bhramari helpers ────────────────────────────────────────────────────

_NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]


def hz_to_semitone(hz: Optional[float]) -> Optional[dict]:
    if not hz or hz <= 0:
        return None
    midi = 69 + 12 * math.log2(hz / 440)
    rounded = round(midi)
    return {
        "note": _NOTES[((rounded % 12) + 12) % 12],
        "octave": (rounded // 12) - 1,
        "midi": rounded,
    }


def hz_to_visible_hue_deg(hz: Optional[float]) -> Optional[int]:
    if not hz or hz <= 0:
        return None
    f = hz
    while f < 440:
        f *= 2
    while f >= 880:
        f /= 2
    return round((f - 440) / (880 - 440) * 360) % 360


def round_hz(hz: Optional[float]) -> Optional[float]:
    if not hz or hz <= 0:
        return None
    return round(hz * 10) / 10


# ── Palette ─────────────────────────────────────────────────────────────

_MASTER_HUES = {11: 36, 22: 72, 33: 108}


def life_path_hue(lp: Optional[int]) -> int:
    if lp is None:
        return 0
    if lp in _MASTER_HUES:
        return _MASTER_HUES[lp]
    return (lp * 40) % 360


def _build_palette(lp: Optional[int],
                   lunar_phase: Optional[int],
                   primary_gate: Optional[int],
                   bhramari_hue_deg: Optional[int]) -> dict:
    base_hue = life_path_hue(lp)
    _ = lunar_phase  # preserved upstream; primary OKLCH is pinned.
    # OKLCH primary is pinned to `oklch(0.55 0.227 <hue>)` so the canonical
    # colour matches the v1 spec exactly for every life-path family.
    chroma = 0.227
    lit = 0.55
    primary = f"oklch({lit:.2f} {chroma:.3f} {base_hue})"
    secondary = f"oklch({lit:.2f} {chroma:.3f} {(base_hue + 180) % 360})"
    gate_offset = (primary_gate * 7) % 360 if primary_gate else 30
    accent = f"oklch({lit:.2f} {(chroma * 0.9):.3f} {(base_hue + gate_offset) % 360})"
    out = {
        "primary_hue": base_hue,
        "secondary_hue": (base_hue + 180) % 360,
        "palette": [primary, secondary, accent],
    }
    if isinstance(bhramari_hue_deg, int):
        blended = round(base_hue * 0.9 + bhramari_hue_deg * 0.1) % 360
        out["palette_resonance_accent"] = f"oklch({lit:.2f} {chroma:.3f} {blended})"
    return out


# ── Canonical seed string + SHA-256 ────────────────────────────────────

_CANONICAL_SEED_ORDER = ["LP", "EX", "SU", "PE", "LUN", "SOL", "TG", "BHR"]


def _canonical(parts: dict) -> str:
    return "|".join(f"{k}:{parts[k]}" for k in _CANONICAL_SEED_ORDER if parts.get(k) is not None)


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# Stable JSON of identity inputs for input_hash.
def _canonical_input_json(payload: dict) -> str:
    bp = payload.get("birth_place") or {}
    obj = {
        "birth_date": payload.get("birth_date") or None,
        "birth_time": payload.get("birth_time") or None,
        "birth_place": {
            "lat": float(bp.get("lat")) if bp.get("lat") is not None else None,
            "lng": float(bp.get("lng")) if bp.get("lng") is not None else None,
            "city": bp.get("city") or None,
            "country": bp.get("country") or None,
        } if bp else None,
        "legal_name": unicodedata.normalize("NFC", payload.get("legal_name")) if payload.get("legal_name") else None,
        "preferred_name": unicodedata.normalize("NFC", payload.get("preferred_name")) if payload.get("preferred_name") else None,
    }
    return json.dumps(obj, sort_keys=True, separators=(",", ":"))


# ── Sigil ───────────────────────────────────────────────────────────────

def _seeded_random_float(seed_hex: str, i: int) -> float:
    salt = _sha256(f"{seed_hex or ''}:{i}")
    n = int(salt[:8], 16)
    return n / 0xffffffff


def _build_sigil_svg(point_count: int, seed_hex: str, palette: dict) -> str:
    # Member-unique radial yantra: N points at seed-derived (angle, radius),
    # straight spokes from centre + irregular polygon ring across the
    # sorted points + small centre node. No regular polygon.
    n = 11 if point_count == 11 else 9
    cx, cy = 256, 256
    RENDER_R = 220

    raw = []
    for i in range(n):
        angle = _seeded_random_float(seed_hex, i) * math.pi * 2
        radius = 0.65 + _seeded_random_float(seed_hex, i + 100) * 0.25
        raw.append((angle, radius))
    raw.sort(key=lambda p: p[0])
    xy = [(round(cx + RENDER_R * r_ * math.cos(a_), 3),
           round(cy + RENDER_R * r_ * math.sin(a_), 3))
          for (a_, r_) in raw]

    primary = (palette or {}).get("palette", ["oklch(0.55 0.227 72)"])[0]
    primary_hue = (palette or {}).get("primary_hue", 72)

    spokes = "".join(
        f'<line x1="{cx}" y1="{cy}" x2="{x}" y2="{y}" '
        f'stroke="{primary}" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>'
        for (x, y) in xy
    )
    ring_d = " ".join(
        ("M" if i == 0 else "L") + str(x) + "," + str(y)
        for i, (x, y) in enumerate(xy)
    ) + " Z"
    ring = (
        f'<path d="{ring_d}" fill="none" stroke="{primary}" '
        f'stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="1"/>'
    )
    center = f'<circle cx="{cx}" cy="{cy}" r="5" fill="{primary}"/>'

    glow_color = f"oklch(0.55 0.227 {primary_hue} / 0.35)"
    filter_def = (
        '<defs><filter id="cu-sigil-glow" x="-20%" y="-20%" width="140%" height="140%">'
        '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>'
        '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
        '</filter></defs>'
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
        'width="512" height="512" class="cu-om-cipher-sigil-svg" '
        f'style="filter:drop-shadow(0 0 8px {glow_color})">'
        + filter_def
        + '<g filter="url(#cu-sigil-glow)">'
        + spokes + ring + center
        + '</g></svg>'
    )


# ── Static label tables (short, original; no copyrighted text) ──────────

NUMEROLOGY_LABELS = {
    1:  "Initiator — independence, beginnings",
    2:  "Mediator — partnership, balance",
    3:  "Expresser — creativity, communication",
    4:  "Builder — structure, foundation",
    5:  "Voyager — change, freedom",
    6:  "Nurturer — service, harmony",
    7:  "Seeker — introspection, study",
    8:  "Manifestor — power, mastery",
    9:  "Completer — release, compassion",
    11: "Illuminator — intuition, vision",
    22: "Master Builder — material vision realized",
    33: "Master Teacher — devotion, healing",
}

LUNAR_PHASE_LABELS = {
    0: "New Moon — seed",
    1: "Waxing Crescent — intention",
    2: "First Quarter — decision",
    3: "Waxing Gibbous — refine",
    4: "Full Moon — illumination",
    5: "Waning Gibbous — share",
    6: "Last Quarter — release",
    7: "Waning Crescent — rest",
}

SOLAR_QUARTER_LABELS = {
    0: "Winter — incubation",
    1: "Spring — emergence",
    2: "Summer — fullness",
    3: "Autumn — harvest",
}


# ── Temporal phrase lookup (Solar Quarter × Lunar Phase) ────────────────
TEMPORAL_PHRASES = {
    "0_0": "of the Winter Seed",
    "0_1": "of the Winter Quickening",
    "0_2": "of the Winter Threshold",
    "0_3": "of the Winter Forging",
    "0_4": "of the Winter Lantern",
    "0_5": "of the Winter Hearth",
    "0_6": "of the Winter Release",
    "0_7": "of the Winter Stillness",
    "1_0": "of the Spring Awakening",
    "1_1": "of the Spring Rising",
    "1_2": "of the Spring Threshold",
    "1_3": "of the Spring Tending",
    "1_4": "of the Spring Bloom",
    "1_5": "of the Spring Offering",
    "1_6": "of the Spring Release",
    "1_7": "of the Spring Quiet",
    "2_0": "of the Summer Spark",
    "2_1": "of the Summer Tending",
    "2_2": "of the Summer Crossing",
    "2_3": "of the Summer Ripening",
    "2_4": "of the Summer Crown",
    "2_5": "of the Summer Harvest",
    "2_6": "of the Summer Release",
    "2_7": "of the Summer Long Light",
    "3_0": "of the Autumn Seed",
    "3_1": "of the Autumn Turning",
    "3_2": "of the Autumn Threshold",
    "3_3": "of the Autumn Gathering",
    "3_4": "of the Autumn Harvest",
    "3_5": "of the Autumn Offering",
    "3_6": "of the Autumn Gate",
    "3_7": "of the Autumn Rest",
}


def temporal_phrase(solar_quarter: Optional[int],
                    lunar_phase: Optional[int]) -> Optional[str]:
    if solar_quarter is None or lunar_phase is None:
        return None
    return TEMPORAL_PHRASES.get(f"{solar_quarter}_{lunar_phase}")


def derive_cipher_name(preferred_name: Optional[str],
                       solar_quarter: Optional[int],
                       lunar_phase: Optional[int]) -> Optional[str]:
    if not preferred_name:
        return None
    parts = str(preferred_name).strip().split()
    if not parts:
        return None
    who = parts[0]
    phrase = temporal_phrase(solar_quarter, lunar_phase)
    return f"{who} {phrase}" if phrase else who


# ── Emergent Cipher Name (om-cipher-name-generator.md) ─────────────────
# The cipher name emerges from sealed cipher layers, not the birth name:
#   Part 1 — Gate Phoneme    (dominant I Ching gate / Life Work)
#   Part 2 — Seed Syllable   (HD authority / dominant center)
#   Part 3 — Line Resonance  (Life Work profile line)
# See `sdk/om_cipher.js` for the canonical JS implementation; this is the
# Python parity port so server-side renders match the browser engine.

GATE_PHONEME_TABLE = {
    1: "AH",  2: "HU",  3: "MA",  4: "MI",  5: "MU",  6: "ME",  7: "MO",  8: "HA",
    9: "KA", 10: "KI", 11: "KU", 12: "KE", 13: "KO", 14: "MA", 15: "GA", 16: "GI",
    17: "NA",18: "NI",19: "NU", 20: "NE", 21: "NO", 22: "LA", 23: "LI", 24: "LU",
    25: "SA",26: "SI",27: "SU", 28: "SE", 29: "SO", 30: "ZA", 31: "ZI", 32: "ZU",
    33: "RA",34: "RI",35: "RU", 36: "RE", 37: "RO", 38: "DA", 39: "DI", 40: "DU",
    41: "VA",42: "VI",43: "VU", 44: "VE", 45: "VO", 46: "BA", 47: "BI", 48: "BU",
    49: "TA",50: "TI",51: "TU", 52: "TE", 53: "TO", 54: "THA",55: "THI",56: "THU",
    57: "THE",58:"THO",59: "OMA",60: "OMI",61: "OMU",62: "OME",63: "OMO",64: "AHA",
}

GATE_TITLES = {
    1: "The Creative", 2: "The Receptive", 3: "Difficulty at the Beginning",
    4: "Youthful Folly", 5: "Waiting", 6: "Conflict", 7: "The Army",
    8: "Holding Together", 9: "The Taming Power of the Small", 10: "Treading",
    11: "Peace", 12: "Standstill", 13: "Fellowship",
    14: "Possession in Great Measure", 15: "Modesty", 16: "Enthusiasm",
    17: "Following", 18: "Work on the Decayed", 19: "Approach",
    20: "Contemplation", 21: "Biting Through", 22: "Grace",
    23: "Splitting Apart", 24: "Return", 25: "Innocence",
    26: "The Taming Power of the Great", 27: "The Corners of the Mouth",
    28: "Preponderance of the Great", 29: "The Abysmal", 30: "The Clinging",
    31: "Influence", 32: "Duration", 33: "Retreat",
    34: "The Power of the Great", 35: "Progress",
    36: "Darkening of the Light", 37: "The Family", 38: "Opposition",
    39: "Obstruction", 40: "Deliverance", 41: "Decrease", 42: "Increase",
    43: "Breakthrough", 44: "Coming to Meet", 45: "Gathering Together",
    46: "Pushing Upward", 47: "Oppression", 48: "The Well",
    49: "Revolution", 50: "The Cauldron", 51: "The Arousing",
    52: "Keeping Still", 53: "Development", 54: "The Marrying Maiden",
    55: "Abundance", 56: "The Wanderer", 57: "The Gentle", 58: "The Joyous",
    59: "Dispersion", 60: "Limitation", 61: "Inner Truth",
    62: "Preponderance of the Small", 63: "After Completion",
    64: "Before Completion",
}

# Order matters: rows are matched top-down against the normalised label
# so `Emotional · Solar Plexus` matches Emotional before Sacral/Splenic.
AUTHORITY_SEED_FRAGMENT_TABLE = [
    {"match": ["root"],                          "seed": "LAM", "fragment": "LA", "label": "Root authority — LAM seed"},
    {"match": ["emotional", "solar plexus"],     "seed": "VAM", "fragment": "VA", "label": "Emotional Solar Plexus authority — VAM seed"},
    {"match": ["sacral"],                        "seed": "VAM", "fragment": "VA", "label": "Sacral authority — VAM seed"},
    {"match": ["splenic", "spleen"],             "seed": "RAM", "fragment": "RA", "label": "Splenic authority — RAM seed"},
    {"match": ["heart", "ego"],                  "seed": "YAM", "fragment": "YA", "label": "Heart/Ego authority — YAM seed"},
    {"match": ["self", "g-center", "g center", "g/center"], "seed": "HAM", "fragment": "HA", "label": "Self/G-Center authority — HAM seed"},
    {"match": ["throat"],                        "seed": "HAM", "fragment": "HA", "label": "Throat authority — HAM seed"},
    {"match": ["mental", "head", "ajna"],        "seed": "AUM", "fragment": "AU", "label": "Mental authority — AUM seed"},
    {"match": ["lunar", "none", "no authority", "reflector"], "seed": "OM",  "fragment": "O",  "label": "Lunar (no authority) — OM seed"},
]


def _norm_authority(label: Optional[str]) -> str:
    if not label:
        return ""
    s = str(label).lower()
    for ch in "·/_,.-":
        s = s.replace(ch, " ")
    return " ".join(s.split())


def authority_seed(authority_label: Optional[str]) -> dict:
    norm = _norm_authority(authority_label)
    if norm:
        for row in AUTHORITY_SEED_FRAGMENT_TABLE:
            for tok in row["match"]:
                if tok in norm:
                    return row
    # Fallback to lunar/OM (last entry).
    return AUTHORITY_SEED_FRAGMENT_TABLE[-1]


LINE_RESONANCE_TABLE = {
    1: {"syllable": "KI", "archetype": "Investigator", "quality": "Foundation, inward, research"},
    2: {"syllable": "RA", "archetype": "Hermit",       "quality": "Solar, natural talent, called out"},
    3: {"syllable": "TE", "archetype": "Martyr",       "quality": "Trial, experiential, resilient"},
    4: {"syllable": "SO", "archetype": "Opportunist",  "quality": "Social, network, external"},
    5: {"syllable": "LU", "archetype": "Heretic",      "quality": "Universal, projected, field"},
    6: {"syllable": "OM", "archetype": "Role Model",   "quality": "Transcendent, exemplar, witness"},
}

_PRON_MAP = {
    "AH": "AH",  "HU": "HOO", "MA": "MAH", "MI": "MEE", "MU": "MOO", "ME": "MAY",
    "MO": "MOH", "HA": "HAH", "KA": "KAH", "KI": "KEE", "KU": "KOO", "KE": "KAY",
    "KO": "KOH", "GA": "GAH", "GI": "GHEE","NA": "NAH", "NI": "NEE", "NU": "NOO",
    "NE": "NAY", "NO": "NOH", "LA": "LAH", "LI": "LEE", "LU": "LOO", "SA": "SAH",
    "SI": "SEE", "SU": "SOO", "SE": "SAY", "SO": "SOH", "ZA": "ZAH", "ZI": "ZEE",
    "ZU": "ZOO", "RA": "RAH", "RI": "REE", "RU": "ROO", "RE": "RAY", "RO": "ROH",
    "DA": "DAH", "DI": "DEE", "DU": "DOO", "VA": "VAH", "VI": "VEE", "VU": "VOO",
    "VE": "VAY", "VO": "VOH", "BA": "BAH", "BI": "BEE", "BU": "BOO", "TA": "TAH",
    "TI": "TEE", "TU": "TOO", "TE": "TAY", "TO": "TOH", "THA":"TAH","THI":"TEE",
    "THU":"TOO","THE":"TAY", "THO":"TOH", "OMA":"OH-MAH","OMI":"OH-MEE",
    "OMU":"OH-MOO","OME":"OH-MAY","OMO":"OH-MOH","AHA":"AH-HAH",
    "YA": "YAH", "AU": "OW",  "O":  "OH",  "OM": "OHM",
}

_VOWEL_SET = set("AEIOU")


def _starts_with_vowel(s: str) -> bool:
    return bool(s) and s[0].upper() in _VOWEL_SET


def _leading_vowels(s: str) -> str:
    i = 0
    while i < len(s) and s[i].upper() in _VOWEL_SET:
        i += 1
    return s[:i].upper()


def _join_with_collision(a: str, b: str) -> str:
    """Drop Part 2's leading vowel cluster when Part 1's last char is the
    same vowel — `VA + AH → VAH`; `AHA + AU → AHA`."""
    if not a:
        return b or ""
    if not b:
        return a
    a_last = a[-1].upper()
    if a_last in _VOWEL_SET and _starts_with_vowel(b):
        b_head = _leading_vowels(b)
        if b_head and b_head[0] == a_last:
            return a + b[len(b_head):]
    return a + b


def generate_cipher_name(gate: Optional[int],
                         authority: Optional[str],
                         line: Optional[int]) -> Optional[dict]:
    try:
        g = int(gate) if gate is not None else None
    except (TypeError, ValueError):
        g = None
    try:
        l = int(line) if line is not None else None
    except (TypeError, ValueError):
        l = None
    part1 = GATE_PHONEME_TABLE.get(g) if g is not None else None
    seed_row = authority_seed(authority)
    part2 = seed_row.get("fragment") if seed_row else None
    line_row = LINE_RESONANCE_TABLE.get(l) if l is not None else None
    part3 = line_row.get("syllable") if line_row else None
    if not (part1 and part2 and part3):
        return None
    joined_ab = _join_with_collision(part1, part2)
    name = _join_with_collision(joined_ab, part3)
    syllables = [part1, part2, part3]
    pronunciation = "-".join(_PRON_MAP.get(s, s.upper()) for s in syllables)
    return {
        "name": name,
        "display_name": "·".join(syllables),
        "syllables": syllables,
        "etymology": {
            "part_1": {
                "source": f"Gate {g} — {GATE_TITLES.get(g, '')}".rstrip(" —"),
                "phoneme": part1,
            },
            "part_2": {
                "source": seed_row.get("label"),
                "fragment": part2,
            },
            "part_3": {
                "source": f"Line {l} — {line_row['archetype']} / {line_row['quality']}",
                "syllable": part3,
            },
        },
        "pronunciation": pronunciation,
    }


# ── Layer 6 — Contemplative outputs ─────────────────────────────────────

def _load_layer6_assets() -> dict:
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "data", "om_cipher")
    out = {"MANTRA_TABLE": None, "ARCHETYPAL_STORIES": None, "CONTEMPLATIONS": None}
    for key, fname in (
        ("MANTRA_TABLE", "mantra_table.json"),
        ("ARCHETYPAL_STORIES", "archetypal_stories.json"),
        ("CONTEMPLATIONS", "contemplations.json"),
    ):
        path = os.path.join(base, fname)
        try:
            with open(path, encoding="utf-8") as f:
                out[key] = json.load(f)
        except (OSError, ValueError):
            out[key] = None
    return out


_LAYER6 = _load_layer6_assets()


def om_cipher_mantra(life_path_value: Optional[int],
                     expression_value: Optional[int],
                     lunar_phase_value: Optional[int]) -> Optional[dict]:
    table = _LAYER6.get("MANTRA_TABLE")
    if not table or not table.get("entries"):
        return None
    lp = life_path_value or 0
    ex = expression_value or 0
    lun = lunar_phase_value or 0
    size = table.get("size") or len(table["entries"])
    idx = ((lp + ex + lun) % size + size) % size
    entry = table["entries"][idx]
    return {
        "index": idx,
        "mantra": entry.get("mantra"),
        "keynote": entry.get("keynote"),
    }


def archetypal_story_seed(expression_value: Optional[int],
                          soul_urge_value: Optional[int],
                          personality_value: Optional[int]) -> Optional[dict]:
    data = _LAYER6.get("ARCHETYPAL_STORIES")
    if not data:
        return None
    # Primary: keyed lookup by `{expression}_{soul_urge}`.
    if expression_value is not None and soul_urge_value is not None:
        key = f"{expression_value}_{soul_urge_value}"
        stories = data.get("stories") or {}
        if key in stories:
            s = stories[key]
            return {
                "seed": s.get("story_seed"),
                "key": s.get("key") or key,
                "keynote": s.get("keynote"),
                "source": "keyed",
            }
    frags = data.get("fragments")
    if not frags:
        return None

    def pick(slot: str, val: Optional[int]) -> Optional[str]:
        if val is None:
            return None
        return (frags.get(slot) or {}).get(str(val))

    ex = pick("expression", expression_value)
    su = pick("soul_urge", soul_urge_value)
    pe = pick("personality", personality_value)
    bits = [b for b in (ex, su, pe) if b]
    if not bits:
        return None
    key = (f"{expression_value}_{soul_urge_value}"
           if expression_value is not None and soul_urge_value is not None else None)
    return {
        "seed": " ".join(bits),
        "key": key,
        "keynote": None,
        "source": "fragments",
        "expression_fragment": ex,
        "soul_urge_fragment": su,
        "personality_fragment": pe,
    }


def cipher_contemplation(lunar_phase_value: Optional[int],
                         solar_quarter_value: Optional[int]) -> Optional[dict]:
    data = _LAYER6.get("CONTEMPLATIONS")
    if not data or "phases" not in data:
        return None
    phase = (data.get("phases") or {}).get(str(lunar_phase_value))
    if not phase:
        return None
    solar = (data.get("solar_modifier") or {}).get(str(solar_quarter_value))
    return {
        "phrase": phase,
        "solar_modifier": solar,
        "combined": (phase + " " + solar) if solar else phase,
    }


# ── Entry points ────────────────────────────────────────────────────────

def _resolve_emergent_cipher_name(payload: dict, gk: Optional[dict],
                                  primary_gate: Optional[int]) -> Optional[dict]:
    """Resolve (gate, authority, line) from the sealed payload and call the
    emergent generator. Returns None when inputs are insufficient."""
    hd = payload.get("human_design") or {}
    m_gate = None
    m_line = None
    activations = (hd.get("activations") or {})
    pers = (activations.get("personality") or {})
    sun = pers.get("Sun") or {}
    if sun.get("gate") is not None:
        try:
            m_gate = int(sun["gate"])
        except (TypeError, ValueError):
            m_gate = None
    if sun.get("line") is not None:
        try:
            m_line = int(sun["line"])
        except (TypeError, ValueError):
            m_line = None
    if m_gate is None and primary_gate is not None:
        try:
            m_gate = int(primary_gate)
        except (TypeError, ValueError):
            m_gate = None
    if m_line is None and gk and gk.get("work") and gk["work"].get("line") is not None:
        try:
            m_line = int(gk["work"]["line"])
        except (TypeError, ValueError):
            m_line = None
    if m_line is None and hd.get("profile"):
        m = re.search(r"(\d)", str(hd["profile"]))
        if m:
            m_line = int(m.group(1))
    auth = hd.get("authority")
    if not auth:
        # No HD authority sealed → defer to the legacy temporal descriptor.
        return None
    return generate_cipher_name(m_gate, auth, m_line)


def generate(payload: dict, *, feature_flag: Optional[bool] = None,
             bhramari_flag: Optional[bool] = None,
             now: Optional[str] = None) -> dict:
    """Return the internal (private) Om Cipher record for `payload`.

    Wrap with `to_public_projection()` before exposing to public surfaces.
    """
    if not is_enabled(feature_flag):
        return {"pending": True, "reason": "om_cipher_disabled"}
    if not payload or not payload.get("birth_date"):
        return {"pending": True, "reason": "missing_birth_date"}

    lp = life_path(payload.get("birth_date"))
    name = name_resonance(payload.get("legal_name") or payload.get("preferred_name"))
    gk = gk_layer(payload.get("compass"))
    temporal = temporal_layer(payload.get("birth_date"), payload.get("birth_time"))
    primary_gate = None
    if gk:
        if gk.get("work"):
            primary_gate = gk["work"]["gate"]
        elif gk.get("lens"):
            primary_gate = gk["lens"]["gate"]

    bhramari_on = is_bhramari_enabled(bhramari_flag)
    bhramari_in = payload.get("bhramari_baseline") or {}
    baseline_hz = None
    baseline_metadata = None
    if bhramari_on and bhramari_in:
        try:
            hz = float(bhramari_in.get("hz") or 0)
        except (TypeError, ValueError):
            hz = 0
        if hz > 0:
            baseline_hz = hz
            baseline_metadata = bhramari_in.get("metadata") or None

    parts: dict = {}
    if lp:
        parts["LP"] = lp["reduced"]
    if name and name.get("expression"):
        parts["EX"] = name["expression"]["reduced"]
    if name and name.get("soul_urge"):
        parts["SU"] = name["soul_urge"]["reduced"]
    if name and name.get("personality"):
        parts["PE"] = name["personality"]["reduced"]
    if temporal:
        parts["LUN"] = temporal["lunar_phase"]
        parts["SOL"] = temporal["solar_quarter"]
        if temporal["temporal_gate"] is not None:
            parts["TG"] = temporal["temporal_gate"]
    if baseline_hz:
        parts["BHR"] = baseline_hz

    canonical = _canonical(parts)
    seed = _sha256(canonical)
    identity_parts = {k: v for k, v in parts.items() if k != "BHR"}
    seed_identity = _sha256(_canonical(identity_parts))
    input_hash = _sha256(_canonical_input_json(payload))

    bhramari_hue_deg = hz_to_visible_hue_deg(baseline_hz) if baseline_hz else None
    palette = _build_palette(
        lp["reduced"] if lp else None,
        temporal["lunar_phase"] if temporal else None,
        primary_gate,
        bhramari_hue_deg,
    )
    sigil_points = 11 if payload.get("birth_time") else 9
    sigil_svg = _build_sigil_svg(sigil_points, seed, palette)

    metadata = {
        "life_path": ({
            "value": lp["reduced"],
            "raw": lp["raw"],
            "day": lp["day"], "month": lp["month"], "year": lp["year"],
            "is_master": lp["reduced"] in (11, 22, 33),
            "label": NUMEROLOGY_LABELS.get(lp["reduced"]),
        }) if lp else None,
        # Back-compat alias.
        "digital_root": ({"value": lp["reduced"], "raw": lp["raw"]}) if lp else None,
        "expression": ({
            "value": name["expression"]["reduced"],
            "raw": name["expression"]["raw"],
            "label": NUMEROLOGY_LABELS.get(name["expression"]["reduced"]),
        }) if name and name.get("expression") else None,
        "soul_urge": ({
            "value": name["soul_urge"]["reduced"],
            "raw": name["soul_urge"]["raw"],
            "label": NUMEROLOGY_LABELS.get(name["soul_urge"]["reduced"]),
        }) if name and name.get("soul_urge") else None,
        "personality": ({
            "value": name["personality"]["reduced"],
            "raw": name["personality"]["raw"],
            "label": NUMEROLOGY_LABELS.get(name["personality"]["reduced"]),
        }) if name and name.get("personality") else None,
        "gk_primary": gk.get("work") if gk else None,
        "gk_all": gk,
        "hd_type": (payload.get("human_design") or {}).get("type"),
        "hd_authority": (payload.get("human_design") or {}).get("authority"),
        "hd_profile": (payload.get("human_design") or {}).get("profile"),
        "hd_definition": (payload.get("human_design") or {}).get("definition"),
        "seed_syllable": payload.get("seed_syllable"),
        "lunar_phase": ({
            "value": temporal["lunar_phase"],
            "label": LUNAR_PHASE_LABELS.get(temporal["lunar_phase"]),
        }) if temporal else None,
        "solar_quarter": ({
            "value": temporal["solar_quarter"],
            "label": SOLAR_QUARTER_LABELS.get(temporal["solar_quarter"]),
        }) if temporal else None,
        "temporal_gate": ({
            "value": temporal["temporal_gate"],
            "label": (
                f"Two-hour window {temporal['temporal_gate']} "
                f"({temporal['temporal_gate']*2:02d}:00–{temporal['temporal_gate']*2+2:02d}:00 local birth time)"
            ) if temporal["temporal_gate"] is not None else None,
        }) if temporal else None,
        "seed_string": canonical,
        "om_cipher_mantra": om_cipher_mantra(
            lp["reduced"] if lp else None,
            name["expression"]["reduced"] if (name and name.get("expression")) else 0,
            temporal["lunar_phase"] if temporal else 0,
        ),
        "archetypal_story_seed": archetypal_story_seed(
            name["expression"]["reduced"] if (name and name.get("expression")) else None,
            name["soul_urge"]["reduced"] if (name and name.get("soul_urge")) else None,
            name["personality"]["reduced"] if (name and name.get("personality")) else None,
        ) if name else None,
        "cipher_contemplation": cipher_contemplation(
            temporal["lunar_phase"], temporal["solar_quarter"]
        ) if temporal else None,
        "cipher_name": (lambda: (
            # Prefer the emergent v1.1 cipher name (gate + authority + line);
            # fall back to the legacy temporal descriptor when the emergent
            # inputs are incomplete.
            (lambda em: em["name"] if em else derive_cipher_name(
                payload.get("preferred_name")
                or (str(payload["legal_name"]).strip().split()[0]
                    if payload.get("legal_name") else None),
                temporal["solar_quarter"] if temporal else None,
                temporal["lunar_phase"] if temporal else None,
            ))(_resolve_emergent_cipher_name(payload, gk, primary_gate))
        ))(),
        "cipher_name_display": (
            (lambda em: em["display_name"] if em else None)(
                _resolve_emergent_cipher_name(payload, gk, primary_gate)
            )
        ),
        "cipher_name_etymology": (
            (lambda em: em["etymology"] if em else None)(
                _resolve_emergent_cipher_name(payload, gk, primary_gate)
            )
        ),
        "palette_rationale": (
            f"Hue {palette['primary_hue']}° from Life Path "
            f"{lp['reduced'] if lp else '-'}; "
            f"lunar phase {temporal['lunar_phase'] if temporal else '-'} "
            f"modulates saturation; secondary {palette['secondary_hue']}° "
            f"is the complement"
            + (f"; gate {primary_gate} sets accent offset" if primary_gate else "")
            + (f"; Bhramari accent at {bhramari_hue_deg}°" if bhramari_hue_deg is not None else "")
        ),
        "sigil_points": sigil_points,
        "seed_hash": seed[:16] + "..." + seed[-4:],
    }
    if baseline_hz:
        tone = hz_to_semitone(baseline_hz)
        metadata["bhramari"] = {
            "baseline_hz": baseline_hz,
            "nearest_semitone": f"{tone['note']}{tone['octave']}" if tone else None,
            "octave_visible_hue_deg": bhramari_hue_deg,
            "captured_at": (baseline_metadata or {}).get("captured_at"),
            "stability": (baseline_metadata or {}).get("stability"),
            "confidence": (baseline_metadata or {}).get("confidence"),
            "note": "Optional measured resonance. Refinement history via /resonance-events.",
        }

    return {
        "version": 1,
        "pending": False,
        "generated_at": now or datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "seed_string": canonical,
        "seed_identity": seed_identity,
        "input_hash": input_hash,
        "palette": palette,
        "sigil_svg": sigil_svg,
        "metadata": metadata,
        "sealed_inputs": {
            "birth_date": payload.get("birth_date"),
            "birth_time": payload.get("birth_time"),
            "birth_place": payload.get("birth_place"),
            "legal_name": payload.get("legal_name"),
            "preferred_name": payload.get("preferred_name"),
            "compass": payload.get("compass"),
            "human_design": payload.get("human_design"),
            "seed_syllable": payload.get("seed_syllable"),
        },
        "bhramari_baseline_hz": baseline_hz,
        "bhramari_baseline_metadata": baseline_metadata,
        "visibility_tier": "private",
    }


def to_public_projection(record: Optional[dict], tier: str = "badge") -> Optional[dict]:
    if not record or record.get("pending"):
        return None
    meta = record.get("metadata") or {}
    gk = meta.get("gk_primary") or {}
    lp = meta.get("life_path") or {}
    out: dict = {
        "version": record.get("version", 1),
        "palette": record.get("palette"),
        "gk_primary_label": (
            f"Gate {gk['gate']}" + (f".{gk['line']}" if gk.get("line") else "") +
            (f" · {gk['label']}" if gk.get("label") else "")
        ) if gk else None,
        "life_path_label": lp.get("value"),
        "digital_root_label": lp.get("value"),
        "sigil_points": meta.get("sigil_points", 9),
    }
    if tier == "shared":
        bh = meta.get("bhramari") or {}
        if bh.get("nearest_semitone"):
            out["bhramari_semitone"] = bh["nearest_semitone"]
            out["bhramari_hz_rounded"] = round_hz(record.get("bhramari_baseline_hz"))
        if meta.get("lunar_phase"):
            out["lunar_phase"] = meta["lunar_phase"]["value"]
        if meta.get("solar_quarter"):
            out["solar_quarter"] = meta["solar_quarter"]["value"]
    return out


def append_resonance_event(record: dict, capture: dict, *,
                           event_id: Optional[str] = None,
                           now: Optional[str] = None) -> dict:
    """Build an append-only resonance event row. Caller persists it."""
    try:
        hz = float(capture.get("hz") or 0)
    except (TypeError, ValueError):
        hz = 0
    if hz <= 0:
        raise ValueError("resonance event requires hz")
    metadata = capture.get("metadata") or {}
    return {
        "id": event_id,
        "member_id": (record or {}).get("member_id"),
        "captured_at": metadata.get("captured_at") or now or datetime.now(timezone.utc).isoformat(),
        "bhramari_hz": hz,
        "metadata": metadata or None,
        "capture_method": metadata.get("capture_method") or "bhramari-shanmukhi-v1",
        "source_surface": capture.get("source_surface") or "unknown",
    }
