# Integrity Review — DIGIT build, slices 1–2 (The Work)

- **Date:** 2026-08-04
- **Steward:** Markus (via Claude Code, internal builder mode)
- **Contributor(s):** Claude Code (build thread)
- **Facilitator consulted (if relevant):** n/a (no Compass-intake change)
- **Linked PRs / commits:** branch `digit-slice-1-the-work` — `236c5c7` (slice 1: Nexus|DIGIT switch), `61f911c` (slice 2: conversation-first + creation dashboard + preview), `a72ce70` (governance line → hover/ⓘ), `8f73c6f` (NOW placeholder trim).

## Milestone intention (one sentence)

> Give DIGIT a first *visible*, legible presence in **The Work** — a builder mode beside Nexus where a person builds through dialogue and can see what DIGIT is doing — as a fully reversible front-end scaffold (no model calls, no backend, nothing published).

## Seat-setting

- [x] Re-read the canonical DIGIT/role docs for this thread (`product/digit.md`, `foundation/ai-roles.md`, `governance/external-ai-boundary.md`, `product/archive.md`, brand guide).
- [x] Re-read the build brief (`handoffs/digit-build-brief.md`).

## 8-limb walk

### 1. Yama — relational integrity
- Outcome: ⚠️
- Notes: The relationships touched — member↔DIGIT, the DIGIT↔Nexus boundary, and member↔their own material — are each left in greater integrity: the two AI presences stay **distinct, not blended** (full-surface mode swap, Nexus default, distinct instrument register), Sacred / "not for processing" material is never touched, and publishing is member-confirmed. Ahimsa/Satya honoured by an explicit "Prototype · DIGIT isn't wired to a model yet" banner so the scripted flow never poses as live intelligence (**R1**).

### 2. Niyama — internal discipline
- Outcome: ✅
- Notes: A future steward can pick this up cold and feel the care — dense intent comments, decision-log entries for both slices and the "beside/inside" reinterpretation, a persisted memory of DIGIT's destination, and reuse of existing conventions (`fo-view-tabs` for the switch, `studio-info-overlay` for the hover ⓘ). Fully additive and reversible.

### 3. Asana — structural seat
- Outcome: ⚠️
- Notes: DIGIT sits as a **mode within the mirror panel**, reusing the shared room shell and gated to The Work via `data-room="work"` — a stable seat that adds no new layout track and resets to Nexus on room entry. Reservation: the preview ships a representative render rather than the live `CommonUnity.renderPublicHome` model (**R2**), and the seat is currently The-Work-only (**R3**).

### 4. Pranayama — energy flow
- Outcome: ✅
- Notes: Breath does not catch. Presence-not-dominant is honoured: Nexus is the default, DIGIT never auto-opens or grabs the panel, and the staged dashboard makes the build unhurried and legible rather than a black-box burst.

### 5. Pratyahara — removal of noise
- Outcome: ✅
- Notes: This milestone actively removed noise — the always-on governance line moved off the DIGIT surface into a hover/ⓘ affordance, and the NOW capture placeholder was trimmed to a single warm line. Nothing essential was lost; the governance copy is one hover away.

### 6. Dharana — focused intention
- Outcome: ⚠️
- Notes: The one thing this does — "make DIGIT present as a legible builder mode beside Nexus" — is served by everything on the surface (switch, dashboard, thread, artifact, preview, publish gate). Reservation: the composer and preview are deliberately **not** wired to a real model/render engine (**R1**, **R2**); intended for this slice and flagged in-UI, but the surface is a scaffold, not yet the working tool.

### 7. Dhyana — coherence over time
- Outcome: ✅
- Notes: The conversational shell + creation dashboard map directly onto `digit.md`'s orient→plan→act→review→publish loop, so it stays coherent as later slices wire the model backend, swap in the live render, add voice, and extend to the other three rooms. No dead-end shapes.

### 8. Samadhi — service to Unity
- Outcome: ✅
- Notes: Set down, this serves Unity rather than only adding function: it moves a person toward building their own digital self without living in a terminal, while preserving sovereignty absolutely — nothing is sent to any model, nothing is published, and Sacred material is untouched. Function follows the human, not the reverse.

## Reservations and follow-ups

| # | Limb | Reservation | Owner | Follow-up |
| - | --- | --- | --- | --- |
| R1 | Yama / Dharana | Composer runs a scripted prototype, not a real model (flagged by an explicit in-UI banner). | Build thread | Wire DIGIT to a model backend under `external-ai-boundary.md` (minimised, permissioned context; Sacred never sent). |
| R2 | Asana / Dharana | Preview shows a representative render, not the live `CommonUnity.renderPublicHome` model. | Build thread | Wire the preview pane to the live public-home render engine. |
| R3 | Asana | DIGIT is gated to The Work only. | Build thread | Extend the room-aware stance to The Lens / Field / Call. |

## Outcome

- [ ] All 8 limbs pass (✅) → milestone complete.
- [x] Reservations accepted (⚠️) with named owners and follow-ups → milestone complete with explicit residue.
- [ ] One or more limbs fail (❌) → milestone **not** complete. Reshape and re-audit.

Slices 1–2 ship as an intentional, reversible **scaffold**. The three reservations are precisely the "not wired yet" edges — all intended for this slice, all flagged in the UI, none blocking. Accepted with named follow-ups on the build thread.

## Log entry

- 2026-08-04 — DIGIT build slices 1–2 (The Work) — complete with reservations (⚠️ R1 composer not model-wired; R2 preview is a mock; R3 The-Work-only) — see this audit.
