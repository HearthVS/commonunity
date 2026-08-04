# DIGIT Build Brief

Status: v0.1 working brief. Purpose: the kickoff document for the **DIGIT build thread** (kept separate from the foundation/housekeeping thread). It carries what the build must honour so the new thread starts warm. Not canonical law — it points at canon and stays current as the build proceeds.

## Goal

A first *visible* DIGIT presence in stUdio's **The Work** room — "presence precedes utility." **Slice 1 is a front-end scaffold only**: no model calls, no `server.py`/backend changes, no secrets, fully reversible. Later slices wire context and generation.

## What DIGIT is (one line)

DIGIT is the compositional intelligence of stUdio: a room-aware builder presence that helps a person shape their private **Fieldprint** into coherent digital form and, when ready, publish it as a **Personal hOMepage**. **Nexus orients meaning; DIGIT composes form.**

Canon: [`../product/digit.md`](../product/digit.md), [`../foundation/ai-roles.md`](../foundation/ai-roles.md), [`../product/fieldprint.md`](../product/fieldprint.md), [`../foundation/four-layer-architecture.md`](../foundation/four-layer-architecture.md), voice → [`../brand/commonunity-brand-communication-guide-v0.1.md`](../brand/commonunity-brand-communication-guide-v0.1.md).

---

## Constraints the build MUST honour

These come from five foundational source docs (see *Source docs to canonicalize* below). They are not optional polish — they are what makes a builder surface *CommonUnity* rather than a generic AI IDE.

### 1. The CommonUnity Key (what DIGIT works on top of)

The **CommonUnity Key** is the portable, user-held JSON file kept on the person's own device, carried **between cOMpass and stUdio**. It contains **both** the fixed **OM Cipher** (sealed six-layer identity record) and the **Living Profile** (living, self-authored content). DIGIT works *downstream* of the Key, inside stUdio:

- DIGIT **treats the sealed OM Cipher as read-only fixed data** — it never rewrites the cipher. (Cipher layers are sealed at Compass onboarding.)
- DIGIT helps shape the **Living Profile → Fieldprint → Personal hOMepage** side.
- Public copy says "CommonUnity Key / portable self-profile," never "JSON file," per the brand guide.

### 2. Trust boundary and Sacred Mode (permission, not ingestion)

DIGIT runs on external AI (Claude) — so, like Nexus, **every DIGIT interaction is a boundary-crossing event**, a chosen offering of context into an external process. Therefore:

- **Minimise what is sent to external AI by default.** Prefer curated context packs over ingesting the whole Fieldprint/project/Archive.
- **Layer and permission context** — present-moment vs session vs deeper Cipher material are *not* silently bundled. The user chooses what crosses.
- **Sacred Mode is never sent.** Local-only contemplative material must never reach DIGIT or Nexus. DIGIT must be able to see that some material is marked "not for processing" and leave it alone.
- **Non-accumulation.** Don't hoard context "in case." Hold it lightly; support release and forgetting. (This matches DIGIT's curated-context-pack principle.)
- Keep real-world identity separate from Cipher identity; avoid sending names/emails/birth data/full Cipher unless explicitly required.

### 3. AI ambience — "present, not dominant"

DIGIT's presence should feel *"I am here when you are ready,"* not *"I did this for you automatically."* Every DIGIT UI decision should pass these tests:

- Does this make AI **louder**, or help the human **hear clearly**?
- Does this **preserve** attention, or **harvest** it?
- Does this **deepen continuity**, or merely **accumulate** data?
- Does this **invite participation**, or **automate discernment away**?
- Does this respect what should remain **private, sacred, unresolved, or unprocessed**?

Bad ambience to avoid: "I summarised this automatically," unrequested suggestions, unread badges / feed behaviour, "everything is available to AI by default."

### 4. Preparation vs interpretation (know which side DIGIT is on)

