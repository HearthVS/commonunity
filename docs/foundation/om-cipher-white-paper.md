# The OM Cipher — White Paper (Algorithm of Honest Identity)

Status: v0.1 canonical (originating vision). The full source is preserved verbatim at [`../source-material/om-cipher-white-paper.md`](../source-material/om-cipher-white-paper.md) (Draft v1.0, May 2026) and [`../source-material/om-cipher-algorithm-spec.md`](../source-material/om-cipher-algorithm-spec.md) (Spec v1.1). This doc is the repo-integrated canonical statement.

> **Authority note.** For what actually ships in v1, the canonical build reference is [`../product/om-cipher-v1-implementation-plan.md`](../product/om-cipher-v1-implementation-plan.md) — including its layer numbering, which differs from the white paper's (see *Reconciliation* below). This white paper is authoritative for the **originating vision, the philosophical foundation, the CommonUnity Key architecture, and the matching algorithm** (the last of which the v1 plan explicitly defers to a future phase).

## Overview

The OM Cipher is a **deterministic identity-sealing algorithm** at the heart of CommonUnity. It transforms the fixed facts of a person's birth — date, time, and place — together with their given name, into a multi-layered structure that encodes who a person is at the level of cosmic architecture. It does not *invent* a person's identity; it **reads coordinates that already exist.**

## Philosophical foundation

### The fixed and the living

Every person exists across two registers:

- **Fixed information** — imprinted at birth, unchanging, not subject to preference or narrative. Computed deterministically from birth date, time, and place. This is the domain of the **OM Cipher**.
- **Living information** — accumulated through experience: what a person has done, learned, created, loved, suffered, contributed. It evolves continuously. This is the domain of the **Living Profile**.

Neither is complete without the other. The OM Cipher is the seal on one side; the Living Profile is the record of the other. Both are carried in the **CommonUnity Key** (see below).

### The OM as plasmic coherence field

"OM Cipher" is not decorative. OM here is the **vibratory field from which form emerges** — a coherence field underlying all structure. The cipher is not a disguise or an encryption; it is a **reading** — a structured disclosure of what is already encoded when a person enters physical existence. Honest self-knowledge, rooted in verifiable cosmological data, is the precondition for genuine relationship, collaboration, and unity.

### The template beneath all templates

The algorithm is organised around the number **64** — the shared organising principle of: the 64 hexagrams of the I Ching; the 64 codons of DNA (4³); the 64-tetrahedron grid (Haramein) proposed as the geometry of spacetime; 64-bit computational architecture; and the 6-line Gene Keys structure (64 × 6 = 384 expressions). The OM Cipher treats the 64-hexagram map as a universal template — a Rosetta Stone connecting biological, cosmological, computational, and symbolic dimensions. It does not impose the structure; it recognises a pre-existing coordinate system.

## The algorithm — six layers (white-paper model)

Each layer is deterministic: same inputs → same outputs, no randomness. Primary inputs: birth date, birth time, birth place (→ lat/long), and full name at birth. (The Bhramari tone is the one **human-measured** input — see the v1 plan and [`om-cipher.md`](./om-cipher.md).)

