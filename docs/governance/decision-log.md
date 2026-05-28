# Decision Log

Append-only record of meaningful decisions in CommonUnity. One line per entry. Add a new entry whenever:

- An architecture decision is taken or revised.
- A milestone integrity audit is completed (see [`./audit-rituals.md`](./audit-rituals.md)).
- A scope change is accepted or rejected.
- A live infrastructure decision is made (domain, service, provider, SMTP, etc.).

Format:

```text
- YYYY-MM-DD — <short title> — <decision / outcome>. <link to PR, audit, or context>.
```

Keep entries terse. The full context belongs in the linked artifact, not here.

---

## Entries

- 2026-05-16 — Om Cipher v1 implementation plan archived; Bhramari treated as optional measured resonance with sealed baseline + append-only refinement — Plan committed at [`../product/om-cipher-v1-implementation-plan.md`](../product/om-cipher-v1-implementation-plan.md). Fixed identity inputs (birthdate, name, Gene Keys, Human Design) remain Compass-sealed and immutable. Bhramari is distinguished as a somatic measurement: optional in v1, with `bhramari_baseline_hz` sealed at first capture and later captures stored in append-only `om_cipher_resonance_events`. v1 visual use is minimal (palette accent + metadata); full cymatic/harmonic/motion layer is v1.1+. Living Profile UX and additive migration constraints preserved.
- 2026-05-16 — Documentation foundation v0.1 — Established `/docs` structure (foundation, architecture, product, governance, handoffs). Architecture v0.2 brief and next-thread handoff adopted as canonical sources. Branch: `docs/foundation-v0.1`.
- 2026-05-16 — Adapted 8 limbs adopted as audit framework — The 8 limbs are now both the decision-making frame (pre-build) and creation-audit frame (per milestone). See [`./audit-rituals.md`](./audit-rituals.md).
- 2026-05-16 — Documentation system surfaces — GitHub is source of truth; Notion is human workspace; Railway is deployment/runtime reference. See [`../README.md`](../README.md).

- 2026-05-28 — Four-layer architecture named as canonical: Field → Orientation → stUdio → Cipher — Structural complement to the Golden Thread. Tissue salts placed *inside* the OM Cipher (Orientation layer), not as a separate lens; lay name is **tissue salts** in docs and member-facing surfaces, internal SDK module retains `cell_salts` naming. **Cipher** is canonical; *sigil* and *Cipher* are equivalent, with *sigil* preserved only in legacy engine module names. Sanctuary clause named as a structural commitment (positive frame for the trust messaging rewrite). Consume → live → serve arc named as the path's shape. No medical-guidance disclaimer required; the writing style carries the implicit framing. New doc: [`../foundation/four-layer-architecture.md`](../foundation/four-layer-architecture.md). Branch: `four-layer-architecture-addendum`.

<!-- Add new entries above this line, most recent at top. -->
