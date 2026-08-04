# OM Cipher — Canonical Algorithm Specification v1.1
**CommonUnity / Compass Engine**
*Verified against Markus Lehto baseline — DOB 1973-11-18, TOB 03:21, POB Sudbury, Ontario, Canada*

---

## Overview

The OM Cipher is a deterministic, six-layer identity computation derived entirely from three fixed inputs: **date of birth**, **time of birth**, and **place of birth**. A fourth input — **full birth name** — is required for Layers 1 and 5. One input is intentionally human-measured and cannot be computed: the **Bhramari tone** (Layer 4), which requires the person to hum. This is not a gap in the algorithm — it is a sacred act that anchors the person's living breath into their cipher.

All six layers are **sealed at Compass onboarding** and treated as immutable. The cipher is not a profile — it is a fixed identity record from which the Living Profile grows.

---

## JSON Schema — What Must Be Stored

The following fields are **required** in `om_cipher` within the compass JSON. Anything not here is either Living Profile data or must be computed on the fly.

```json
{
  "om_cipher": {
    "schema_version": "1.1.0",
    "sealed_at": "<ISO timestamp>",

    "layer_1_numerology": {
      "life_path": 4,
      "expression": 8,
      "soul_urge": 6,
      "personality": 11,
      "birthday_number": 9,
      "personal_year": "<computed annually>",
      "gematria_ordinal": 143,
      "gematria_ordinal_root": 8,
      "gematria_hebrew": 1071,
      "gematria_hebrew_root": 9
    },

    "layer_2_hd_gk": {
      "type": "Generator",
      "profile": "2/4",
      "authority": "Emotional Solar Plexus",
      "incarnation_cross": "Right Angle Cross of 14/8 | 29/30",
      "life_work": { "gate": 14, "line": 2, "gift": "Talent", "siddhi": "Bounteousness" },
      "evolution": { "gate": 8,  "line": 2, "gift": "Exquisiteness", "siddhi": "Honesty" },
      "radiance":  { "gate": 29, "line": 4, "gift": "Commitment", "siddhi": "Devotion" },
      "purpose":   { "gate": 30, "line": 4, "gift": "Lightness", "siddhi": "Rapture" }
    },

    "layer_3_temporal": {
      "dominant_gate": 14,
      "hexagram_title": "Possession in Great Measure",
      "octave_position": "FA",
      "octave_note": "First shock point — transformation threshold",
      "law_of_three": "Active",
      "law_of_three_meaning": "Initiating force — the mover"
    },

    "layer_4_vibrational": {
      "root_frequency_hz": 194.18,
      "root_note": "G3",
      "solfeggio_hz": 639,
      "solfeggio_name": "FA",
      "solfeggio_meaning": "Connecting and Relationships",
      "seed_syllable": "VAM",
      "seed_element": "Water / Emotional Intelligence",
      "color_hex": "#E8A020",
      "color_name": "Orange-Gold",
      "bhramari_hz": null,
      "bhramari_note": null,
      "bhramari_measured": false
    },

    "layer_5_name": {
      "full_name": "Markus Lehto",
      "ordinal_total": 143,
      "ordinal_root": 8,
      "hebrew_total": 1071,
      "hebrew_root": 9,
      "dominant_phoneme": "MA",
      "cipher_name": "MAVARA",
      "cipher_name_etymology": "Gate 14 (MA/power) + VAM seed (VA/water) + Line 2 solar (RA)"
    },

    "layer_6_sigil": {
      "geometry": "hexagonal",
      "growth_edge_gate": 29,
      "crack_axis": "line_4_relational",
      "color_primary": "#E8A020",
      "color_secondary": "#1A0A2E",
      "svg_path": null,
      "generated": false
    }
  }
}
```

---

## Layer 1: Numerology — The Number Body

**Inputs required:** `date_of_birth`, `full_name`

### Life Path
Sum all digits of the full date (YYYY + MM + DD). Reduce by digit-summing repeatedly.
Preserve Master Numbers **11, 22, 33** — do not reduce further.

