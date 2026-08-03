# Integrity Review — Foundation correction and operating agreement

- **Date:** 2026-08-03
- **Steward:** Markus (via Claude Code, internal builder mode)
- **Contributor(s):** Claude Code
- **Facilitator consulted (if relevant):** n/a (no Compass-touching or member-facing change)
- **Linked PRs / commits:** branch `docs/foundation-correction` (this PR)

## Milestone intention (one sentence)

> Correct the infra record (Cloudflare + GoDaddy + Railway), name the Fieldprint → Personal hOMepage boundary, restore the missing four-layer-architecture doc, and add a `CLAUDE.md` operating agreement — a documentation-only foundation pass with no runtime change.

## Seat-setting

- [x] Re-read `foundation/commonunity-architecture-v0.2.md` (core sequence + five layers)
- [x] Re-read `foundation/philosophical-principles.md` (via the audit-rituals frame)

## 8-limb walk

### 1. Yama — relational integrity

- Outcome: ✅
- Notes: Touches the maintainer/contributor relationship and future stewards. Corrects a stale infra doc and a broken canonical reference — leaves both in greater integrity. No member data or member-facing surface touched.

### 2. Niyama — internal discipline

- Outcome: ✅
- Notes: A future steward can pick this up cold: `CLAUDE.md` states deploy branches and definition-of-done; `fieldprint.md` names a boundary the code left implicit; the four-layer doc is restored where `docs/README.md` already pointed.

### 3. Asana — structural seat

- Outcome: ✅
- Notes: Every file sits where the existing docs tree already expects it — `architecture/`, `foundation/`, `product/`, `governance/audits/`, and `CLAUDE.md` at repo root. No new structure invented.

### 4. Pranayama — energy flow

- Outcome: ✅
- Notes: Removes two friction points — an infra doc that contradicted live reality, and a `docs/README.md` pointer to a missing file.

### 5. Pratyahara — removal of noise

- Outcome: ✅
- Notes: Stale GoDaddy-CNAME-to-Railway values were demoted to "historical" rather than deleted, and specific Cloudflare record values were deliberately *not* invented — avoiding recording unverified detail.

### 6. Dharana — focused intention

- Outcome: ⚠️
- Notes: The one thing: establish a correct foundation before DIGIT. Everything serves it. Reservation: DIGIT is mentioned in `fieldprint.md` only to place its future home; full DIGIT product/AI-role docs are intentionally deferred to a follow-up PR to keep this slice narrow.

### 7. Dhyana — coherence over time

- Outcome: ✅
- Notes: The Fieldprint/hOMepage boundary and the four-layer restore are the stable base the DIGIT layer builds on. `CLAUDE.md` should stay coherent across milestones; it references docs rather than duplicating them.

### 8. Samadhi — service to Unity

- Outcome: ✅
- Notes: This adds clarity and honest record-keeping, not new function. It serves coherence of the whole rather than adding surface area.

## Reservations and follow-ups

| # | Limb | Reservation | Owner | Follow-up |
| - | --- | --- | --- | --- |
| 1 | Dharana | Full DIGIT + AI-role docs deferred | Markus | Follow-up PR `docs/digit-foundation` |
| 2 | Yama | Live Cloudflare/GoDaddy DNS record values not captured (avoided recording unverified detail) | Markus | Verify records in Cloudflare + GoDaddy dashboards, then record exact topology in `deployment-model.md` |
| 3 | Niyama | Fieldprint/hOMepage boundary is documented but not yet reflected in the stUdio homepage-builder code | Markus | Address when DIGIT-in-Fieldprint work begins |

## Outcome

- [x] Reservations accepted (⚠️) with named owners and follow-ups → milestone complete with explicit residue.

## Log entry

Added to `governance/decision-log.md` (2026-08-03).
