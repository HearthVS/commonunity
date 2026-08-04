# Om Cipher — Foundational Framing

Status: v0.1 stub. Canonical source: [`commonunity-architecture-v0.2.md`](./commonunity-architecture-v0.2.md), sections *"Om Cipher"*, *"Om Cipher v1 engine model"*, *"Bhramari / Humming Bee activation"*. For the product surface, see [`../product/om-cipher.md`](../product/om-cipher.md). For the canonical v1 build plan, see [`../product/om-cipher-v1-implementation-plan.md`](../product/om-cipher-v1-implementation-plan.md).

For the fuller originating vision — the fixed/living philosophy, the 64-template, the **CommonUnity Key** architecture (the portable file holding both the OM Cipher and the Living Profile), and the **matching algorithm** (honest data, complementarity, Field Handle — a future track, not v1) — see [`./om-cipher-white-paper.md`](./om-cipher-white-paper.md).

## What Om Cipher is

Om Cipher is the objective source-code layer of a member. It is a **compressed information fractal** of the person's source pattern: the geometry of their given structure.

It is not an avatar, a badge, a logo, or a decoration. It is generated deterministically from a stable input contract and exists as the member's identity token inside the Field.

## Source inputs

- Birthdate and digital root
- Gene Keys and I Ching structure (Life's Work, Evolution, Radiance)
- Human Design type
- Name numerology / gematria
- Seed syllable (default: Om)
- Captured Bhramari / Humming Bee resonance frequency
- Handle (as deterministic seed stabilizer, not a visible symbol)

## When it is generated

Om Cipher is generated at the **end of the Compass process** as an initiation seal and entrance marker into Studio and cOMmons. It is not a Studio artifact and not a member-built object.

## Its relationship to Living Profile

```text
Om Cipher       = source pattern
Living Profile  = lived expression
```

The two are generated together through Compass and form the fundamental information layer that informs every downstream surface.

## Engine model (summary)

A single canonical Om Cipher engine renders the cipher across:

- Studio preview / threshold
- cOMmons cover / node
- cOMmons Profile / Living Profile public expression
- Future standalone `omcipher.com` product

The engine accepts a stable input contract and returns deterministic outputs (especially SVG). It supports at least two render modes:

- `full` — all layers, used in detail and public profile contexts
- `node` — simplified boundary/color render, used for constellation or cOMmons cover states

See the full input-to-visual mapping, Gene Key geometry families, Human Design compositional behavior, frequency-to-color mapping, and the layer model in [`commonunity-architecture-v0.2.md`](./commonunity-architecture-v0.2.md). That document is authoritative; do not duplicate the tables here.

## Bhramari capture, briefly

Bhramari pranayama (especially with Shanmukhi mudra) is the somatic activation for Om Cipher. The member hums into the system; the system captures fundamental frequency, dominant harmonic, harmonic spread, tonal stability, and resonance envelope.

In v1 this is a ritual and resonance signature, not biometric security. The captured tone influences sigil color (via frequency-to-light mapping through octave equivalence), cymatic core geometry, motion, and the harmonic palette.

### Bhramari baseline + append-only refinement (v1 principle)

Bhramari is **core to the ritual experience**, not decorative. Unlike birthdate, name, Gene Keys, and Human Design — which are fixed identity inputs that are Compass-sealed once and permanently immutable — Bhramari is a **somatic measurement** of how the body sounds today. A person's hum drifts with breath, posture, season, and practice; treating it as permanently immutable would betray both the physiology and the ritual.

Therefore, in v1:

- An initial Bhramari capture at Compass is stored as the **sealed baseline** (`bhramari_baseline_hz` + measurement metadata).
- Subsequent captures are stored as **append-only resonance events** in `om_cipher_resonance_events`. The baseline is never rewritten; history accumulates alongside it.
- Bhramari capture is **optional** at Compass. If absent, Om Cipher still generates fully from fixed identity inputs.
- The capture method, metadata shape, and confidence scoring are **versioned and refineable** as we learn from real captures, without invalidating earlier ones.
- Visual use in v1 is intentionally minimal (a palette accent and metadata exposure). The full Bhramari-driven cymatic, harmonic, and motion layers ship in v1.1+.

See [`../product/om-cipher-v1-implementation-plan.md`](../product/om-cipher-v1-implementation-plan.md), sections §1d, §2 Layer 5/7, §6, §7, and §12 for the full contract.

## Open implementation work

Tracked in [`commonunity-architecture-v0.2.md`](./commonunity-architecture-v0.2.md) under *"Immediate implementation priorities"* and in [`../handoffs/next-thread-handoff.md`](../handoffs/next-thread-handoff.md) under *"Suggested implementation sequence"*. Do not fork those lists; update them in place.