```
1973-11-18:
  1+9+7+3 = 20  →  2+0 = 2
  1+1 = 2
  1+8 = 9
  2 + 2 + 9 = 13  →  1+3 = 4
Life Path = 4
```

### Expression Number
Pythagorean gematria (A=1…I=9, J=1…R=9, S=1…Z=8) on the **full birth name**.
Reduce to single digit, preserving master numbers.
*Markus Lehto → 8*

### Soul Urge
Pythagorean values of **vowels only** in full birth name.
*Markus Lehto → 6*

### Personality Number
Pythagorean values of **consonants only** in full birth name.
*Markus Lehto → 11 (Master — preserved)*

### Birthday Number
Reduce the **day of birth** only (18 → 1+8 = 9).

### Personal Year *(recomputed annually, not sealed)*
Sum of `digit_sum(birth_month) + digit_sum(birth_day) + digit_sum(current_year)`, then reduce.
*2026: 2 + 9 + 8 = 19 → 1+9 = 10 → 1+0 = 1... wait — 11+18+2026: 1+1+1+8+2+0+2+6 = 21 → 3*
*Personal Year 2026 = 3 (Expression, creativity, communication)*

### Gematria — English Ordinal
A=1, B=2… Z=26. Sum all letters of full name. Reduce to root.
*Markus Lehto: M(13)+A(1)+R(18)+K(11)+U(21)+S(19)+L(12)+E(5)+H(8)+T(20)+O(15) = 143 → root 8*

### Gematria — Hebrew (Standard)
Use standard Hebrew letter values mapped to English phonemes.
*Markus Lehto → 1071 → root 9*

---

## Layer 2: Human Design & Gene Keys

**Inputs required:** `date_of_birth`, `time_of_birth`, `place_of_birth`

**This layer is computed by the existing SDK engine.** The following fields must be extracted and stored:

- `type`, `profile`, `authority`, `incarnation_cross`
- `life_work`: gate + line (Personality Sun)
- `evolution`: gate + line (Personality Earth)
- `radiance`: gate + line (Design Sun — 88° prior)
- `purpose`: gate + line (Design Earth)
- `sun_longitude`: raw ecliptic degrees at birth (stored for Layer 3)

**Markus baseline (verified):**
- Generator | 2/4 | Emotional Solar Plexus
- Right Angle Cross of 14/8 | 29/30
- Life Work: GK 14.2 | Evolution: GK 8.2 | Radiance: GK 29.4 | Purpose: GK 30.4

---

## Layer 3: Temporal Resonance

**Inputs required:** `sun_longitude` (from Layer 2), `life_path` (from Layer 1)

### I Ching Gate
The dominant gate is the Personality Sun gate from Layer 2.
Store: `gate_number`, `hexagram_title` (from King Wen sequence lookup table).

### Octave Position (Law of Octave — Gurdjieff)
Map `life_path` to the octave scale:

| Life Path | Octave Note | Meaning |
|-----------|-------------|---------|
| 1 | DO | Beginning — first impulse |
| 2 | RE | Development — gathering |
| 3 | MI | Expression — shock point approaching |
| 4 | FA | **First shock point** — transformation threshold |
| 5 | SOL | Movement — integration |
| 6 | LA | Completion — harmony |
| 7 | SI | Transcendence — second shock point approaching |
| 8 | DO (upper) | New octave — mastery rebirth |
| 9 | RE (upper) | Universal — completion into new beginning |
| 11 | MI (master) | Intuitive shock — visionary threshold |
| 22 | FA (master) | Architect's shock — world builder threshold |
| 33 | SOL (master) | Teacher's movement — universal service |

*Markus (Life Path 4) = FA — sits permanently at the transformation threshold. This is not a weakness; it means his nature is the hinge point between worlds.*

### Law of Three Position
`life_path % 3`:
- `1` → **Active** (initiating, yang, moving)
- `2` → **Passive** (receiving, yin, holding)
- `0` → **Reconciling** (neutralizing, bridging)

*Markus (4 % 3 = 1) = Active force*

---