- **Preparation** (extract PDF text, transcribe audio, OCR, cleanup) is **not** DIGIT/Nexus — it's plain tooling, no model needed.
- **Interpretation / generation** (pattern, relation, meaning, turning worked material into artifacts/pages) **is** DIGIT (generative/compositional) and Nexus (reflective).
- The UI must **name what actually happened** — "Text extracted," "Pattern reflected," "Artifact generated" — never a flat "AI processed this."

### 5. The four surfaces + Archive state loop

Product surfaces, by role: **cOMpass** orients · **stUdio** works (DIGIT lives here) · **Archive** remembers · **Field Recorder** captures. Material moves through explicit, consentful states:

```
Capture → Held → Prepared → Offered → Worked → Returned
```

DIGIT only sees material that has been **Offered / "brought forward"** by the user — it does not scan the Archive or the whole Fieldprint. "Bring forward" is the consent gesture; invitation framing ("How would you like to meet this material?") over mechanical toolbars.

> Note: **Archive** and **Field Recorder** are net-new surfaces not yet in the repo docs — flagged for canonicalization; not required for DIGIT slice 1.

---

## MVP scope — slice 1 (The Work room)

- A **visible DIGIT presence** in The Work, anchored to the existing `spb-dot` / `om-disc` presence motif (no new glyph coined — see `digit.md` visual identity).
- **Room-aware stance** (strongest build stance in The Work).
- A staged **orient → plan** shell (act/review/publish come later), legible and unhurried.
- **Distinct from Nexus** — DIGIT sits *beside* Nexus in The Work, never inside it.
- **No model calls, no backend, no secrets** in slice 1. Execution engines (Claude Code) can come underneath in a later slice; the visible experience should already feel stUdio-native, not terminal-driven.

## `studio.html` reuse points (from inspection)

- Rooms are `data-room` attributes (~line 7125+).
- The Work's workspace is the "workbench": `#workbench-input`, `#workbench-entries` (~7591).
- **Nexus** UI: `nexus-panel-header`, context bar (~7622) — DIGIT sits beside it.
- Reusable panels: `vibe-panel`, `entrance-seed-panel`, `nexus-panel-header`.
- Visual seed: `spb-dot` (6px luminous dot, `studio.html:3831`); toroidal `om-disc` (~3514).

## Guardrails

- New feature branch off `main` (root service deploys from `main`); not `main`/`field-phase-1` directly.
- One narrow, reviewable, reversible change. Confirm before any merge/deploy (merge to `main` = Railway deploy).
- Governance: DIGIT is a new member-facing surface → run the milestone integrity audit before it ships ([`../governance/audit-rituals.md`](../governance/audit-rituals.md)).

---

## Source docs to canonicalize (separate follow-up, not the build)

These five docs (provided 2026-08-04) are canonical-grade but not yet in the repo. Recommended homes for a later documentation pass:

| Source doc | Recommended repo home |
| --- | --- |
| Governance Principle v0.1 (trust boundary, Sacred Mode, non-accumulation, 8 limbs as data governance) | `docs/governance/external-ai-boundary.md` (or `foundation/`) |
| AI Ambience / Archive Second-Pass Direction | `docs/product/archive.md` + ambience notes in `product/studio.md`; introduces **Archive** & **Field Recorder** surfaces |
| OM Cipher White Paper (Draft v1.0) | enrich `docs/foundation/om-cipher.md` / `product/om-cipher.md` |
| OM Cipher Algorithm Spec v1.1 | `docs/product/om-cipher-v1-implementation-plan.md` (already the canonical v1 plan) |
| OM Cipher — Name as Code | Compass onboarding feature; `docs/product/compass.md` + om-cipher docs |

Also noted for the **Om Cipher engine track** (separate from DIGIT): Algorithm Spec flags a bug — `profile.gene_keys.life_work` reads `points.work.gk_num` (63, wrong) instead of `gk_profile.cs` (14, correct). Not a DIGIT concern; recorded so it isn't lost.
