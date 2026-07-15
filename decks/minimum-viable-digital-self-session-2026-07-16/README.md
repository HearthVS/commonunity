# CommonUnity — Philosophy Deck · 16 July 2026 Session Cut

A **17-slide session revision** of the canonical CommonUnity philosophy deck, prepared for Markus Lehto's *Unplugged Forum* seminar on **16 July 2026**. It is a tightened, resequenced cut of the baseline deck at [`../minimum-viable-digital-self/`](../minimum-viable-digital-self/), which remains the unchanged canonical source.

Self-contained static HTML/CSS/JS. No backend, no build step, no framework. The visual system, logo assets, responsive behavior, navigation, overview, presenter notes, and typography are identical to the baseline.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | All 17 slides + chrome (toolbar, nav, overview, notes drawer, help). Slide copy + speaker notes live here. |
| `styles.css` | Design system (twilight palette, type, components) + responsive + `@media print`. Unchanged from baseline. |
| `deck.js` | Navigation and modes. Vanilla JS, no dependencies. Counts/overview/notes derive from DOM order. Unchanged from baseline. |
| `assets/` | Canonical CommonUnity logo SVGs + on-navy variants + favicon. Unchanged from baseline. |

## Slide sequence (17 slides, six parts)

Mapped from the baseline's 26-slide deck. New order → baseline slide number:

- **I · Opening** — 1 Title/landing *(baseline 1)* · 2 HEARTH *(baseline 2)* · 3 Why CommonUnity exists / Mission *(baseline 24)* · 4 The shift already underway / ambient intelligence *(baseline 3)*
- **II · The Condition** — 5 Passive acceptance *(baseline 4)* · 6 Accidental digital selves *(baseline 5)* · 7 The Threshold / healthy membrane *(baseline 6)* · 8 Fragmented apps / consolidated power *(baseline 7)* · 9 Internet of content → value *(baseline 8)* · 10 The logic of more *(baseline 9)* · 11 Who am I / fragmented self *(baseline 10)*
- **III · Orientation** — 12 Sources of orientation *(baseline 16)*
- **IV · CommonUnity** — 13 Going deeper, not wider *(baseline 17)* · 14 Speed of trust *(baseline 19)*
- **V · Practice** — 15 Breakout *(baseline 22)* · 16 Synthesis / Q&A *(baseline 23)*
- **VI · Invitation** — 17 A place in its emergence *(baseline 25)*

Removed from this cut (relative to baseline): slides 11–15, 18, 20, 21, and 26. They remain intact in the canonical baseline deck.

The two headline questions are exact and stay verbatim: **"How digital can I become?"** and **"What is my minimum viable digital self?"**

## Key content changes vs. baseline (this cut only)

- **Mission moved up** to slide 3, right after HEARTH, and reworded to open with *"To help people reclaim authorship…"*.
- **Ambient slide** (now 4): the deferred essay-reference chip for "When AI Becomes Air" is removed entirely — no placeholder or hyperlink.
- **Sources slide** (now 12): headline reads *"Sources. Inspirations, not authorities."*
- **Founding choice** (now 13): headline reads *"CommonUnity goes deeper, not wider."* (was "began by going").
- **Breakout** (now 15): duration is *10–20 minutes*.
- **Invitation** (now 17): headline is *"There is a place for you — an invitation into a living experiment."*; adds the callout *"What if you could have a website that is a true expression of you?"*; closing trimmed to *"…No urgency, no scarcity."*

## Navigation & features

Identical to the baseline deck: keyboard (`←/→`, `Space`, `PgUp/PgDn`, `Home/End`, number keys `1–9`, `O` overview, `N` notes, `?` help, `Esc`), pointer nav, touch swipe, `#slide-N` deep links, overview grid, presenter notes drawer, print CSS (one slide per page), reduced-motion, and responsive layout. Counts and overview build automatically from DOM order, so the counter reads **1 / 17**.

## Local preview

```bash
cd decks/minimum-viable-digital-self-session-2026-07-16
python3 -m http.server 8099
# open http://127.0.0.1:8099/
```

Served in production at `/decks/minimum-viable-digital-self-session-2026-07-16/`.
Deployment is handled by the main agent (do not deploy from here).
