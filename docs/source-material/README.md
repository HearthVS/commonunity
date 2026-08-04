# Source Material

These are **primary source documents**, preserved verbatim. They were produced *in situ* during earlier CommonUnity build passes (drafted with Perplexity, before the current repo-connected workflow). They carry nuance and detail that the structured `/docs` canon distils but does not fully reproduce.

**Status:** reference archive. These files are **not** the canonical source of truth — the structured docs under `/docs` are (see [`../README.md`](../README.md)). But where the structured docs are terse, these originals hold the full reasoning. Keep them for depth, provenance, and future canonicalization work. Do not edit them to "keep them current" — they are a snapshot; correct the structured canon instead and note it in the decision log.

## Contents and where their content is reflected in canon

| Source document | Reflected / distilled in |
| --- | --- |
| [`governance-principle-v0.1.md`](governance-principle-v0.1.md) — external-AI boundary, trust boundary, Sacred Mode, non-accumulation, 8 limbs as data governance | Build brief [`../handoffs/digit-build-brief.md`](../handoffs/digit-build-brief.md); *to canonicalize →* `docs/governance/external-ai-boundary.md` |
| [`ai-ambience-design-direction.pdf`](ai-ambience-design-direction.pdf) (+ `.txt` extraction) — stUdio/Archive/Nexus ambience; four surfaces; Held→Prepared→Offered→Worked→Returned; preparation vs interpretation | Build brief; *to canonicalize →* `docs/product/archive.md` + ambience notes in `product/studio.md`. Introduces **Archive** and **Field Recorder** as net-new surfaces |
| [`om-cipher-white-paper.md`](om-cipher-white-paper.md) — the algorithm of honest identity; fixed vs living; the CommonUnity Key; matching | Key definition in decision-log (2026-08-04); *to enrich →* `docs/foundation/om-cipher.md`, `docs/product/om-cipher.md` |
| [`om-cipher-algorithm-spec.md`](om-cipher-algorithm-spec.md) — canonical six-layer computation, JSON schema, Markus baseline, implementation order, the `life_work` gate bug | *to enrich →* `docs/product/om-cipher-v1-implementation-plan.md` (existing canonical v1 plan) |
| [`om-cipher-name-as-code.md`](om-cipher-name-as-code.md) — Layer 1 supplement: name etymology narrative + Bhramari name practice | *to enrich →* `docs/product/compass.md` + om-cipher docs |

## Note on the AI Ambience file

`ai-ambience-design-direction.pdf` is the original. `ai-ambience-design-direction.txt` is a plain-text extraction (via `pdftotext -layout`) kept alongside it for grep-ability and inline reading, since the rest of `/docs` is text/markdown. If the two ever diverge, the PDF is authoritative.

## Canonicalization is a separate, deliberate pass

Weaving this material into the structured canon (the *to canonicalize* / *to enrich* column above) is future work, to be done one reviewable doc at a time — not bundled silently. This folder preserves the sources so that work can happen without losing the originals.
