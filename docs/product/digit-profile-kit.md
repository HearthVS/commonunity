# DIGIT — the Profile Kit and the Artifact Card

Status: **v0.1 design note, pre-build.** Records a design direction reached in conversation (2026-08-04) before any code. Not yet canon — supersede or promote once built. Companion to [`./digit.md`](./digit.md) (what DIGIT is), [`./fieldprint.md`](./fieldprint.md) (the private edit stage), and [`./rooms-and-digit.md`](./rooms-and-digit.md) (deeper, not wider).

Two things are designed here. The first is specific: how DIGIT should handle a person's biographical/CV material. The second is general and matters more: **the artifact card** — how DIGIT delivers *any* output into the panel without flooding it.

---

## 1. The problem

DIGIT's first guided task ("About & CV kit") reads the biographical layer at `state.compassData.profile` and renders it. Shipped live, it read as a data dump: a wall of prose, and a long unsplit education string rendered as one oversized pill.

The styling was a symptom. The cause is **shape mismatch**:

| | Shape | Example |
| --- | --- | --- |
| A CV | chronological, factual | role · organisation · years · what you did |
| Fieldprint / Living Profile | thematic, expressive | heading · summary · theme · closing, per room |

Neither container fits the other. Today the CV is stored as **prose only** — `profile.work_background` is deliberately "3–5 sentences, plain text, no bullet points" (the `/extract-cv` prompt, `server.py`). That is lossy: you cannot reliably re-derive *"Kanyon · General Manager · 2000–2007"* from a paragraph. Every surface that wants structure must re-parse text, and re-parsing text is exactly what produced the oversized-pill bug.

**Answer to "should this live in the Living Profile or the Fieldprint?"** — reuse the *pattern*, not the *container*. Biographical data is **profile-scope**, not room-scope; it does not belong to The Work specifically.

## 2. Principle: structure is the source, prose is a view

Invert the current model. Store the **structured record** as the source of truth and *generate* prose from it, rather than storing prose and trying to recover structure.

```
structured record  ──┬──▶  bio paragraph  (fills profile.work_background)
                     ├──▶  downloadable CV / About kit
                     ├──▶  hOMepage pull-down
                     └──▶  short speaker bio ("50 words for a programme")
```

One source, many renders. This is what makes the kit *workable* rather than merely better-looking: entries can be reordered, individually edited, selectively included, and re-rendered per audience.

## 3. The structured record

Proposed additions under `compassData.profile` (all additive):

| Field | Shape | Note |
| --- | --- | --- |
| `tagline` | string | **New capability.** The one-liner ("Entrepreneur, developer, community builder"). Nothing holds this today, and it is the most-requested item when sharing for speaking/work. |
| `experience[]` | `{ role, org, years, note }` | Reverse-chronological. |
| `education[]` | `{ degree, institution, years, note }` | See §4 — partially anticipated already. |
| `practices[]` | `string[]` | Already works; renders as tags. |
| `work_background` | string | **Retained**, but becomes a *generated* view of `experience[]` rather than the source. |
| `profile_image_data` / `profile_image` | string | Already present. |

## 4. Backward compatibility (verified in code)

This is additive, **not a migration** — existing readers already tolerate or anticipate structured entries:

- [`studio.html:21887`](../../studio.html:21887) already reads structured education: `[e.degree || e.qualification, e.institution || e.school]`. The schema was anticipated; it was simply never populated, because `/extract-cv` returns prose.
- `cuFpList()` reads `h.text || h.label || h.title` off object entries, so any structured entry carrying a `text` key degrades gracefully wherever lists are consumed.

Implication: structured entries can be introduced without breaking the Living Profile, the hOMepage render, or the FieldPrint editor. Entries should carry a rendered `text` alongside their parts for exactly this reason.

## 5. Delivery: the artifact card (the general pattern)

**This section generalizes beyond the profile kit** and is the more important half of this note.

DIGIT must be able to produce things without flooding a narrow (~340px) panel. The pattern:

> **DIGIT emits a compact artifact card into the thread — a signal that something was made or updated — and the full view opens in an existing roomy surface.**

The card is a *receipt*, not the artifact:

- **Compact by default** — title, one-line summary, state, small actions. Never the full contents.
- **Signals liveness** — its purpose is to tell the person *something is up and running*, and let them get to it.
- **Actions on it, not in it** — `Open` (full view), plus at most one or two task-specific verbs (`Download`, `Add to hOMepage`).
- **Optionally expandable in place** — a brief inline peek for small artifacts, the way this Claude Code session shows a compact result you can expand.
- **Universal** — the same primitive serves a drafted page, a structured CV, a diff, a generated asset, a report. Future DIGIT capabilities emit artifact cards; they do not each invent a surface.

If this proves out in build, it should graduate to its own doc as a DIGIT-wide convention.

## 6. Where the full view lives — and how the hOMe surfaces relate

Establishing this first, because the surfaces are **generations, not siblings**, and mistaking one for the other sends work to a dead path. Traced in code 2026-08-04:

### The lineage

`studio.html` carries an explicit cascade inside `openStudioProject()`:

```
Fieldprint v5   →   hOMe Workbench   →   "Preview Personal Home" modal
  (current)          (superseded)              (legacy fallback)
```