## Layer 4: Vibrational Signature

**Inputs required:** `life_path` (Layer 1), `authority` (Layer 2), `dominant_gate` (Layer 3)

### Root Frequency
Map `life_path` to planetary / elemental frequency family:

| Life Path | Frequency | Note | Element |
|-----------|-----------|------|---------|
| 1 | 126.22 Hz | B2 | Sun |
| 2 | 210.42 Hz | G#3 | Moon |
| 3 | 141.27 Hz | C#3 | Venus |
| 4 | **194.18 Hz** | **G3** | **Earth** |
| 5 | 221.23 Hz | A3 | Mercury |
| 6 | 183.58 Hz | F#3 | Venus |
| 7 | 207.65 Hz | G#3 | Neptune |
| 8 | 147.85 Hz | D3 | Saturn |
| 9 | 172.06 Hz | F3 | Mars |

*Markus = 194.18 Hz (Earth frequency, G3)*

### Solfeggio Family
Map `life_path` to Solfeggio tone:

| Life Path | Solfeggio | Name | Meaning |
|-----------|-----------|------|---------|
| 1 | 396 Hz | UT | Liberating guilt and fear |
| 2 | 417 Hz | RE | Undoing situations, facilitating change |
| 3 | 528 Hz | MI | Transformation, DNA repair |
| 4 | **639 Hz** | **FA** | **Connecting and relationships** |
| 5 | 741 Hz | SOL | Awakening intuition |
| 6 | 852 Hz | LA | Returning to spiritual order |
| 7 | 963 Hz | SI | Awakening perfect state |
| 8 | 528 Hz | MI | Transformation (master octave) |
| 9 | 852 Hz | LA | Spiritual order, completion |

*Note: FA here (639 Hz / connecting) resonates perfectly with Markus's FA octave position and 2/4 relational profile.*

### Seed Syllable (Bija Mantra)
Map from HD `authority` (dominant center):

| Authority / Center | Seed Syllable | Element |
|-------------------|---------------|---------|
| Sacral | LAM | Earth |
| **Emotional Solar Plexus** | **VAM** | **Water** |
| Spleen | RAM | Fire |
| Heart / Ego | YAM | Air |
| Self / G-Center | HAM | Ether/Space |
| Throat | OM | Universal |
| Head / Ajna | AUM | Mind |

*Markus = VAM (water, emotional intelligence, flow)*

### Color Correspondence
Map root frequency to color via cymatics/chakra spectrum:
- 194 Hz → **Orange-Gold** (`#E8A020`)

### Bhramari Tone *(human-measured — never computed)*
This field is intentionally blank until the person performs the Bhramari breath practice and their humming tone is measured. It is stored as `bhramari_hz` and `bhramari_note` only after the living act. This is the one bridge between the Fixed Cipher and the Living Profile.

---

## Layer 5: Name Intelligence & Emergent Cipher Name

**Inputs required:** `full_name`, `gematria_ordinal_root`, `life_path`, `dominant_gate`, `dominant_line`, `seed_syllable`

### Dominant Phoneme
Extract the seed syllable's **vowel core** as the root phoneme:
- VAM → core vowel: **A** → dominant phoneme cluster: **MA** (gate 14 = MA sound family in Sanskrit: abundance, power, mother)

### Cipher Name Generation Algorithm
```
1. Gate phoneme:    gate_14 → "MA" (from Sanskrit/seed table)
2. Seed syllable:   VAM → take first two letters: "VA"
3. Line resonance:  line_2 → solar/movement → "RA" (from Ra/Sun tradition)
4. Combine:         MA + VA + RA = MAVARA
```

**Gate → Phoneme seed table (all 64 gates)** must be built as a lookup. The principle:
- Gates 1–8: root syllables (LAM family)
- Gates 9–16: sacral syllables (VAM family)
- Gates 17–24: solar plexus syllables (RAM family)
- Gates 25–32: heart syllables (YAM family)
- Gates 33–40: throat syllables (HAM family)
- Gates 41–48: third eye syllables (OM family)
- Gates 49–64: crown syllables (AUM family)

