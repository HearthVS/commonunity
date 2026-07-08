# Rooms and Digit — decision record

_Written 2026-07-08. Records architectural decisions reached in conversation, not a spec. When a later decision supersedes something here, add a note; don't rewrite history._

## Context

Coming out of the Front door work (PRs #158, #159), a design conversation opened up about how future apps should relate to hOMe — specifically whether a writing app (working name "Scriptorium") should be its own destination, how Digit should be named across projects, and whether the four rooms (Lens, Work, Field, Call) deserved their own workspaces.

The conversation ran through several drafts — per-project Digits with a naming ceremony, a Making Shell extraction, Scriptorium as a separate app, a five-Digit constellation per project — and then collapsed into something much simpler.

## Decisions

### stUdio is the workspace

The four rooms — Lens, Work, Field, Call — live inside stUdio. There are no separate apps sitting next to hOMe. stUdio is what holds them together; the word already implies creative work in each. hOMe is the public face of what happens across the four rooms. The Workbench is the meta-view inside stUdio that shapes the public page.

Growth direction: **deeper, not wider.** Give each room real depth as a working surface. Don't spawn parallel apps.

### The rooms carry the arc

Each room has its own vibe, and that vibe is what gives the person orientation:

- **Lens** — learning, evolution, writing, sharing
- **Work** — building, business modeling per CommonUnity philosophy
- **Field** — radiance, vitality, service, relationships
- **Call** — mission and purpose

Public-facing labels remain the language-firewall versions: "How I perceive", "What I make", "What keeps me alive", "What I'm here for". The internal room names (Lens/Work/Field/Call) are for the person doing the work.

### Digit is one entity, one name

No per-project rename. No per-room rename. No naming ceremony.

- Digit is Digit.
- The person can nickname their Digit if they want.
- If the person asks Digit what it would like to be named, Digit can offer a few suggestions derived from the OM Cipher.
- That is the entire ceremony.

Digit has no enduring memory across projects — that's true and stays true — but the arc that holds things together is the **rooms**, not a rotating cast of Digits. The rooms are the connective tissue.

### Digit's register adapts to the room; Digit's identity doesn't

Same Digit, different verbs and prompts depending on where the person is standing:

- In Lens, Digit reads like a writing/learning partner.
- In Work, Digit reads like a builder/advisor.
- In Field, Digit reads like a companion for tending and relating.
- In Call, Digit reads like a guide for vocation.

This is a matter of prompt library and available verbs per room — not a matter of Digit being multiple things.

### Field Observations stays as cross-room soil

Field Observations is not tied to any single room. It's private capture that feeds any of the four when the person deliberately pulls from it:

- Deliberate pull-from, not live embed.
- No push-to from other rooms into Field Observations.
- Digit is absent or very light in this space. The soil corrupts fast under a watching presence.

### hOMe/Workbench is the public shaping layer

The Workbench (built in PRs #158/#159 and prior) is the meta-view where the person shapes what surfaces publicly on hOMe. It reads from the deeper work in each room. It doesn't replace the rooms; it composes their public face.

Front door remains the first Workbench room — identity/hero content that anchors the visitor experience.

## Explicitly abandoned

Recorded so we don't reopen these:

- **Scriptorium as a separate writing app.** Superseded by "Lens is the writing space, inside stUdio, going deeper."
- **Per-project Digit with per-project name.** Superseded by "Digit is one entity; nickname is optional."
- **Cipher-generated name constellation at project creation.** Not needed once Digit stays one entity.
- **Any elaborate Digit-naming ceremony (backfill or new).** Replaced by a light "ask Digit for suggestions" affordance.
- **"Making Shell" as a named extraction project.** The three-column shell, Digit presence layer, and room/section abstraction are simply how stUdio is built. Rooms share the substrate internally; there's no separate framework to name or extract.
- **Suffix words for the rooms as apps** (Study, Chamber, etc.). Rooms are rooms inside stUdio. No suffix.
- **Digit gallery / marketplace.** Deferred; not part of the current arc.

## What this makes obvious for the build

Right now Lens, Work, Field, Call are effectively labels with a `web_intro`. The next arc gives each room actual working depth:

- **Lens** — writing surfaces (short-form to long-form), learning capture, sharing verbs to hOMe and third-party destinations.
- **Work** — business-modeling surfaces per CommonUnity philosophy, building/advisor Digit prompts.
- **Field** — journaling, relationship-tending, radiance/vitality tracking.
- **Call** — vocation work, mission articulation.

Build order is not fixed here; when we open the next room, we'll decide which first based on what's most demanded and most shippable.

## Cross-references

- PRs #158, #159 — Front door and Workbench parity work.
- `docs/product/personal-homepage.md` — Workbench + hOMe details.
- OM Cipher naming tool — reused for optional nickname suggestions.
