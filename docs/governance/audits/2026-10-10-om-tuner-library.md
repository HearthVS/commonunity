# Integrity Review — OM Tuner Library

- **Date:** 2026-10-10
- **Steward:** Markus Lehto
- **Contributor(s):** Claude (Claude Code, internal builder mode)
- **Facilitator consulted (if relevant):** n/a
- **Linked PRs / commits:** the Library PR (`feat/om-tuner-library`); builds on #237 (Nexus on Opus 5.5 with a model menu)

## Milestone intention (one sentence)

> Give the practitioner a private library of books and notes inside OM Tuner that they can search for exact passages, and that Nexus draws on and cites (title and page) when answering.

## Seat-setting

- [x] Re-read `foundation/commonunity-architecture-v0.2.md`
- [x] Re-read `foundation/philosophical-principles.md`

## 8-limb walk

### 1. Yama — relational integrity

- Outcome: ✅
- Notes: Touches the practitioner, the authors whose work is added, and clients. Authors: copyrighted books (the first is Hans Cousto's *The Cosmic Octave*) stay in the practitioner's private, login-protected storage for their own reference — never in the public repo, never shown to clients, never published. Clients: the library is practitioner-only; nothing from it reaches the intake or any public page. Nexus is told to cite and never to invent citations, which keeps the relationship to sources honest.

### 2. Niyama — internal discipline

- Outcome: ✅
- Notes: One small module (`tuner/server/library.ts`), additive migrations, the storage location recorded in `deployment-model.md`, and a decision-log entry. The ranking tiers (exact phrase → all words → some words) and the reason for each choice are commented in code.

### 3. Asana — structural seat

- Outcome: ✅
- Notes: Sits inside OM Tuner's practitioner side (Reference → Library), behind the existing login, on the existing Railway volume and SQLite database (FTS5 index). No new service, no new storage system. Nexus remains one presence; the library is context it reads, not a new persona.

### 4. Pranayama — energy flow

- Outcome: ⚠️
- Notes: Breath catches on image-only pages: diagrams and tables (34 of the first book's 146 pages) can't be searched, and the practitioner may not notice what is missing. The upload message and the resource card both say how many pages are searchable. **Reservation:** add text recognition or let Nexus look at a specific page image, as a later slice.

### 5. Pratyahara — removal of noise

- Outcome: ✅
- Notes: Nexus receives at most four passages per question, not whole books, so answers stay focused and cost stays flat as the library grows. Memory-summary requests skip the library. No embeddings service, no vector store: SQLite's built-in full-text search is enough at this size.

### 6. Dharana — focused intention

- Outcome: ✅
- Notes: The one thing: find what the practitioner's own sources say, quickly and with a page to check. Upload, search, open-at-page, cite, delete — nothing else.

### 7. Dhyana — coherence over time

- Outcome: ⚠️
- Notes: Coherent for one practitioner. **Reservation:** if OM Tuner later opens to other practitioners, the library must become per-practitioner (it is currently one shared library, like the rest of OM Tuner's data), and copyright handling must be restated for that product. Carry this into the multi-practitioner plan.

### 8. Samadhi — service to Unity

- Outcome: ✅
- Notes: The practitioner's knowledge becomes something they can return to and build on, and Nexus grounds its frequency work in the sources the practitioner trusts, with citations they can check, rather than in generic recall.

## Outcome

**Complete with reservations (⚠️).** Accepted reservations, each with a named follow-up:

1. **Pranayama:** make image-only pages readable (text recognition, or Nexus looking at a specific page).
2. **Dhyana:** per-practitioner libraries and restated copyright handling if OM Tuner opens to other practitioners.
