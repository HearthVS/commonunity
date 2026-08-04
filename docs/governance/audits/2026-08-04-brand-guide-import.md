# Integrity Review — Brand & Communication Guide import + Key↔Cipher naming

- **Date:** 2026-08-04
- **Steward:** Markus (via Claude Code, internal builder mode)
- **Contributor(s):** Claude Code
- **Facilitator consulted (if relevant):** n/a (no Compass-touching or member-facing runtime change)
- **Linked PRs / commits:** branch `docs/brand-guide` (stacked on `docs/digit-foundation`)

## Milestone intention (one sentence)

> Bring the v0.1 Brand & Communication Guide into the repo as the canonical voice authority, and record that "CommonUnity Key" is the public-facing name for the Cipher — documentation only, no runtime change.

## Seat-setting

- [x] Re-read `foundation/commonunity-architecture-v0.2.md`
- [x] Re-read `foundation/philosophical-principles.md` (via the audit-rituals frame)

## 8-limb walk

### 1. Yama — relational integrity
- Outcome: ✅
- Notes: Gives the maintainer's own brand work a canonical home and reconciles its vocabulary with the repo. No member data or member-facing runtime touched. Content reproduced faithfully from the source; editorial additions are clearly fenced.

### 2. Niyama — internal discipline
- Outcome: ✅
- Notes: Imported verbatim in structure, marked v0.1/review, with a clearly-labelled "Repo reconciliation notes (editorial)" section separating imported content from repo mapping. A future steward can tell source from annotation.

### 3. Asana — structural seat
- Outcome: ✅
- Notes: Lands in `docs/brand/` beside `asset-map.md`; `/brand` was missing from the docs map and is now added. Cross-links from `digit.md`/`ai-roles.md` seat it as the voice authority.

### 4. Pranayama — energy flow
- Outcome: ✅
- Notes: Removes a real gap — voice rules were guiding DIGIT docs implicitly with no canonical source. Now explicit.

### 5. Pratyahara — removal of noise
- Outcome: ✅
- Notes: No invented brand content. Specific DNS-style detail avoided; the Key↔Cipher mapping is stated once, in one place, and linked.

### 6. Dharana — focused intention
- Outcome: ✅
- Notes: One thing — make the brand voice canonical and reconcile "Key". Everything serves it.

### 7. Dhyana — coherence over time
- Outcome: ⚠️
- Notes: Coherent now, but two things must follow to stay coherent: (a) DIGIT is not yet in the guide's Product architecture; (b) the Key↔Cipher public-copy decision is not yet reflected in the stUdio UI. Both are named follow-ups.

### 8. Samadhi — service to Unity
- Outcome: ✅
- Notes: Adds coherence between how CommonUnity speaks and what the repo builds. Serves the whole, not just function.

## Reservations and follow-ups

| # | Limb | Reservation | Owner | Follow-up |
| - | --- | --- | --- | --- |
| 1 | Dhyana | DIGIT absent from the guide's Product architecture | Markus | Add DIGIT to the guide in its next revision (v0.2) |
| 2 | Dhyana | CommonUnity Key public naming not yet in UI/copy | Markus | Introduce "CommonUnity Key" in member-facing surfaces for the portable file that carries the OM Cipher + Living Profile, when copy work happens |
| 3 | Asana | Guide is v0.1 review draft, not settled | Markus | Review/refine toward v0.2; casing "Studio" → "stUdio" for repo consistency |

## Outcome

- [x] Reservations accepted (⚠️) with named owners and follow-ups → milestone complete with explicit residue.

## Log entry

Added to `governance/decision-log.md` (2026-08-04).
