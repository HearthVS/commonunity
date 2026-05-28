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

- 2026-05-28 — Studio audit reclassifications (third pass) — Conflicts 2 (*Sacred Tones*, sound-healing register), 6 (*authentic digital self*, founder-introduced, holds an open question), and 8 (*trust architecture*, founder-introduced) reclassified as **retained**. Scope distinction added: Charter rules about pattern-language and superlatives (§6, §7) apply to Nexus replies and system-level claims, not to founder-authored framing copy. Refinements PR scope shrinks to Conflict 10 (*sigil → Cipher*, the one standing instruction) plus four texture-level items. None of the items in this audit break ahimsa or any core principle. Cross-surface divergence with PR #52's *trust architecture* edit flagged for founder decision. See [`../handoffs/audits/studio-vocabulary-audit.md`](../handoffs/audits/studio-vocabulary-audit.md) §3 *Note on posture*.
- 2026-05-28 — Vocabulary-governance product spec opened — Admin-panel feature for ongoing vocabulary maintenance: audit / Nexus / member-flagged strings arrive in a queue, founder decides retain / refine / remove / hold, decisions write to the decision log and propose Charter edits. Captures the living vocabulary surface pattern. See [`../product/vocabulary-governance.md`](../product/vocabulary-governance.md).
- 2026-05-28 — Studio audit reclassifications (founder direction, second pass) — Conflicts 3 (frequency tooltips, no ahimsa violation), 5 (*Activate*, plain UI verb), 7 (*co-emerge / co-emergence / human emergence*, founder-coined), 9 (*frequency* as a noun, conscious choice), and 12 (*ON AIR*, studio metaphor) reclassified as **retained**. Tuner sound-healing register confirmed intentionally out of scope. Audit posture updated: foundation docs are a floor not a ceiling; goal is not flat/neutral language. Voice-samples §195 banned-vocabulary list flagged for amendment (drop *frequency*, *energy*). Nine active conflicts remain for the Studio rewrite. See [`../handoffs/audits/studio-vocabulary-audit.md`](../handoffs/audits/studio-vocabulary-audit.md) §3 *Note on posture*.
- 2026-05-28 — Sanskrit exemption — *chakra* (and other widely-understood, comprehension-load-bearing Sanskrit terms by explicit decision) is exempt from Charter §3's no-Sanskrit rule. Not a blanket allow; case-by-case. Surfaced during Studio vocabulary audit; reclassifies Conflict 4 as retained. Charter §3 wording amendment flagged as a small follow-up edit.
- 2026-05-28 — Studio vocabulary audit (revision area 2) opened — Sixteen items surfaced across `studio.html` member-facing surfaces; fifteen active after Sanskrit reclassification. Audit-only PR; rewrite is a separate later step. See [`../handoffs/audits/studio-vocabulary-audit.md`](../handoffs/audits/studio-vocabulary-audit.md).
<!-- Add new entries above this line, most recent at top. -->