The code says so itself: the Workbench comment reads *"Replaces the old 'Preview Personal Home' modal as the primary builder entry (the old modal remains reachable as a transitional fallback)"*, and the router comment reads *"Primary surface is now the Fieldprint v5 field experience."*

**Anything opening a hOMe surface must route through `window.openStudioProject('home')`** — the canonical entry every other caller uses — never a direct call to `openWebsitePreview()`. Routing through the router means a caller follows whatever becomes primary next instead of pinning to legacy. (DIGIT briefly called the legacy modal directly; corrected.)

### The current division of labour

| Surface | Owns | Where |
| --- | --- | --- |
| Field Observations | raw capture | centre tab |
| **FieldPrint tab** (`fo-view-lde`) | **content** — 7 fields × 4 rooms, the Level 2 draft | centre tab |
| **Fieldprint v5 Builder** | **composition** — hero framing, images, layout, palette, cipher | `/fieldprint`, own app in an iframe |
| Personal hOMepage | the published result | public |

They are joined by an explicitly **non-destructive, content-only** handoff: *Send to FieldPrint Builder* → `phV5SendPrefill(sections, arrival, ack)`, whose own acknowledgement states *"hero framing, images and layout untouched."*

**This is a content / composition split, and it is the right one.** It also maps exactly onto §2 of this note: the FieldPrint tab supplies *content*; the Builder supplies *beauty*. That is the same reason DIGIT must never generate layout — the Builder already owns composition, deterministically.

### Where the kit's views land

- **Compact artifact card** → the DIGIT panel (right dock) — the receipt.
- **Full view** → the **Fieldprint** surface, reached via `openStudioProject('home')`.

Explicitly **not** doing: a new workspace tab, structured editing inside the narrow dock, or DIGIT touching composition. Per [`./rooms-and-digit.md`](./rooms-and-digit.md) — **deeper, not wider**.

### Consequence for DIGIT

DIGIT writes **content into the same Level 2 record the FieldPrint tab owns**, and may trigger the same non-destructive handoff into the Builder. It must not become a third content editor, and must not touch hero framing, images, layout, or palette — those belong to the Builder.

> **Naming caveat.** "Fieldprint" currently names three things: the private stage (per [`./fieldprint.md`](./fieldprint.md)), the content tab, and the v5 Builder app. That ambiguity is pre-existing and out of scope here, but it is the open item `fieldprint.md` already flags — worth resolving separately.

## 7. The loop: propose → review → write

The step missing today is **review**. Currently the flow jumps from raw data straight to a rendered card. It should be:

```
bring forward (consent)  →  DIGIT proposes structured entries
                         →  person reviews: Accept / Edit / Reject, per entry
                         →  written to the record with provenance
                         →  prose + kit regenerated from structure
```

This reuses two conventions already in the codebase rather than inventing any:

- The per-field **Accept / Edit / Reject** review used by Nexus *Inspire*.
- **`writeDraftField(room, key, kind, value, origin, nexusAssisted)`** — the single canonical writer, which records provenance (`compassDraftMeta`) and never mutates the immutable Level 1 cOMpass baseline.

It also lights the **Review** stage of DIGIT's creation dashboard, which is currently built but unused for this task.

## 8. Governance

- A CV is **real-world identity** (employers, institutions, dates). [`../governance/external-ai-boundary.md`](../governance/external-ai-boundary.md) requires that crossing be deliberate and visible — the review step *is* the consent moment, not a formality.
- Structuring happens only on material the person has **brought forward**; DIGIT never scans the Archive.
- Sacred / "not for processing" material is never touched.
- Real-world identity stays a **separate layer** from the sealed OM Cipher — `profile.*` already is; keep it that way.
- Publishing anything to the hOMepage remains **member-confirmed**.

## 9. Staging

1. **This note** — agree the shape. *(no code)*
2. **Viewer + artifact card**, front-end only, against hand-structured data — feel the UX before wiring extraction.
3. **Review loop** — propose → Accept/Edit/Reject → `writeDraftField` with provenance.
4. **Real extraction** — structured output from a brought-forward CV. Crosses into backend + external-AI boundary; needs its own governance pass.
5. **Generated views** — bio paragraph, speaker bio, hOMepage pull-down, all derived from the record.

## 10. Open questions

- **Completeness meter?** A "job to do" wants a finish line — *"3 of 5 — add a headshot and a tagline."* Motivating, or pressure? (Ambient-design tests in [`./archive.md`](./archive.md) apply: invite participation, don't harvest.)
- **Download format** — plain text ships today. PDF is the actually-shareable artefact for speaking/work; worth its own slice.
- Does `experience[]` need a `current` flag, or is `years` sufficient?
- Should the generated bio be **regenerated on every change**, or written once and then hand-editable (with drift risk)?

## See also

- [`./digit.md`](./digit.md) — what DIGIT is; the orient → plan → act → review → publish loop.
- [`./fieldprint.md`](./fieldprint.md) — private edit stage vs published result.
- [`./rooms-and-digit.md`](./rooms-and-digit.md) — deeper, not wider; one DIGIT.
- [`../governance/external-ai-boundary.md`](../governance/external-ai-boundary.md) — trust boundary, Sacred Mode, minimised context.
- [`./archive.md`](./archive.md) — bring-forward consent; present-not-dominant tests.
