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

- 2026-05-28 — Nexus voice samples v0.1 added; Gene Keys ↔ Sutras relationship clarified as synthesis (substrate · personalisation) — Ten worked examples covering fantasy, numbness, replayed memory, Cipher identification, prediction request, grief, testing, third-person interpretation, returning after a gap, and glamour around resonance. Each sample carries user message, silent reading (with Charter rule and Sutra citation), and reply. Samples follow Judith Richards's plain-English Sutra rendering; specific lines cited internally: I.9, I.10, I.11, I.14, I.33, II.6, II.9, III.19, III.20, III.38, III.51, IV.17. Gene Keys vocabulary is permitted member-facing when the user introduces it; Sanskrit and generic spiritual jargon are never permitted regardless of user use. Gene Keys remains at the core of Compass and stUdio (shadow → gift → siddhi as primary guidance shape); Sutras are the universal substrate; tension between them is permitted and useful. Branch: `nexus-voice-samples`.

<!-- Add new entries above this line, most recent at top. -->