Gate 14 falls in the sacral/VAM family → phoneme seed "MA" (power of abundance).

---

## Layer 6: Sigil Design Specification

**Inputs required:** all prior layers

**This layer requires an SVG generation engine.** The sigil is not decorative — it is a geometric encoding of all five prior layers.

### Geometry
Root frequency 194 Hz → 6-fold symmetry → **hexagonal base form**

### Construction
1. **Outer ring:** Incarnation Cross (4 gates as 4 axis points within the hexagon)
2. **Middle ring:** Octave position (FA = position 4 on a 7-point inner star)
3. **Inner core:** Root frequency waveform (Lissajous of 194 Hz × solfeggio 639 Hz)
4. **Crack:** Single intentional break in the outer ring at the **growth-edge gate axis** (Gate 29 / Radiance — line 4 opening)
5. **Color fill:** Orange-Gold primary (`#E8A020`), Scorpio indigo secondary (`#1A0A2E`)

### The Crack Principle
The crack is not an error. It is the **open door** — the one gate in the cipher that marks the growing edge. For Markus, Gate 29 (Radiance: Half-Heartedness → Commitment → Devotion) is that door. The crack opens on the line 4 axis, which is the relational/social threshold — the place where the hermit meets the world.

---

## What Is Currently in the JSON vs. What Is Missing

| Field | JSON Status | Action Required |
|-------|-------------|-----------------|
| `dob`, `tob`, `pob` | ✅ Present | None |
| `gk_profile` (gates + lines) | ✅ Present | None |
| `profile.gene_keys_*` (4 keys) | ✅ Present (strings) | Convert to structured objects |
| `profile.astrology_sun` | ✅ Present | None |
| **`om_cipher.layer_1_numerology`** | ❌ **Missing** | Compute from `dob` + `full_name` |
| **`om_cipher.layer_3_temporal`** | ❌ **Missing** | Compute from `gk_profile.cs` + `life_path` |
| **`om_cipher.layer_4_vibrational`** | ❌ **Missing** | Compute from `life_path` + `authority` |
| **`om_cipher.layer_5_name`** | ❌ **Missing** | Compute from `full_name` + prior layers |
| **`om_cipher.layer_6_sigil`** | ❌ **Missing** | Generate SVG after Layers 1–5 |
| `points.work/lens/field/call` | ⚠️ Present but empty | Populate via Compass facilitation |
| `profile.gene_keys.life_work` | ⚠️ Shows GK 63 (wrong) | Fix: should be 14 from `gk_profile.cs` |

---

## Critical Bug — Conflicting Gene Keys Numbers

The JSON contains a conflict that must be fixed:

```json
"gk_profile": { "cs": 14 }         ← CORRECT (from engine)
"profile.gene_keys.life_work": "GK 63"  ← WRONG (from points.work.gk_num)
```

The `profile.gene_keys.life_work` field is reading from `points.work.gk_num` (which is `63`) instead of from `gk_profile.cs` (which is `14`). These are different things:
- `gk_profile.cs = 14` = **Personality Sun Gate** (the correct Life Work gate)
- `points.work.gk_num = 63` = **a separate Gene Keys "Work" point** from a different tradition mapping

The engine must use `gk_profile.cs` as the canonical Life Work gate. `points.work.gk_num` is a different field and should be labeled distinctly.

---

## Implementation Order for Computer

1. **Fix the `gene_keys.life_work` conflict** (read from `gk_profile.cs`, not `points.work.gk_num`)
2. **Build Layer 1 numerology engine** — pure arithmetic, no external data needed
3. **Build Layer 3 octave + law of three** — uses `life_path` from Layer 1 and `cs` from `gk_profile`
4. **Build Layer 4 frequency mapper** — lookup tables only, deterministic from `life_path` + `authority`
5. **Build Layer 5 cipher name engine** — lookup tables for gate phonemes + seed syllable + line resonance
6. **Write all outputs to `om_cipher` block in JSON** — sealed with timestamp
7. **Sigil SVG engine** — last, after all data is verified