1. **Numerological root — the number body.** Pythagorean/Chaldean numerology on birth date and full name: Life Path, Expression, Soul Urge, Birthday, Personal Year. Master numbers 11/22/33 are preserved, not reduced.
2. **Cosmological map — Human Design & Gene Keys.** Two planetary snapshots — Personality (conscious, at birth) and Design (unconscious, 88° of solar arc prior) — each mapped to one of the 64 hexagrams and 6 lines. Yields Type, Strategy, Authority, Profile, Incarnation Cross, defined/undefined centres, and the four Gene Keys (Life's Work, Evolution, Radiance, Purpose), each carrying Shadow → Gift → Siddhi.
3. **Temporal resonance — I Ching & cyclical time.** Birth-moment hexagram, moving lines, Octave position (Gurdjieff's Law of the Octave, with "shock points"), and Law of Three position (Active / Passive / Reconciling).
4. **Vibrational signature — frequency & sound.** A root frequency (Hz) → musical note and Solfeggio family; the seed syllable (Bija Mantra) for the dominant centre; the Bhramari tone (human-measured); colour via cymatics.
5. **Name intelligence — gematria & seed syllable.** Full name through Hebrew/Greek/English-Ordinal gematria; digital root cross-referenced with Life Path; dominant phoneme → seed syllable; an **emergent cipher name** generated from dominant hexagram + seed syllable + gematria root (it emerges from computation; it is not assigned).
6. **Sigil generation — the visual form.** A geometric synthesis of layers 1–5 into a unique, reproducible SVG: Incarnation Cross points, hexagram line structure, octave offset, frequency-determined geometry family, colour palette, and seed-syllable motif. Suitable as personal mark, Living Profile avatar, or Field handle.

## The CommonUnity Key

All layer outputs are sealed into the **CommonUnity Key** — a lightweight, **user-sovereign JSON file** the person keeps on their own device and carries between cOMpass and stUdio (and across tools). It **holds both** the fixed OM Cipher **and** the Living Profile. It is designed to:

- Live on the user's own device (USB, local drive) — no central server holds it.
- Be **append-only** — new measurements and lived data are added without overwriting fixed cipher data.
- Use **schema versioning** — future layers add without breaking earlier structure.
- Expose **only privacy-safe projections** to the public Living Profile.

The Key is the digital twin of the physical person; the sigil is its symbolic representation. (This is the canonical definition — see the decision log, 2026-08-04. The "key" metaphor is literal: the file you own and carry to move your context between the rooms.)

## The matching algorithm — unity in practice

> Not yet built. The v1 implementation plan lists cross-member matching as a **future Constellation Node / explicit non-goal for v1**. This section canonicalises the *design intent* for that future work.

- **Honest data.** Unlike self-reported bios and skills (subject to aspiration and impression management), the fixed cipher is **honest data** — it cannot be inflated or fabricated, because it is computed from immutable coordinates. Honest data does not replace self-reported data; it **grounds** it.
- **Complementarity, not similarity.** Modeled on the I Ching (two hexagrams forming a complete pattern) and Human Design **circuit completion** (gate pairs that form channels only across two people). The algorithm seeks functional wholes, not sameness.
- **Matching dimensions:** Gate Complementarity (HD channels), Octave Alignment, Law-of-Three fit, Frequency Harmony (consonant intervals), Profile Resonance (Gene Keys line pairs), and Living Profile overlay (declared skills/intentions/availability).
- **Weighted, context-sensitive scoring.** General hierarchy: Gate Complementarity (highest) → Frequency Harmony → Profile Resonance → Octave/Law-of-Three → Living Profile overlap. Weights shift by the user's declared intention (creative collaboration weights frequency/profile; a working team weights gate complementarity/Law-of-Three). Every match result carries a version tag for the algorithm and active data layers.
- **The Field Handle.** Each cipher generates a short, unique **Field Handle** — the member's public identity token in the cOMmons, derived from the emergent cipher name and a compressed hexagram code, carrying the frequency/geometric signature in compressed form.

## Methodology for expansion

The OM Cipher is an **open architecture** — a fixed core with defined extension points:

1. **Fixed data is never overwritten.** Sealed layers are appended to, never substituted.
2. **New layers are feature-flagged** as non-canonical until verified across a cohort (candidates: Ayurvedic constitution, biorhythm, astrological transits, somatic measurements, Enneagram, HD Variable).
3. **The matching algorithm is explicitly versioned.**
4. **User sovereignty is absolute** — no cipher data is shared, projected, or matched without explicit, layered consent (visible-to-self / trusted-connections / commons field). This aligns with [`../governance/external-ai-boundary.md`](../governance/external-ai-boundary.md).

Each expansion passes a milestone audit: does it add honest vs self-reported data (label it), deepen self-knowledge or serve impression management, respect both parties' sovereignty, and keep its matching weight transparent?

## The two sides of the coin

```
        THE OM CIPHER                    THE LIVING PROFILE
   Fixed at birth · deterministic    Evolves · self-authored · experiential
   Layers 1–6 (sealed)               Skills, projects, needs, offers, weather
              └──────────── CommonUnity Key (.json) ────────────┘
                     Matching Algorithm · Field Handle / Sigil · cOMmons
```

Honest data is not the claim a person makes about themselves — it is the **resonance between what they were born with and what they have become.**

## Reconciliation with the v1 implementation plan

The [v1 implementation plan](../product/om-cipher-v1-implementation-plan.md) is the authoritative *build* reference and is deliberately narrower than this vision. Known differences to hold consciously:

- **Layer numbering differs.** The v1 plan's layers (1 Digital Root, 2 Name/Gematria, 3 Gene Keys/I Ching, 4 Temporal, 5 Seed, 6 Sigil, 7 Resonance Palette) do not map one-to-one to the white paper's six. Treat the **v1 plan's numbering as authoritative for code**; this white paper's numbering is the originating scheme.
- **Matching is future**, not v1 (v1 plan §11 Non-Goals; §8 Future Constellation Nodes).
- **A data bug** noted in the algorithm spec (v1.1): the canonical Life Work gate must read from `gk_profile.cs` (e.g. `14`), **not** `points.work.gk_num` (e.g. `63`) — these are different fields. Tracked for the Cipher engine track (not DIGIT). See [`../source-material/om-cipher-algorithm-spec.md`](../source-material/om-cipher-algorithm-spec.md) §"Critical Bug".

---

Related: [`./om-cipher.md`](./om-cipher.md) (foundational framing), [`../product/om-cipher.md`](../product/om-cipher.md) (product surface), [`../product/om-cipher-v1-implementation-plan.md`](../product/om-cipher-v1-implementation-plan.md) (authoritative v1 build), [`./four-layer-architecture.md`](./four-layer-architecture.md) (the Cipher as the Orientation layer's visible expression).
